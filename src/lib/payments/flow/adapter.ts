import { FlowClient } from './client.ts';
import type {
  PaymentGateway,
  GatewayChargeMode,
  CreateCustomerInput,
  GatewayCustomer,
  RegisterPaymentMethodInput,
  RegisterPaymentMethodOutput,
  PaymentMethodStatus,
  CreateSubscriptionInput,
  GatewaySubscription,
  GatewayCallbackResult,
  GatewayPaymentResult,
} from '../types.ts';

export class FlowGatewayAdapter implements PaymentGateway {
  readonly name = 'FLOW';
  readonly mode: GatewayChargeMode;
  private client: FlowClient;

  constructor(client?: FlowClient) {
    this.client = client || new FlowClient();
    const isAutoCharge = process.env.FLOW_AUTOMATIC_CHARGE_ENABLED === 'true';
    this.mode = isAutoCharge ? 'AUTOMATIC_RECURRING' : 'SUBSCRIPTION_PAYMENT_LINK';
  }

  async createCustomer(params: CreateCustomerInput): Promise<GatewayCustomer> {
    const res = await this.client.createCustomer({
      name: params.name,
      email: params.email,
      externalId: params.externalId, // student.id (1:1 persistente)
    });

    return {
      id: res.customerId,
      email: params.email,
      name: params.name,
      externalId: params.externalId,
    };
  }

  async registerPaymentMethod(params: RegisterPaymentMethodInput): Promise<RegisterPaymentMethodOutput> {
    const res = await this.client.registerCustomer({
      customerId: params.customerId,
      url_return: params.returnUrl,
    });

    return {
      url: res.url,
      token: res.token,
      redirectUrl: `${res.url}?token=${res.token}`,
    };
  }

  async getPaymentMethodStatus(token: string): Promise<PaymentMethodStatus> {
    const res = await this.client.getRegisterStatus(token);
    return {
      status: Number(res.status),
      customerId: res.customerId,
      creditCardType: res.creditCardType,
      last4CardDigits: res.last4CardDigits,
    };
  }

  async createSubscription(params: CreateSubscriptionInput): Promise<GatewaySubscription> {
    const res = await this.client.createSubscription({
      planId: params.planId,
      customerId: params.customerId,
      trial_period_days: params.trialPeriodDays ?? 7,
      subscription_start: params.subscriptionStart,
      periods_number: 0,
    });

    return this.mapFlowSubscription(res);
  }

  async getSubscription(subscriptionId: string): Promise<GatewaySubscription> {
    const res = await this.client.getSubscription(subscriptionId);
    return this.mapFlowSubscription(res);
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = true): Promise<GatewaySubscription> {
    const res = await this.client.cancelSubscription(subscriptionId, atPeriodEnd ? 1 : 0);
    return {
      id: res.subscriptionId,
      planId: '',
      customerId: '',
      status: res.status === 4 ? 'CANCELLED' : 'ACTIVE',
      cancelAtPeriodEnd: res.cancel_at_period_end === 1,
      rawStatus: res.status,
      morose: 0,
    };
  }

  /**
   * Resolución de callbacks S2S desacoplada por tipo de recurso.
   * NO asume que todo evento es un pago ordinario (/payment/getStatus).
   */
  async resolveCallback(token: string, resourceHint?: string): Promise<GatewayCallbackResult> {
    // 1. Si el hint indica suscripción o es un subscriptionId
    if (resourceHint === 'subscription' || token.startsWith('sub_') || token.startsWith('sus_')) {
      const sub = await this.client.getSubscription(token);
      return {
        resourceType: 'subscription',
        subscription: this.mapFlowSubscription(sub),
        raw: sub,
      };
    }

    // 2. Si el hint indica invoice o el identificador es numérico de invoice
    if (resourceHint === 'invoice' || /^\d+$/.test(token)) {
      const inv = await this.client.getInvoice(Number(token));
      let status: 'APPROVED' | 'REJECTED' | 'PENDING' = 'PENDING';
      if (inv.status === 1) status = 'APPROVED';
      else if (inv.status === 2) status = 'REJECTED';

      const paymentResult: GatewayPaymentResult = {
        paymentId: `flow_inv_${inv.id}`,
        subscriptionId: inv.subscriptionId,
        customerId: inv.customerId,
        amount: Number(inv.amount),
        currency: inv.currency || 'CLP',
        status,
        paymentDate: inv.payment?.date || new Date().toISOString(),
        paymentMethod: inv.payment?.media || 'FLOW_INVOICE',
        raw: inv,
      };

      return {
        resourceType: 'invoice',
        payment: paymentResult,
        raw: inv,
      };
    }

    // 3. Consulta de pago estándar por token de transacción
    try {
      const pay = await this.client.getPaymentStatus(token);
      let status: 'APPROVED' | 'REJECTED' | 'PENDING' = 'PENDING';
      if (pay.status === 2) status = 'APPROVED';
      else if (pay.status === 3 || pay.status === 4) status = 'REJECTED';

      const paymentResult: GatewayPaymentResult = {
        paymentId: `flow_pay_${pay.flowOrder}`,
        amount: Number(pay.amount),
        currency: pay.currency || 'CLP',
        status,
        paymentDate: pay.paymentData?.date || pay.requestDate || new Date().toISOString(),
        paymentMethod: pay.paymentData?.media || 'FLOW_WEBPAY',
        raw: pay,
      };

      return {
        resourceType: 'payment',
        payment: paymentResult,
        raw: pay,
      };
    } catch {
      // Si la consulta de pago falla, intentar como suscripción como fallback controlado
      try {
        const sub = await this.client.getSubscription(token);
        return {
          resourceType: 'subscription',
          subscription: this.mapFlowSubscription(sub),
          raw: sub,
        };
      } catch {
        return {
          resourceType: 'unknown',
          raw: { token, resourceHint },
        };
      }
    }
  }

  private mapFlowSubscription(flowSub: any): GatewaySubscription {
    let domainStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

    // Regla de negocio de Morosidad Flow:
    // morose = 1: Uno o más invoices vencidos -> PAST_DUE (falla cerrada)
    // morose = 2: Uno o más invoices pendientes pero no vencidos -> No forzar PAST_DUE
    if (flowSub.morose === 1) {
      domainStatus = 'PAST_DUE';
    } else if (flowSub.status === 2) {
      domainStatus = 'TRIAL';
    } else if (flowSub.status === 1) {
      domainStatus = 'ACTIVE';
    } else if (flowSub.status === 4) {
      domainStatus = 'CANCELLED';
    } else {
      domainStatus = 'CANCELLED';
    }

    return {
      id: flowSub.subscriptionId,
      planId: flowSub.planId,
      customerId: flowSub.customerId,
      status: domainStatus,
      trialEndsAt: flowSub.trial_end,
      currentPeriodStart: flowSub.period_start,
      currentPeriodEnd: flowSub.period_end,
      cancelAtPeriodEnd: flowSub.cancel_at_period_end === 1,
      rawStatus: flowSub.status,
      morose: flowSub.morose ?? 0,
    };
  }
}
