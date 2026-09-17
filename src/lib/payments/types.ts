/**
 * Tipos e interfaces neutrales de pasarela de pago (Fase M-09R)
 * Permite desacoplar el dominio de suscripciones de proveedores específicos (Flow Chile, Mercado Pago, etc.)
 */

export type GatewayChargeMode = 'AUTOMATIC_RECURRING' | 'SUBSCRIPTION_PAYMENT_LINK';

export interface CreateCustomerInput {
  email: string;
  name: string;
  externalId: string; // student.id (identidad persistente y estable de la alumna)
}

export interface GatewayCustomer {
  id: string; // customerId en pasarela
  email: string;
  name: string;
  externalId: string;
}

export interface RegisterPaymentMethodInput {
  customerId: string;
  returnUrl: string;
}

export interface RegisterPaymentMethodOutput {
  url: string;
  token: string;
  redirectUrl: string;
}

export interface PaymentMethodStatus {
  status: number; // 1 = registrada/vinculada exitosamente, 0 = no registrada
  customerId: string;
  creditCardType?: string;
  last4CardDigits?: string;
}

export interface CreateSubscriptionInput {
  planId: string;
  customerId: string;
  trialPeriodDays?: number;
  subscriptionStart?: string;
}

export interface GatewaySubscription {
  id: string; // subscriptionId
  planId: string;
  customerId: string;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  rawStatus: number;
  morose: number; // 0 = sin mora, 1 = invoice vencido, 2 = invoice pendiente pero no vencido
}

export interface GatewayPaymentResult {
  paymentId: string;
  subscriptionId?: string;
  customerId?: string;
  amount: number;
  currency: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  paymentDate: string;
  paymentMethod?: string;
  raw?: any;
}

export interface GatewayCallbackResult {
  resourceType: 'subscription' | 'invoice' | 'payment' | 'unknown';
  subscription?: GatewaySubscription;
  payment?: GatewayPaymentResult;
  raw?: any;
}

export interface PaymentGateway {
  readonly name: string;
  readonly mode: GatewayChargeMode;

  createCustomer(params: CreateCustomerInput): Promise<GatewayCustomer>;
  registerPaymentMethod(params: RegisterPaymentMethodInput): Promise<RegisterPaymentMethodOutput>;
  getPaymentMethodStatus(token: string): Promise<PaymentMethodStatus>;
  createSubscription(params: CreateSubscriptionInput): Promise<GatewaySubscription>;
  getSubscription(subscriptionId: string): Promise<GatewaySubscription>;
  cancelSubscription(subscriptionId: string, atPeriodEnd?: boolean): Promise<GatewaySubscription>;
  resolveCallback(token: string, resourceHint?: string): Promise<GatewayCallbackResult>;
}
