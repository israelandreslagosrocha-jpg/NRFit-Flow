import { NextRequest, NextResponse } from 'next/server.js';
import { createAdminClient } from '../../../../lib/supabase/admin.ts';
import { reconcileMemberships } from '../../../../lib/mercadopago/reconciler.ts';
import { logger } from '../../../../lib/logger.ts';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron request to reconcile-memberships', {
        has_secret_configured: Boolean(cronSecret),
      });
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
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
