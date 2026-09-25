import type { SupabaseClient } from '@supabase/supabase-js';
import { getPaymentGateway } from '../index.ts';
import { logger, generateTraceId, sanitizeValue } from '../../logger.ts';
import { deriveMembershipState, type FlowSubscriptionSnapshot } from './state-machine.ts';
import { recordSecurityAuditEvent } from '../../audit.ts';

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
  const { supabase, token, resourceHint, payload } = input;
  const gateway = getPaymentGateway();

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
    .select('id, student_id, trace_id, status, gateway_subscription_id, current_period_start, current_period_end, trial_ends_at, last_gateway_event_at');

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

    // Actualizar ciclo de membresía si el pago fue aprobado
    if (pay.status === 'APPROVED') {
      const nowIso = new Date().toISOString();
      const newPeriodStart = nowIso;
      const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from('memberships')
        .update({
          status: 'ACTIVE',
          gateway: 'FLOW',
          gateway_status: 'active',
          current_period_start: newPeriodStart,
          current_period_end: newPeriodEnd,
          updated_at: nowIso,
          last_gateway_event_at: nowIso,
        })
        .eq('id', matchedMembership.id);

      if (matchedMembership.status !== 'ACTIVE') {
        await recordSecurityAuditEvent({
          eventType: 'MEMBERSHIP_STATUS_TRANSITION',
          targetType: 'memberships',
          targetId: matchedMembership.id,
          traceId: localTraceId,
          result: 'SUCCESS',
          metadata: {
            previous_status: matchedMembership.status,
            new_status: 'ACTIVE',
            gateway: 'FLOW',
            reason: 'Payment approved by gateway',
            payment_id: pay.paymentId,
            source: 'CALLBACK_PAYMENT',
          },
        }, supabase);
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
      // Regla fail-closed: Si el pago es rechazado, pasar a PAST_DUE
      const nowIso = new Date().toISOString();

      await supabase
        .from('memberships')
        .update({
          status: 'PAST_DUE',
          gateway: 'FLOW',
          gateway_status: 'past_due',
          updated_at: nowIso,
          last_gateway_event_at: nowIso,
        })
        .eq('id', matchedMembership.id);

      if (matchedMembership.status !== 'PAST_DUE') {
        await recordSecurityAuditEvent({
          eventType: 'MEMBERSHIP_STATUS_TRANSITION',
          targetType: 'memberships',
          targetId: matchedMembership.id,
          traceId: localTraceId,
          result: 'SUCCESS',
          metadata: {
            previous_status: matchedMembership.status,
            new_status: 'PAST_DUE',
            gateway: 'FLOW',
            reason: 'Payment rejected by gateway',
            payment_id: pay.paymentId,
            source: 'CALLBACK_PAYMENT',
          },
        }, supabase);
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
        trial_end: sub.trialEndsAt || (sub as any).trial_end || null,
        period_start: sub.currentPeriodStart || (sub as any).period_start || null,
        period_end: sub.currentPeriodEnd || (sub as any).period_end || null,
        cancel_at_period_end:
          sub.cancelAtPeriodEnd ??
          ((sub as any).cancel_at_period_end === 1 || (sub as any).cancel_at_period_end === true),
      };

      const derived = deriveMembershipState(flowSubSnapshot, matchedMembership);
      const nowIso = new Date().toISOString();

      const updateData: any = {
        status: derived.status,
        gateway: 'FLOW',
        gateway_status: derived.gatewayStatus,
        updated_at: nowIso,
        last_gateway_event_at: nowIso,
      };

      if (derived.effectiveTrialEnd) updateData.trial_ends_at = derived.effectiveTrialEnd;
      if (derived.effectivePeriodStart) updateData.current_period_start = derived.effectivePeriodStart;
      if (derived.effectivePeriodEnd) updateData.current_period_end = derived.effectivePeriodEnd;
      if (derived.status === 'CANCELLED') {
        updateData.cancelled_at = nowIso;
      }

      await supabase
        .from('memberships')
        .update(updateData)
        .eq('id', matchedMembership.id);

      if (derived.status !== matchedMembership.status) {
        await recordSecurityAuditEvent({
          eventType: 'MEMBERSHIP_STATUS_TRANSITION',
          targetType: 'memberships',
          targetId: matchedMembership.id,
          traceId: localTraceId,
          result: 'SUCCESS',
          metadata: {
            previous_status: matchedMembership.status,
            new_status: derived.status,
            gateway: 'FLOW',
            reason: derived.reason,
            morose: flowSubSnapshot.morose,
            raw_status: flowSubSnapshot.status,
            source: 'CALLBACK_SUBSCRIPTION',
          },
        }, supabase);
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
