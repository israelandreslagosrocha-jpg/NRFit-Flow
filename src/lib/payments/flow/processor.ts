import type { SupabaseClient } from '@supabase/supabase-js';
import { getPaymentGateway } from '../index.ts';
import { logger, generateTraceId, sanitizeValue } from '../../logger.ts';
import { deriveMembershipState, type FlowSubscriptionSnapshot } from './state-machine.ts';

export interface ProcessFlowCallbackInput {
  supabase: SupabaseClient;
  token: string;
  resourceHint?: string;
  payload?: any;
}

export interface ProcessFlowCallbackOutput {
  success: boolean;
  statusResult: 'PROCESSED' | 'ALREADY_PROCESSED' | 'IGNORED' | 'ERROR';
  gatewayEventId?: string;
  traceId?: string;
  error?: string;
}

/**
 * Procesador de callbacks y webhooks de Flow Chile (Fase M-09R / M-09.3B)
 * Incorpora recuperación determinista de trace_id sin depender de metadata de pasarela.
 * Requisito M-09.3B.4: No confía en parámetros de cliente ni navegador como autoridad.
 */
export async function processFlowCallback(
  input: ProcessFlowCallbackInput
): Promise<ProcessFlowCallbackOutput> {
  const { supabase, token, resourceHint, payload: _payload } = input;
  const gateway = getPaymentGateway();

  // 1. Registro del timestamp en que se INICIA la consulta S2S (determinismo anti-carrera)
  const requestStartedAt = new Date().toISOString();

  // 1. Resolver el recurso S2S de forma desacoplada
  const callbackResult = await gateway.resolveCallback(token, resourceHint);

  if (callbackResult.resourceType === 'unknown') {
    const errorTraceId = generateTraceId();
    logger.warn('Flow callback could not be resolved server-to-server', {
      trace_id: errorTraceId,
      gateway: 'FLOW',
      resourceHint,
      result: 'ERROR',
    });
    return {
      success: false,
      statusResult: 'ERROR',
      traceId: errorTraceId,
      error: 'No se pudo resolver el recurso S2S de Flow',
    };
  }

  // 2. Determinar identificadores canónicos para idempotencia
  let eventResource = 'flow';
  let eventResourceId = token;
  let eventStatus = 'received';

  if (callbackResult.resourceType === 'payment' && callbackResult.payment) {
    eventResource = 'payment';
    eventResourceId = callbackResult.payment.paymentId;
    eventStatus = callbackResult.payment.status;
  } else if (callbackResult.resourceType === 'subscription' && callbackResult.subscription) {
    eventResource = 'subscription';
    eventResourceId = callbackResult.subscription.id;
    eventStatus = callbackResult.subscription.status;
  } else if (callbackResult.resourceType === 'invoice' && callbackResult.payment) {
    eventResource = 'invoice';
    eventResourceId = callbackResult.payment.paymentId;
    eventStatus = callbackResult.payment.status;
  }

  const gatewayEventId = `flow_${eventResource}_${eventResourceId}_${eventStatus}`;

  // 3. Recuperación determinista del trace_id local sin depender de metadata de Flow (M-09.3B.4)
  // Se ignora cualquier trace_id que venga en payload o parámetros de cliente.
  const targetSubId = callbackResult.subscription?.id || callbackResult.payment?.subscriptionId;
  const targetCustomerId = callbackResult.subscription?.customerId || callbackResult.payment?.customerId;

  let membershipQuery = supabase
    .from('memberships')
    .select('id, student_id, trace_id, status, gateway_subscription_id, current_period_start, current_period_end, trial_ends_at, last_gateway_snapshot_request_started_at, gateway_sync_state, gateway_snapshot_sequence_counter, last_applied_snapshot_sequence');

  if (targetSubId) {
    membershipQuery = membershipQuery.eq('gateway_subscription_id', targetSubId);
  } else if (targetCustomerId) {
    membershipQuery = membershipQuery.eq('gateway_customer_id', targetCustomerId);
  }

  const { data: matchedMembership } = await membershipQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Si existe membresía local vinculada, recuperar su trace_id; si no, generar nuevo trace_id backend
  const localTraceId = matchedMembership?.trace_id || generateTraceId();

  // Reserva atómica de secuencia monotónica por membresía antes de aplicar transiciones (Anti Clock-Skew)
  let snapshotSequence: number | null = null;
  if (matchedMembership && typeof supabase.rpc === 'function') {
    const { data: seqData, error: seqErr } = await supabase.rpc('reserve_gateway_snapshot_sequence', {
      p_membership_id: matchedMembership.id,
    });
    if (!seqErr && seqData !== null && seqData !== undefined) {
      snapshotSequence = Number(seqData);
    } else {
      logger.error('Failed to reserve snapshot sequence for callback (Fail-Closed)', {
        trace_id: localTraceId,
        membership_id: matchedMembership.id,
        error: seqErr?.message,
      });
      return {
        success: false,
        statusResult: 'ERROR',
        gatewayEventId,
        traceId: localTraceId,
        error: 'Failed to reserve snapshot sequence',
      };
    }
  }

  // 4. Idempotencia Inbound en public.payment_events (Postgres Unique Constraint 23505)
  const { error: eventInsertError } = await supabase
    .from('payment_events')
    .insert({
      gateway_event_id: gatewayEventId,
      gateway: 'FLOW',
      event_type: `flow_${eventResource}`,
      resource_id: eventResourceId,
      payload: {
        token: '[REDACTED_TOKEN]',
        callbackResult: sanitizeValue(callbackResult),
        trace_id: localTraceId,
      },
      status: 'PROCESSED',
      processed_at: new Date().toISOString(),
    });

  if (eventInsertError) {
    const isDuplicate =
      eventInsertError.code === '23505' ||
      eventInsertError.message?.includes('duplicate key') ||
      eventInsertError.message?.includes('violates unique constraint');

    if (isDuplicate) {
      logger.info('Flow callback duplicate event skipped (Inbound Idempotency)', {
        trace_id: localTraceId,
        gateway: 'FLOW',
        gateway_event_id: gatewayEventId,
        membership_id: matchedMembership?.id,
        result: 'ALREADY_PROCESSED',
      });
      return {
        success: true,
        statusResult: 'ALREADY_PROCESSED',
        gatewayEventId,
        traceId: localTraceId,
      };
    }

    logger.error('Error inserting inbound event into payment_events', {
      trace_id: localTraceId,
      gateway: 'FLOW',
      gateway_event_id: gatewayEventId,
      result: 'ERROR',
    }, eventInsertError);
    return {
      success: false,
      statusResult: 'ERROR',
      gatewayEventId,
      traceId: localTraceId,
      error: eventInsertError.message,
    };
  }

  // 5. Procesamiento según tipo de recurso
  // Caso A: Evento de Pago o Factura pagada
  if (callbackResult.payment) {
    const pay = callbackResult.payment;

    if (!matchedMembership) {
      logger.warn('Payment received for untracked membership in Flow', {
        trace_id: localTraceId,
        gateway: 'FLOW',
        gateway_payment_id: pay.paymentId,
        result: 'PROCESSED_UNTRACKED',
      });
      return { success: true, statusResult: 'PROCESSED', gatewayEventId, traceId: localTraceId };
    }

    // Idempotencia Financiera en public.payment_transactions (gateway_payment_id UNIQUE)
    const { error: txError } = await supabase
      .from('payment_transactions')
      .insert({
        membership_id: matchedMembership.id,
        gateway_payment_id: pay.paymentId,
        gateway: 'FLOW',
        amount: pay.amount,
        currency: pay.currency,
        status: pay.status,
        payment_method: pay.paymentMethod,
        payment_date: pay.paymentDate,
      });

    if (txError) {
      const isTxDuplicate =
        txError.code === '23505' ||
        txError.message?.includes('duplicate key') ||
        txError.message?.includes('violates unique constraint');

      if (isTxDuplicate) {
        logger.info('Flow transaction already recorded (Financial Idempotency)', {
          trace_id: localTraceId,
          gateway: 'FLOW',
          membership_id: matchedMembership.id,
          gateway_payment_id: pay.paymentId,
          result: 'ALREADY_PROCESSED',
        });
        return { success: true, statusResult: 'ALREADY_PROCESSED', gatewayEventId, traceId: localTraceId };
      }
    }

    // Actualizar ciclo de membresía si el pago fue aprobado mediante embudo atómico exclusivo
    if (pay.status === 'APPROVED') {
      const newPeriodStart = requestStartedAt;
      const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      if (typeof supabase.rpc === 'function') {
        const { error: rpcErr } = await supabase.rpc('apply_membership_transition_atomic', {
          p_membership_id: matchedMembership.id,
          p_new_status: 'ACTIVE',
          p_gateway_status: 'active',
          p_current_period_start: newPeriodStart,
          p_current_period_end: newPeriodEnd,
          p_trial_ends_at: null,
          p_gateway_snapshot_request_started_at: requestStartedAt,
          p_reason: 'Payment approved by gateway',
          p_actor_profile_id: null,
          p_metadata: {
            source: 'CALLBACK_PAYMENT',
            payment_id: pay.paymentId,
          },
          p_sync_state: 'HEALTHY',
          p_snapshot_sequence: snapshotSequence,
        });

        if (rpcErr) {
          logger.error('Failed to apply atomic transition for approved payment (Fail-Closed)', {
            trace_id: localTraceId,
            membership_id: matchedMembership.id,
            error: rpcErr.message,
          });
        }
      }

      // Encolar email de confirmación de renovación en outbox con trace_id vinculado
      await supabase.from('email_outbox').insert({
        dedupe_key: `flow-pay-success:${pay.paymentId}`,
        recipient_email: 'alumna@natyentrenadora.com',
        subject: 'Pago exitoso de tu membresía Team Naty',
        template_id: 'payment_success',
        payload: {
          amount: pay.amount,
          currency: pay.currency,
          periodEnd: newPeriodEnd,
          trace_id: localTraceId,
        },
      });
    } else if (pay.status === 'REJECTED') {
      // Regla fail-closed: Si el pago es rechazado, pasar a PAST_DUE vía RPC atómica
      if (typeof supabase.rpc === 'function') {
        const { error: rpcErr } = await supabase.rpc('apply_membership_transition_atomic', {
          p_membership_id: matchedMembership.id,
          p_new_status: 'PAST_DUE',
          p_gateway_status: 'past_due',
          p_current_period_start: null,
          p_current_period_end: null,
          p_trial_ends_at: null,
          p_gateway_snapshot_request_started_at: requestStartedAt,
          p_reason: 'Payment rejected by gateway',
          p_actor_profile_id: null,
          p_metadata: {
            source: 'CALLBACK_PAYMENT',
            payment_id: pay.paymentId,
          },
          p_sync_state: 'HEALTHY',
          p_snapshot_sequence: snapshotSequence,
        });

        if (rpcErr) {
          logger.error('Failed to apply atomic transition for rejected payment (Fail-Closed)', {
            trace_id: localTraceId,
            membership_id: matchedMembership.id,
            error: rpcErr.message,
          });
        }
      }

      await supabase.from('email_outbox').insert({
        dedupe_key: `flow-pay-failed:${pay.paymentId}`,
        recipient_email: 'alumna@natyentrenadora.com',
        subject: 'Problema con el pago de tu membresía Team Naty',
        template_id: 'payment_failed',
        payload: {
          amount: pay.amount,
          currency: pay.currency,
          trace_id: localTraceId,
        },
      });
    }
  }

  // Caso B: Actualización de Suscripción (fechas, morosidad o cancelación)
  if (callbackResult.subscription) {
    const sub = callbackResult.subscription;

    if (matchedMembership) {
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
        subscription_start: (sub as any).subscription_start || null,
        subscription_end: (sub as any).subscription_end || null,
        trial_start: (sub as any).trial_start || null,
        trial_end: sub.trialEndsAt || (sub as any).trial_end || null,
        period_start: sub.currentPeriodStart || (sub as any).period_start || null,
        period_end: sub.currentPeriodEnd || (sub as any).period_end || null,
        cancel_at_period_end:
          sub.cancelAtPeriodEnd ??
          ((sub as any).cancel_at_period_end === 1 || (sub as any).cancel_at_period_end === true),
      };

      const derived = deriveMembershipState(flowSubSnapshot, matchedMembership);

      if (derived.syncState === 'ANOMALY') {
        logger.warn('Unrecognized or corrupted subscription callback data, failing closed with persistent anomaly gate', {
          trace_id: localTraceId,
          membership_id: matchedMembership.id,
          reason: derived.reason,
        });

        if (typeof supabase.rpc === 'function') {
          await supabase.rpc('apply_membership_transition_atomic', {
            p_membership_id: matchedMembership.id,
            p_new_status: matchedMembership.status,
            p_gateway_status: derived.gatewayStatus,
            p_current_period_start: null,
            p_current_period_end: null,
            p_trial_ends_at: null,
            p_gateway_snapshot_request_started_at: requestStartedAt,
            p_reason: derived.reason,
            p_actor_profile_id: null,
            p_metadata: {
              source: 'CALLBACK_SUBSCRIPTION',
              morose: flowSubSnapshot.morose,
              raw_status: flowSubSnapshot.status,
            },
            p_sync_state: 'ANOMALY',
            p_snapshot_sequence: snapshotSequence,
          });
        }
      } else if (typeof supabase.rpc === 'function') {
        const { error: rpcErr } = await supabase.rpc('apply_membership_transition_atomic', {
          p_membership_id: matchedMembership.id,
          p_new_status: derived.status,
          p_gateway_status: derived.gatewayStatus,
          p_current_period_start: derived.effectivePeriodStart || null,
          p_current_period_end: derived.effectivePeriodEnd || null,
          p_trial_ends_at: derived.effectiveTrialEnd || null,
          p_gateway_snapshot_request_started_at: requestStartedAt,
          p_reason: derived.reason,
          p_actor_profile_id: null,
          p_metadata: {
            source: 'CALLBACK_SUBSCRIPTION',
            morose: flowSubSnapshot.morose,
            raw_status: flowSubSnapshot.status,
            access_until: derived.accessUntil || null,
          },
          p_sync_state: 'HEALTHY',
          p_snapshot_sequence: snapshotSequence,
        });

        if (rpcErr) {
          logger.error('Failed to apply atomic transition for subscription callback (Fail-Closed)', {
            trace_id: localTraceId,
            membership_id: matchedMembership.id,
            error: rpcErr.message,
          });
        }
      }
    }
  }

  logger.info('flow_callback_processed', {
    trace_id: localTraceId,
    gateway: 'FLOW',
    membership_id: matchedMembership?.id,
    gateway_payment_id: callbackResult.payment?.paymentId,
    gateway_subscription_id: callbackResult.subscription?.id || callbackResult.payment?.subscriptionId,
    result: 'PROCESSED',
  });

  return {
    success: true,
    statusResult: 'PROCESSED',
    gatewayEventId,
    traceId: localTraceId,
  };
}
