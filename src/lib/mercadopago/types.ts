/**
 * Tipos oficiales para la integración con Mercado Pago Subscriptions (Chile)
 * Referencia API oficial: /preapproval, /preapproval_plan, /authorized_payments, /v1/payments
 */

export type MercadoPagoGatewayStatus = 
  | 'pending'
  | 'authorized'
  | 'paused'
  | 'canceled' // Mercado Pago API usa estrictamente 'canceled' (1 'l')
  | 'rejected'
  | 'finished';

export type InternalMembershipStatus = 
  | 'PENDING_PAYMENT'
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED' // Base de datos interna usa 'CANCELLED' (2 'l')
  | 'EXPIRED';

export type CanonicalPaymentStatus = 
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'REFUNDED';

/**
 * Mapeo canónico explícito entre estado de Mercado Pago y estado interno
 */
export function mapGatewayToMembershipStatus(
  gatewayStatus: MercadoPagoGatewayStatus | string,
  isWithinTrialPeriod: boolean = false
): InternalMembershipStatus {
  switch (gatewayStatus) {
    case 'pending':
      return 'PENDING_PAYMENT';
    case 'authorized':
      return isWithinTrialPeriod ? 'TRIAL' : 'ACTIVE';
    case 'paused':
    case 'rejected':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELLED';
    case 'finished':
      return 'EXPIRED';
    default:
      return 'PENDING_PAYMENT';
  }
}

/**
 * Contrato oficial de creación de suscripción (/preapproval)
 */
export interface CreatePreapprovalPayload {
  payer_email: string;
  back_url: string;
  reason: string;
  external_reference: string; // UUID de la membresía en Supabase
  auto_recurring: {
    frequency: number;
    frequency_type: 'days' | 'months';
    transaction_amount: number;
    currency_id: 'CLP';
    free_trial?: {
      frequency: number;
      frequency_type: 'days' | 'months';
    };
  };
  status?: 'pending';
}

/**
 * Respuesta oficial de Mercado Pago para /preapproval
 */
export interface MercadoPagoPreapprovalResponse {
  id: string;
  payer_id: number;
  payer_email: string;
  back_url: string;
  collector_id: number;
  application_id: string;
  status: MercadoPagoGatewayStatus;
  reason: string;
  external_reference: string;
  date_created: string;
  last_modified: string;
  init_point: string;
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
    free_trial?: {
      frequency: number;
      frequency_type: string;
    };
  };
}

/**
 * Respuesta oficial de consulta de factura autorizada (/authorized_payments/{id})
 */
export interface MercadoPagoAuthorizedPaymentResponse {
  id: number | string;
  preapproval_id: string;
  type: string;
  status: string; // 'approved', 'rejected', etc.
  date_created: string;
  last_modified: string;
  transaction_amount: number;
  currency_id: string;
  payment?: {
    id: number | string;
    status: string;
    status_detail?: string;
  };
  external_reference?: string;
}

/**
 * Respuesta oficial de consulta de pago (/v1/payments/{id})
 */
export interface MercadoPagoPaymentResponse {
  id: number | string;
  date_created: string;
  date_approved?: string;
  date_last_updated: string;
  money_release_date?: string;
  payment_method_id: string;
  payment_type_id: string;
  status: string; // 'approved', 'rejected', 'in_process', etc.
  status_detail: string;
  currency_id: string;
  description: string;
  collector_id: number;
  payer: {
    id?: string;
    email: string;
  };
  transaction_amount: number;
  external_reference?: string;
  order?: {
    id?: string;
    type?: string;
  };
}

/**
 * Payload de notificación Webhook oficial de Mercado Pago
 */
export interface MercadoPagoWebhookPayload {
  id?: number | string;
  live_mode?: boolean;
  type?: 'subscription_preapproval' | 'subscription_authorized_payment' | 'payment' | string;
  topic?: string;
  date_created?: string;
  user_id?: string;
  api_version?: string;
  action?: string;
  data?: {
    id: string;
  };
}
