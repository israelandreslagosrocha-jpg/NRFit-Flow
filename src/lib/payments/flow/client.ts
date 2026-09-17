import crypto from 'crypto';

/**
 * Cliente Oficial de Flow Chile API v7 (Sandbox / Staging)
 * Implementa firma criptográfica HMAC-SHA256 y salvaguardas activas anti-producción.
 */

export interface FlowConfig {
  apiKey: string;
  secretKey: string;
  baseUrl?: string;
  env?: string;
}

export function getFlowConfig(): FlowConfig {
  return {
    apiKey: process.env.FLOW_API_KEY || 'MOCK_FLOW_API_KEY',
    secretKey: process.env.FLOW_SECRET_KEY || 'MOCK_FLOW_SECRET_KEY',
    baseUrl: process.env.FLOW_BASE_URL || 'https://sandbox.flow.cl/api',
    env: process.env.FLOW_ENV || 'sandbox',
  };
}

/**
 * Salvaguarda activa en runtime: Aborta de forma determinista ante cualquier intento
 * de invocar endpoints productivos de Flow o variables que no sean de sandbox en Fase M-09R.
 */
export function assertSandboxGuard(url: string, envName?: string) {
  const currentEnv = envName || process.env.FLOW_ENV || 'sandbox';
  const isProdUrl = url.includes('www.flow.cl') || (!url.includes('sandbox.flow.cl') && !url.includes('localhost') && !url.includes('127.0.0.1'));

  if (isProdUrl || currentEnv !== 'sandbox') {
    throw new Error(
      'ABORT_PRODUCTION_GUARD: Cobros reales y endpoints productivos de Flow bloqueados en Fase M-09R. Exclusivo sandbox.flow.cl'
    );
  }
}

/**
 * Algoritmo oficial de firma Flow Chile:
 * 1. Ordena las claves alfabéticamente (ASCII).
 * 2. Concatena cada clave y su valor sin separadores (key1value1key2value2...).
 * 3. Aplica HMAC-SHA256 con el secretKey y formatea a hexadecimal en minúsculas.
 */
export function signFlowParams(params: Record<string, any>, secretKey: string): string {
  const keys = Object.keys(params)
    .filter(k => k !== 's' && params[k] !== undefined && params[k] !== null)
    .sort();

  let stringToSign = '';
  for (const k of keys) {
    stringToSign += `${k}${params[k]}`;
  }

  return crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex').toLowerCase();
}

/**
 * Verificación criptográfica segura en tiempo constante de firmas Flow recibidas
 */
export function verifyFlowSignature(params: Record<string, any>, signature: string, secretKey: string): boolean {
  if (!signature || !secretKey) return false;
  const computed = signFlowParams(params, secretKey);
  const sigBuf = Buffer.from(signature.toLowerCase());
  const compBuf = Buffer.from(computed);

  if (sigBuf.length !== compBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, compBuf);
}

export class FlowClient {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private env: string;

