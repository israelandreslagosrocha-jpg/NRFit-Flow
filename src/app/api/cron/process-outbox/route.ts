import { NextRequest, NextResponse } from 'next/server.js';
import crypto from 'crypto';
import { createAdminClient } from '../../../../lib/supabase/admin.ts';
import { processEmailOutbox } from '../../../../lib/email/outbox-worker.ts';
import { logger } from '../../../../lib/logger.ts';
import { checkRateLimit, resolveRateLimitKey } from '../../../../lib/rate-limit/index.ts';
import { RATE_LIMIT_CONFIG } from '../../../../lib/rate-limit/config.ts';
import { createRateLimitExceededResponse } from '../../../../lib/rate-limit/headers.ts';

/**
 * Validador en tiempo constante para CRON_SECRET contra timing attacks.
 * No loguea ni expone el valor del secreto.
 */
function isAuthorizedCron(authHeader: string | null, cronSecret?: string): boolean {
  if (!cronSecret || !authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  const authBuf = Buffer.from(authHeader);
  const expBuf = Buffer.from(expected);
  if (authBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(authBuf, expBuf);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // 1. Barrera Primaria: Autenticación estricta con CRON_SECRET antes de trabajo costoso
    if (!isAuthorizedCron(authHeader, cronSecret)) {
      logger.warn('Unauthorized cron request to process-outbox', {
        has_secret_configured: Boolean(cronSecret),
      });

      // Defensa contra escaneo de fuerza bruta anónimo
      const clientKey = resolveRateLimitKey(req.headers);
      await checkRateLimit({
        namespace: 'cron-unauthorized-probe',
        key: clientKey,
        limit: 10,
        windowSeconds: 60,
      });

      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 2. Defensa en profundidad contra replay masivo o bucles de scheduler
    // REGLA M-09.3E: Peticiones autorizadas con CRON_SECRET NUNCA son bloqueadas por cuotas de IP pública
    const cronConfig = RATE_LIMIT_CONFIG.cronEndpoints;
    const rateLimitResult = await checkRateLimit({
      namespace: 'cron-authorized-worker',
      key: 'process-outbox-worker',
      limit: cronConfig.limit,
      windowSeconds: cronConfig.windowSeconds,
    });

    if (rateLimitResult.status === 'LIMITED') {
      logger.warn('Authorized cron frequency limit reached', {
        endpoint: '/api/cron/process-outbox',
        limit: cronConfig.limit,
      });
      return createRateLimitExceededResponse(rateLimitResult, 'Frecuencia de invocación de cron excedida');
    }

    const supabase = createAdminClient();
    const workerId = `worker-${crypto.randomUUID()}`;

    // Claim atómico con FOR UPDATE SKIP LOCKED vía RPC
    const claimEmails = async () => {
      const { data: rpcRecords, error: rpcError } = await supabase
        .rpc('claim_outbox_emails', {
          p_worker_id: workerId,
          p_batch_size: 25,
          p_lease_seconds: 300,
        });

      if (!rpcError && rpcRecords) {
        return rpcRecords;
      }

      // Fallback controlado si la RPC no está instalada en el mock o entorno
      const { data: records, error: queryError } = await supabase
        .from('email_outbox')
        .select('*')
        .or('status.eq.PENDING,status.eq.FAILED')
        .lt('attempts', 5)
        .order('created_at', { ascending: true })
        .limit(25);

      if (queryError) {
        logger.error('Error fetching emails from outbox', {}, queryError);
        return [];
      }

      return (records || []).map((r: any) => ({
        ...r,
        attempts: (r.attempts ?? 0) + 1,
      }));
    };

    const result = await processEmailOutbox(
      claimEmails,
      async ({ id, status, attempts, nextAttemptAt, lastError }) => {
        await supabase
          .from('email_outbox')
          .update({
            status,
            attempts,
            next_attempt_at: nextAttemptAt,
            last_error: lastError ?? null,
            processed_at: status === 'SENT' ? new Date().toISOString() : null,
            claimed_at: null,
            claimed_by: null,
          })
          .eq('id', id);
      }
    );

    logger.info('Email outbox cron completed', {
      worker_id: workerId,
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      dead_letter: result.dead_letter,
      errors_count: result.errors.length,
    });

    return NextResponse.json({ success: true, workerId, result }, { status: 200 });
  } catch (error: any) {
    logger.error('Unexpected error in process-outbox cron', {}, error);
    return NextResponse.json({ error: 'Error interno en process-outbox', details: error.message }, { status: 500 });
  }
}
