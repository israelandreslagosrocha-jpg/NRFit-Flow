/**
 * @deprecated [LEGACY_RETAIN_READ_ONLY]
 * Este módulo se conserva exclusivamente por trazabilidad de migración e histórico.
 * La pasarela activa para Naty Entrenadora es Flow Chile (src/lib/payments/flow).
 */
import * as defaultMpClient from './client.ts';
import { logger } from '../logger.ts';

export interface ReconcileResult {
  checkedCount: number;
  reconciledCount: number;
  errors: Array<{ membershipId: string; error: string }>;
}

/**
 * Motor de Reconciliación Server-to-Server (S2S)
 * Principio Rector: Mercado Pago es la autoridad del estado gateway y transacciones financieras;
 * el backend aplica posteriormente las reglas internas de vigencia, membresía y acceso.
 */
export async function reconcileMemberships(params: {
  supabase: any;
  client?: {
    getSubscription?: typeof defaultMpClient.getSubscription;
  };
  now?: Date;
}): Promise<ReconcileResult> {
  const { supabase } = params;
  const getSub = params.client?.getSubscription || defaultMpClient.getSubscription;
  const now = params.now ?? new Date();

  // Consultar membresías que requieren auditoría de estado
  const { data: memberships, error } = await supabase
    .from('memberships')
    .select('id, status, gateway_subscription_id, gateway_status, current_period_end, trial_ends_at')
    .not('gateway_subscription_id', 'is', null)
    .in('status', ['PENDING_PAYMENT', 'TRIAL', 'ACTIVE', 'CANCELLED']);

  if (error) {
    logger.error('Error querying memberships for reconciliation', {}, error);
    throw error;
  }

  const result: ReconcileResult = {
    checkedCount: 0,
    reconciledCount: 0,
    errors: [],
  };

  if (!memberships || memberships.length === 0) {
    return result;
  }

  for (const mem of memberships) {
    result.checkedCount++;
    try {
      const sub = await getSub(mem.gateway_subscription_id);

      let needsUpdate = false;
      const updates: Record<string, any> = {};

      // Caso 1: Webhook Perdido (Membresía en PENDING_PAYMENT pero autorizada en MP)
      if (mem.status === 'PENDING_PAYMENT' && sub.status === 'authorized') {
        const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        updates.status = 'TRIAL';
        updates.gateway_status = 'authorized';
        updates.trial_ends_at = trialEndsAt;
        needsUpdate = true;

        // Encolar email de bienvenida desacoplado en outbox
        await supabase.from('email_outbox').insert({
          dedupe_key: `trial-welcome:${mem.id}`,
          recipient_email: sub.payer_email || 'alumna@natyentrenadora.cl',
          subject: '¡Bienvenida al Team Naty! Comienza tu prueba de 7 días',
          template_id: 'trial_welcome',
          payload: {
            trialEndDate: new Date(trialEndsAt).toLocaleDateString('es-CL'),
            firstChargeDate: new Date(trialEndsAt).toLocaleDateString('es-CL'),
          },
        });

        logger.info('Reconciled lost webhook: PENDING_PAYMENT transitioned to TRIAL', {
          membership_id: mem.id,
          gateway_subscription_id: mem.gateway_subscription_id,
          status_result: 'TRIAL',
        });
      }

      // Caso 2: Suscripción cancelada en MP
      if (sub.status === 'canceled' && mem.gateway_status !== 'canceled') {
        updates.gateway_status = 'canceled';
        updates.cancelled_at = now.toISOString();
        updates.status = 'CANCELLED';
        needsUpdate = true;

        const hasActivePeriod = mem.current_period_end != null && new Date(mem.current_period_end) >= now;
        logger.info('Reconciled subscription cancellation from MP', {
          membership_id: mem.id,
          gateway_subscription_id: mem.gateway_subscription_id,
          gateway_status: 'canceled',
          paid_period_preserved: hasActivePeriod,
        });
      }

      // Caso 3: Divergencia de gateway_status
      if (sub.status !== mem.gateway_status && !updates.gateway_status) {
        updates.gateway_status = sub.status;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await supabase
          .from('memberships')
          .update(updates)
          .eq('id', mem.id);

        result.reconciledCount++;
      }
    } catch (err: any) {
      logger.warn('Failed to reconcile single membership with MP', {
        membership_id: mem.id,
        gateway_subscription_id: mem.gateway_subscription_id,
      }, err);
      result.errors.push({
        membershipId: mem.id,
        error: err.message || String(err),
      });
    }
  }

  return result;
}