  constructor(config?: Partial<FlowConfig>) {
    const defaultCfg = getFlowConfig();
    this.apiKey = config?.apiKey || defaultCfg.apiKey;
    this.secretKey = config?.secretKey || defaultCfg.secretKey;
    this.baseUrl = config?.baseUrl || defaultCfg.baseUrl || 'https://sandbox.flow.cl/api';
    this.env = config?.env || defaultCfg.env || 'sandbox';

    assertSandboxGuard(this.baseUrl, this.env);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T = any>(
    method: 'GET' | 'POST',
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    assertSandboxGuard(this.baseUrl, this.env);

    const payloadWithAuth: Record<string, any> = {
      apiKey: this.apiKey,
      ...params,
    };

    // Añadir firma criptográfica obligatoria
    const signature = signFlowParams(payloadWithAuth, this.secretKey);
    payloadWithAuth.s = signature;

    let url = `${this.baseUrl}${endpoint}`;
    let fetchOptions: RequestInit;

    if (method === 'GET') {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(payloadWithAuth)) {
        if (v !== undefined && v !== null) {
          searchParams.append(k, String(v));
        }
      }
      url = `${url}?${searchParams.toString()}`;
      fetchOptions = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      };
    } else {
      const body = new URLSearchParams();
      for (const [k, v] of Object.entries(payloadWithAuth)) {
        if (v !== undefined && v !== null) {
          body.append(k, String(v));
        }
      }
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: body.toString(),
      };
    }

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      let errorBody: any = {};
      try {
        errorBody = await res.json();
      } catch {
        errorBody = { message: res.statusText };
      }
      throw new Error(`Flow API Error [${res.status}]: ${errorBody.message || JSON.stringify(errorBody)}`);
    }

    return (await res.json()) as T;
  }

  // --- Planes ---
  async createPlan(params: {
    planId: string;
    name: string;
    amount: number;
    currency?: string;
    interval?: number; // 3 = mensual
    interval_count?: number; // 1
    trial_period_days?: number; // 7
    periods_number?: number; // 0 = indefinido
    urlCallback?: string;
    days_until_due?: number;
  }) {
    return this.request('POST', '/plans/create', {
      planId: params.planId,
      name: params.name,
      amount: params.amount,
      currency: params.currency || 'CLP',
      interval: params.interval ?? 3,
      interval_count: params.interval_count ?? 1,
      trial_period_days: params.trial_period_days ?? 7,
      periods_number: params.periods_number ?? 0,
      urlCallback: params.urlCallback,
      days_until_due: params.days_until_due ?? 3,
    });
  }

  async getPlan(planId: string) {
    return this.request<{
      planId: string;
      name: string;
      currency: string;
      amount: number;
      interval: number;
      interval_count: number;
      created: string;
      trial_period_days: number;
      days_until_due: number;
      periods_number: number;
      urlCallback?: string;
      status?: number;
    }>('GET', '/plans/get', { planId });
  }

  async listPlans(params?: { start?: number; limit?: number; filter?: string; status?: number }) {
    return this.request<{
      total: number;
      hasMore: boolean;
      data: Array<{
        planId: string;
        name: string;
        currency: string;
        amount: number;
        interval: number;
        interval_count: number;
        trial_period_days: number;
        periods_number: number;
      }>;
    }>('GET', '/plans/list', params || {});
  }

  // --- Clientes ---
  async createCustomer(params: {
    name: string;
    email: string;
    externalId: string; // student.id (identidad persistente y estable de la alumna)
  }) {
    return this.request<{ customerId: string; created: string; status: string }>('POST', '/customer/create', params);
  }

  async getCustomer(customerId: string) {
    return this.request<{
      customerId: string;
      created: string;
      email: string;
      name: string;
      pay_mode?: string;
      creditCardType?: string;
      last4CardDigits?: string;
      externalId: string;
      status: string;
      registerDate?: string;
    }>('GET', '/customer/get', { customerId });
  }

  // --- Registro de Tarjetas (Webpay Enrolment) ---
  async registerCustomer(params: { customerId: string; url_return: string }) {
    return this.request<{ url: string; token: string }>('POST', '/customer/register', params);
  }

  async getRegisterStatus(token: string) {
    return this.request<{
      status: number; // 1 = registrada, 0 = no registrada
      customerId: string;
      creditCardType?: string;
      last4CardDigits?: string;
    }>('GET', '/customer/getRegisterStatus', { token });
  }

  // --- Suscripciones ---
  async createSubscription(params: {
    planId: string;
    customerId: string;
    trial_period_days?: number;
    subscription_start?: string;
    periods_number?: number;
  }) {
    return this.request<{
      subscriptionId: string;
      planId: string;
      plan_name?: string;
      customerId: string;
      created: string;
      subscription_start: string;
      subscription_end?: string | null;
      period_start: string;
      period_end: string;
      next_invoice_date?: string | null;
      trial_period_days?: number;
      trial_start?: string | null;
      trial_end?: string | null;
      status: number; // 0=inactiva, 1=activa, 2=trial, 4=cancelada
      morose: number; // 0=al día, 1=vencido, 2=pendiente no vencido
      cancel_at_period_end: number;
      cancel_at?: string | null;
      invoices?: Array<{
        id: number;
        subscriptionId?: string;
        customerId?: string;
        amount: number | string;
        status: number;
        due_date: string;
        paymentLink?: string | null;
      }>;
    }>('POST', '/subscription/create', {
      planId: params.planId,
      customerId: params.customerId,
      trial_period_days: params.trial_period_days ?? 7,
      subscription_start: params.subscription_start,
      periods_number: params.periods_number ?? 0,
    });
  }

  async getSubscription(subscriptionId: string) {
    return this.request<{
      subscriptionId: string;
      planId: string;
      plan_name?: string;
      customerId: string;
      created: string;
      subscription_start: string;
      subscription_end?: string | null;
      period_start: string;
      period_end: string;
      next_invoice_date?: string | null;
      trial_period_days?: number;
      trial_start?: string | null;
      trial_end?: string | null;
      status: number;
      morose: number;
      cancel_at_period_end: number;
      cancel_at?: string | null;
      invoices?: Array<{
        id: number;
        subscriptionId?: string;
        customerId?: string;
        amount: number | string;
        status: number;
        due_date: string;
        paymentLink?: string | null;
      }>;
    }>('GET', '/subscription/get', { subscriptionId });
  }

  async cancelSubscription(subscriptionId: string, at_period_end: number = 1) {
    return this.request<{
      subscriptionId: string;
      status: number;
      cancel_at_period_end: number;
      cancel_at?: string;
    }>('POST', '/subscription/cancel', {
      subscriptionId,
      at_period_end,
    });
  }

  // --- Consultas de Facturas y Pagos ---
  async getInvoice(invoiceId: number) {
    return this.request<{
      id: number;
      subscriptionId: string;
      customerId: string;
      amount: number;
      currency: string;
      status: number; // 0 impago, 1 pagado, 2 anulado
      due_date: string;
      paymentLink?: string;
      payment?: any;
    }>('GET', '/invoice/get', { invoiceId });
  }

  async getPaymentStatus(token: string) {
    return this.request<{
      flowOrder: number;
      commerceOrder: string;
      requestDate: string;
      status: number; // 1 pendiente, 2 pagada, 3 rechazada, 4 anulada
      subject: string;
      currency: string;
      amount: number;
      payer: string;
      optional?: string;
      paymentData?: {
        date: string;
        media: string;
        fee: number;
      };
    }>('GET', '/payment/getStatus', { token });
  }
}
