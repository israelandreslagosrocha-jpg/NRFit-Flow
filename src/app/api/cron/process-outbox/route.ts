import { NextRequest, NextResponse } from 'next/server.js';
import { createAdminClient } from '../../../../lib/supabase/admin.ts';
import { processEmailOutbox } from '../../../../lib/email/outbox-worker.ts';
import { logger } from '../../../../lib/logger.ts';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron request to process-outbox', {
        has_secret_configured: Boolean(cronSecret),
      });
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Consultar correos pendientes o fallidos con intentos < 5
    const { data: records, error: queryError } = await supabase
      .from('email_outbox')
      .select('*')
      .or('status.eq.PENDING,status.eq.FAILED')
      .lt('attempts', 5)
      .order('created_at', { ascending: true })
      .limit(25);

    if (queryError) {
      logger.error('Error fetching pending emails from outbox', {}, queryError);
      return NextResponse.json({ error: 'Error al consultar outbox' }, { status: 500 });
    }

    const result = await processEmailOutbox(
      async () => records || [],
      async ({ id, status, attempts, lastError }) => {
        await supabase
          .from('email_outbox')
          .update({
            status,
            attempts,
            last_error: lastError ?? null,
            processed_at: new Date().toISOString(),
          })
          .eq('id', id);
      }
    );

    logger.info('Email outbox cron completed', {
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      errors_count: result.errors.length,
    });

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error: any) {
    logger.error('Unexpected error in process-outbox cron', {}, error);
    return NextResponse.json({ error: 'Error interno en process-outbox', details: error.message }, { status: 500 });
  }
}
