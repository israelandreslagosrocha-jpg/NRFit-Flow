import type { SupabaseClient } from '@supabase/supabase-js';
import { getPaymentGateway } from '../index.ts';
import { logger } from '../../logger.ts';

export interface ReconcileFlowResult {
  scanned: number;
  reconciled: number;
  errors: number;
  details: Array<{ membershipId: string; action: string; reason?: string }>;
}

export async function reconcileFlowSubscriptions(
  supabase: SupabaseClient,
  opts?: { dryRun?: boolean }
): Promise<ReconcileFlowResult> {
  const gateway = getPaymentGateway();
  const dryRun = opts?.dryRun ?? false;

  const result: ReconcileFlowResult = {
    scanned: 0,
    reconciled: 0,
    errors: 0,
    details: [],
  };

  const { data: memberships, error } = await supabase
    .from('memberships')
    .select('id, student_id, status, gateway_subscription_id, trial_ends_at, current_period_end')
    .eq('gateway', 'FLOW')
    .not('gateway_subscription_id', 'is', null)
    .in('status', ['PENDING_PAYMENT', 'TRIAL', 'ACTIVE', 'PAST_DUE']);

  if (error || !memberships) {
    logger.error('Failed to query Flow memberships for reconciliation', { error: error?.message });
    return result;
  }

  result.scanned = memberships.length;

  for (const mem of memberships) {
    try {
      const sub = await gateway.getSubscription(mem.gateway_subscription_id!);
      let needsUpdate = false;
      const updates: any = {};

      // 1. Detección de mora en Flow (morose = 1)
      if (sub.morose === 1 && mem.status !== 'PAST_DUE') {
        needsUpdate = true;
        updates.status = 'PAST_DUE';
        updates.gateway_status = 'past_due';
        result.details.push({
          membershipId: mem.id,
          action: 'TRANSITION_TO_PAST_DUE',
          reason: 'Flow reports morose=1 (invoice overdue)',
        });
      }

      // 2. Detección de reactivación tras subsanar mora
      if (sub.morose === 0 && sub.status === 'ACTIVE' && mem.status === 'PAST_DUE') {
        needsUpdate = true;
        updates.status = 'ACTIVE';
        updates.gateway_status = 'active';
        result.details.push({
          membershipId: mem.id,
          action: 'RESTORE_TO_ACTIVE',
          reason: 'Flow reports morose=0 and active subscription',
        });
      }

      // 3. Sincronización de fechas de ciclo
      if (sub.currentPeriodEnd && sub.currentPeriodEnd !== mem.current_period_end) {
        needsUpdate = true;
        updates.current_period_end = sub.currentPeriodEnd;
      }

      if (sub.trialEndsAt && sub.trialEndsAt !== mem.trial_ends_at) {
        needsUpdate = true;
        updates.trial_ends_at = sub.trialEndsAt;
      }

      if (needsUpdate && !dryRun) {
        await supabase
          .from('memberships')
          .update(updates)
          .eq('id', mem.id);

        result.reconciled++;
      }
    } catch (err: any) {
      result.errors++;
      result.details.push({
        membershipId: mem.id,
        action: 'ERROR',
        reason: err.message,
      });
      logger.warn('Error reconciling subscription with Flow S2S', { membership_id: mem.id, error: err.message });
    }
  }

  return result;
}
