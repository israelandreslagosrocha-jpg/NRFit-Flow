import { NextRequest, NextResponse } from 'next/server.js';
import crypto from 'crypto';
import { createAdminClient } from '../../../../lib/supabase/admin.ts';
import { reconcileMemberships } from '../../../../lib/mercadopago/reconciler.ts';
import { logger } from '../../../../lib/logger.ts';
import { checkRateLimit, resolveRateLimitKey } from '../../../../lib/rate-limit/index.ts';
import { RATE_LIMIT_CONFIG } from '../../../../lib/rate-limit/config.ts';
import { createRateLimitExceededResponse } from '../../../../lib/rate-limit/headers.ts';

/**
 * Validador en tiempo constante para CRON_SECRET contra timing attacks.
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
      logger.warn('Unauthorized cron request to reconcile-memberships', {
        has_secret_configured: Boolean(cronSecret),
      });

      // Defensa contra escaneo no autorizado
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
      key: 'reconcile-memberships-worker',
      limit: cronConfig.limit,
      windowSeconds: cronConfig.windowSeconds,
    });

    if (rateLimitResult.status === 'LIMITED') {
      logger.warn('Authorized cron frequency limit reached', {
        endpoint: '/api/cron/reconcile-memberships',
        limit: cronConfig.limit,
      });
      return createRateLimitExceededResponse(rateLimitResult, 'Frecuencia de invocación de cron excedida');
    }

    const supabase = createAdminClient();
    const result = await reconcileMemberships({ supabase });

    logger.info('Membership reconciliation cron completed', {
      checked: result.checkedCount,
      reconciled: result.reconciledCount,
      errors_count: result.errors.length,
    });

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error: any) {
    logger.error('Unexpected error in reconcile-memberships cron', {}, error);
    return NextResponse.json(
      { error: 'Error interno en reconcile-memberships', details: error.message },
      { status: 500 }
    );
  }
}
