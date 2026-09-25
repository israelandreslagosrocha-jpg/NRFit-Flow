import type { SupabaseClient } from '@supabase/supabase-js';
import { getPaymentGateway } from '../index.ts';
import { logger } from '../../logger.ts';
import {
  deriveMembershipState,
  type FlowSubscriptionSnapshot,
} from './state-machine.ts';

export interface ReconcileFlowResult {
  scanned: number;
  reconciled: number;
  errors: number;
  details: Array<{ membershipId: string; action: string; reason?: string }>;
}

export interface ReconcileFlowOptions {
  dryRun?: boolean;
  referenceNow?: Date | string;
}

/**
 * Reconciliador Server-to-Server Flow Multivariable (Fase M-09.3D)
 *
 * Embudo atómico exclusivo: Aplica transiciones únicamente mediante
 * `apply_membership_transition_atomic`. Cero fallbacks mutantes en caso de error.
 * Versiona snapshots observados en `last_gateway_snapshot_observed_at`.
 */
export async function reconcileFlowSubscriptions(
  supabase: SupabaseClient,
  opts?: ReconcileFlowOptions
): Promise<ReconcileFlowResult> {
  const gateway = getPaymentGateway();
  const dryRun = opts?.dryRun ?? false;
  const referenceNow = opts?.referenceNow ?? new Date();

  const result: ReconcileFlowResult = {
    scanned: 0,
    reconciled: 0,
    errors: 0,
    details: [],
  };

  const { data: memberships, error } = await supabase
    .from('memberships')
    .select('id, student_id, status, gateway_subscription_id, gateway_status, trial_ends_at, current_period_start, current_period_end, last_gateway_snapshot_observed_at, trace_id')
    .eq('gateway', 'FLOW')
    .not('gateway_subscription_id', 'is', null)
    .in('status', ['PENDING_PAYMENT', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED']);

  if (error || !memberships) {
    logger.error('Failed to query Flow memberships for reconciliation', { error: error?.message });
    return result;
  }

  result.scanned = memberships.length;

  for (const mem of memberships) {
    try {
      // 1. Consulta S2S a Flow
      const sub = await gateway.getSubscription(mem.gateway_subscription_id!);

      // 2. Registro del timestamp en que la aplicación completó la observación del snapshot
      const snapshotObservedAt = new Date().toISOString();

      // 3. Normalizar snapshot de Flow
      const flowSubSnapshot: FlowSubscriptionSnapshot = {
        id: sub.id,
        status: (sub as any).rawStatus !== undefined
          ? (sub as any).rawStatus
          : (typeof sub.status === 'number'
              ? sub.status
              : (sub.status === 'ACTIVE'
                  ? 1
                  : sub.status === 'TRIAL'
                    ? 2
                    : sub.status === 'CANCELLED'
                      ? 4
                      : 0)),
        morose: sub.morose ?? (sub as any).raw?.morose ?? 0,
        trial_end: sub.trialEndsAt || (sub as any).trial_end || null,
        period_start: sub.currentPeriodStart || (sub as any).period_start || null,
        period_end: sub.currentPeriodEnd || (sub as any).period_end || null,
        cancel_at_period_end:
          sub.cancelAtPeriodEnd ??
          ((sub as any).cancel_at_period_end === 1 || (sub as any).cancel_at_period_end === true),
      };

      // 4. Derivar estado determinista multivariable
      const derived = deriveMembershipState(flowSubSnapshot, mem, referenceNow);

      // Si los datos remotos son desconocidos o corruptos -> Fail-closed no destructivo (sin mutar DB)
      if (!derived.applyStateMutation) {
        result.details.push({
          membershipId: mem.id,
          action: 'FAIL_CLOSED_NO_MUTATION',
          reason: derived.reason,
        });
        logger.warn('Unrecognized or corrupted gateway data, failing closed without state mutation', {
          membership_id: mem.id,
          reason: derived.reason,
        });
        continue;
      }

      const statusChanged = derived.status !== mem.status;
      const datesChanged =
        (derived.effectivePeriodEnd && derived.effectivePeriodEnd !== mem.current_period_end) ||
        (derived.effectiveTrialEnd && derived.effectiveTrialEnd !== mem.trial_ends_at);

      if (dryRun) {
        if (statusChanged || datesChanged) {
          result.reconciled++;
          result.details.push({
            membershipId: mem.id,
            action: `DRY_RUN_${statusChanged ? `TRANSITION_TO_${derived.status}` : 'SYNC_DATES'}`,
            reason: derived.reason,
          });
        }
        continue;
      }

      // 5. Aplicar exclusivamente mediante la RPC atómica (Único camino autorizado)
      if (typeof supabase.rpc !== 'function') {
        result.errors++;
        result.details.push({
          membershipId: mem.id,
          action: 'APPLY_FAILED',
          reason: 'RPC function apply_membership_transition_atomic is not available on Supabase client',
        });
        logger.error('RPC function apply_membership_transition_atomic missing (Fail-Closed, zero mutation)', {
          membership_id: mem.id,
        });
        continue;
      }

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('apply_membership_transition_atomic', {
        p_membership_id: mem.id,
        p_new_status: derived.status,
        p_gateway_status: derived.gatewayStatus,
        p_current_period_start: derived.effectivePeriodStart || null,
        p_current_period_end: derived.effectivePeriodEnd || null,
        p_trial_ends_at: derived.effectiveTrialEnd || null,
        p_gateway_snapshot_observed_at: snapshotObservedAt,
        p_reason: derived.reason,
        p_actor_profile_id: null,
        p_metadata: {
          reconciliation_source: 'CRON_RECONCILER',
          morose: flowSubSnapshot.morose,
          raw_status: flowSubSnapshot.status,
          access_until: derived.accessUntil || null,
        },
      });

      if (rpcErr || !rpcRes) {
        // Fallback seguro = Cero mutación (Fail-closed)
        result.errors++;
        result.details.push({
          membershipId: mem.id,
          action: 'APPLY_FAILED',
          reason: rpcErr?.message || 'Atomic transition RPC returned null',
        });
        logger.error('Failed to apply atomic membership transition (Fail-Closed, zero mutation)', {
          membership_id: mem.id,
          error: rpcErr?.message,
        });
        continue;
      }

      if (rpcRes.status === 'TRANSITIONED') {
        result.reconciled++;
        result.details.push({
          membershipId: mem.id,
          action: `TRANSITION_TO_${derived.status}`,
          reason: derived.reason,
        });
      } else if (rpcRes.status === 'STALE_SNAPSHOT_SKIPPED') {
        result.details.push({
          membershipId: mem.id,
          action: 'SKIPPED_STALE_SNAPSHOT',
          reason: 'Snapshot is older than last_gateway_snapshot_observed_at',
        });
      }
      // NO_CHANGE: Idempotente sin mutaciones adicionales ni logs duplicados
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
