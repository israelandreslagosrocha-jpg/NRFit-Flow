import type { SupabaseClient } from '@supabase/supabase-js';
import { getPaymentGateway } from '../index.ts';
import { logger } from '../../logger.ts';
import {
  deriveMembershipState,
  type FlowSubscriptionSnapshot,
  type CanonicalMembershipStatus,
} from './state-machine.ts';
import { recordSecurityAuditEvent } from '../../audit.ts';

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
 * Utiliza deriveMembershipState para evaluar conjuntamente status de Flow,
 * morosidad (morose), fechas efectivas contractuales y estado local.
 * Aplica transiciones atómicas protegidas contra race conditions (FOR UPDATE / guarda anti-stale).
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
    .select('id, student_id, status, gateway_subscription_id, gateway_status, trial_ends_at, current_period_start, current_period_end, last_gateway_event_at, trace_id')
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

      // Normalizar snapshot de suscripción de Flow
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

      // Derivar estado determinista multivariable
      const derived = deriveMembershipState(flowSubSnapshot, mem, referenceNow);

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

      const eventTime = new Date().toISOString();

      // Intento de ejecución mediante RPC atómica hardened
      let rpcExecuted = false;
      if (typeof supabase.rpc === 'function') {
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('apply_membership_transition_atomic', {
            p_membership_id: mem.id,
            p_new_status: derived.status,
            p_gateway_status: derived.gatewayStatus,
            p_current_period_start: derived.effectivePeriodStart || null,
            p_current_period_end: derived.effectivePeriodEnd || null,
            p_trial_ends_at: derived.effectiveTrialEnd || null,
            p_gateway_event_at: eventTime,
            p_reason: derived.reason,
            p_actor_profile_id: null,
            p_metadata: {
              reconciliation_source: 'CRON_RECONCILER',
              morose: flowSubSnapshot.morose,
              raw_status: flowSubSnapshot.status,
            },
          });

          if (!rpcErr && rpcRes) {
            rpcExecuted = true;
            if (rpcRes.status === 'TRANSITIONED') {
              result.reconciled++;
              result.details.push({
                membershipId: mem.id,
                action: `TRANSITION_TO_${derived.status}`,
                reason: derived.reason,
              });
            } else if (rpcRes.status === 'STALE_EVENT_SKIPPED') {
              result.details.push({
                membershipId: mem.id,
                action: 'SKIPPED_STALE_SNAPSHOT',
                reason: 'Snapshot is older than last_gateway_event_at',
              });
            }
            // NO_CHANGE genera no-op limpio (cero registros duplicados)
          }
        } catch {
          rpcExecuted = false;
        }
      }

      // Fallback transaccional directo si la RPC no está instalada o no está disponible en el entorno
      if (!rpcExecuted) {
        // Guarda contra eventos obsoletos
        if (mem.last_gateway_event_at && eventTime < mem.last_gateway_event_at) {
          result.details.push({
            membershipId: mem.id,
            action: 'SKIPPED_STALE_SNAPSHOT',
            reason: 'Snapshot is older than last_gateway_event_at',
          });
          continue;
        }

        if (statusChanged || datesChanged) {
          const updates: Record<string, any> = {
            status: derived.status,
            gateway_status: derived.gatewayStatus,
            updated_at: new Date().toISOString(),
            last_gateway_event_at: eventTime,
          };

          if (derived.effectivePeriodStart) updates.current_period_start = derived.effectivePeriodStart;
          if (derived.effectivePeriodEnd) updates.current_period_end = derived.effectivePeriodEnd;
          if (derived.effectiveTrialEnd) updates.trial_ends_at = derived.effectiveTrialEnd;

          await supabase
            .from('memberships')
            .update(updates)
            .eq('id', mem.id);

          if (statusChanged) {
            await recordSecurityAuditEvent({
              eventType: 'MEMBERSHIP_STATUS_TRANSITION',
              targetType: 'memberships',
              targetId: mem.id,
              traceId: mem.trace_id,
              result: 'SUCCESS',
              metadata: {
                previous_status: mem.status,
                new_status: derived.status,
                gateway: 'FLOW',
                reason: derived.reason,
                morose: flowSubSnapshot.morose,
                raw_status: flowSubSnapshot.status,
                source: 'CRON_RECONCILER',
              },
            }, supabase);
          }

          result.reconciled++;
          result.details.push({
            membershipId: mem.id,
            action: `TRANSITION_TO_${derived.status}`,
            reason: derived.reason,
          });
        }
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
