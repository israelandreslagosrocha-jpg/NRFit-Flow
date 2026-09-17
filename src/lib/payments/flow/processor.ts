import type { SupabaseClient } from '@supabase/supabase-js';
import { getPaymentGateway } from '../index.ts';
import { logger } from '../../logger.ts';

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
  error?: string;
}

export async function processFlowCallback(
  input: ProcessFlowCallbackInput
): Promise<ProcessFlowCallbackOutput> {
  const { supabase, token, resourceHint, payload } = input;
  const gateway = getPaymentGateway();

  // 1. Resolver el recurso S2S de forma desacoplada
  const callbackResult = await gateway.resolveCallback(token, resourceHint);

  if (callbackResult.resourceType === 'unknown') {
    logger.warn('Flow callback could not be resolved server-to-server', { token, resourceHint });
    return {
      success: false,
      statusResult: 'ERROR',
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

  // 3. Idempotencia Inbound en public.payment_events (Postgres Unique Constraint 23505)
  const { error: eventInsertError } = await supabase
    .from('payment_events')
    .insert({
      gateway_event_id: gatewayEventId,
      gateway: 'FLOW',
      event_type: `flow_${eventResource}`,
      resource_id: eventResourceId,
      payload: { token, callbackResult, payload },
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
        gateway_event_id: gatewayEventId,
        status_result: 'ALREADY_PROCESSED',
      });
      return {
        success: true,
        statusResult: 'ALREADY_PROCESSED',
        gatewayEventId,
      };
    }

    logger.error('Error inserting inbound event into payment_events', { error: eventInsertError.message });
    return {
      success: false,
      statusResult: 'ERROR',
      error: eventInsertError.message,
    };
  }

  // 4. Procesamiento según tipo de recurso
  // Caso A: Evento de Pago o Factura pagada
  if (callbackResult.payment) {
    const pay = callbackResult.payment;

    // Buscar membresía vinculada
    let membershipQuery = supabase
      .from('memberships')
      .select('id, student_id, status, gateway_subscription_id, current_period_end');

    if (pay.subscriptionId) {
      membershipQuery = membershipQuery.eq('gateway_subscription_id', pay.subscriptionId);
    } else if (pay.customerId) {
      membershipQuery = membershipQuery.eq('gateway_customer_id', pay.customerId);
    }

    const { data: membership } = await membershipQuery.order('created_at', { ascending: false }).limit(1).single();

    if (!membership) {
      logger.warn('Payment received for untracked membership in Flow', { pay });
      return { success: true, statusResult: 'PROCESSED', gatewayEventId };
    }

    // Idempotencia Financiera en public.payment_transactions (gateway_payment_id UNIQUE)
    const { error: txError } = await supabase
      .from('payment_transactions')
      .insert({
        membership_id: membership.id,
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
          gateway_payment_id: pay.paymentId,
        });
        return { success: true, statusResult: 'ALREADY_PROCESSED', gatewayEventId };
      }
    }

    // Actualizar ciclo de membresía si el pago fue aprobado
    if (pay.status === 'APPROVED') {
      const newPeriodStart = new Date().toISOString();
      const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from('memberships')
        .update({
          status: 'ACTIVE',
          gateway: 'FLOW',
          gateway_status: 'active',
          current_period_start: newPeriodStart,
          current_period_end: newPeriodEnd,
        })
        .eq('id', membership.id);

      // Encolar email de confirmación de renovación en outbox
      await supabase.from('email_outbox').insert({
        dedupe_key: `flow-pay-success:${pay.paymentId}`,
        recipient_email: 'alumna@natyentrenadora.com',
        subject: 'Pago exitoso de tu membresía Team Naty',
        template_id: 'payment_success',
        payload: {
          amount: pay.amount,
          currency: pay.currency,
          periodEnd: newPeriodEnd,
        },
      });
    } else if (pay.status === 'REJECTED') {
      // Regla fail-closed: Si el pago es rechazado, pasar a PAST_DUE
      await supabase
        .from('memberships')
        .update({
          status: 'PAST_DUE',
          gateway: 'FLOW',
          gateway_status: 'past_due',
        })
        .eq('id', membership.id);

      await supabase.from('email_outbox').insert({
        dedupe_key: `flow-pay-failed:${pay.paymentId}`,
        recipient_email: 'alumna@natyentrenadora.com',
        subject: 'Problema con el pago de tu membresía Team Naty',
        template_id: 'payment_failed',
        payload: {
          amount: pay.amount,
          currency: pay.currency,
        },
      });
    }
  }

  // Caso B: Actualización de Suscripción (fechas, morosidad o cancelación)
  if (callbackResult.subscription) {
    const sub = callbackResult.subscription;
    const { data: membership } = await supabase
      .from('memberships')
      .select('id, status, trial_ends_at, current_period_end')
      .eq('gateway_subscription_id', sub.id)
      .limit(1)
      .single();

    if (membership) {
      const updateData: any = {
        gateway: 'FLOW',
        gateway_status: sub.status.toLowerCase(),
      };

      if (sub.trialEndsAt) updateData.trial_ends_at = sub.trialEndsAt;
      if (sub.currentPeriodStart) updateData.current_period_start = sub.currentPeriodStart;
      if (sub.currentPeriodEnd) updateData.current_period_end = sub.currentPeriodEnd;

      // Morosidad Flow:
      // morose = 1: PAST_DUE
      // morose = 2: no convertir automáticamente a PAST_DUE
      if (sub.morose === 1) {
        updateData.status = 'PAST_DUE';
      } else if (sub.status === 'CANCELLED') {
        updateData.status = 'CANCELLED';
        updateData.cancelled_at = new Date().toISOString();
      } else if (sub.status === 'ACTIVE' && sub.morose === 0) {
        updateData.status = 'ACTIVE';
      }

      await supabase
        .from('memberships')
        .update(updateData)
        .eq('id', membership.id);
    }
  }

  return {
    success: true,
    statusResult: 'PROCESSED',
    gatewayEventId,
  };
}
