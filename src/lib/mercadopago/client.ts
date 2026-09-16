import type {
  CreatePreapprovalPayload,
  MercadoPagoPreapprovalResponse,
  MercadoPagoAuthorizedPaymentResponse,
  MercadoPagoPaymentResponse
} from './types.ts';

const MP_API_BASE = 'https://api.mercadopago.com';

function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    // Si no está definido en variables de entorno, permitimos operar en test/dev
    return 'TEST-ACCESS-TOKEN-MOCK';
  }
  return token;
}

/**
 * Crea una suscripción mensual con 7 días de prueba gratuita en Mercado Pago Chile (/preapproval)
 * Oficial: auto_recurring.free_trial: { frequency: 7, frequency_type: 'days' }, $25.000 CLP
 * external_reference: ID único de correlación con la membresía en Supabase (NO es garantía contractual de idempotencia).
 * REGLA: No enviar X-Idempotency-Key (no documentado para /preapproval en la API oficial de Mercado Pago).
 */
export async function createSubscription(params: {
  email: string;
  membershipId: string;
  returnUrl: string;
}): Promise<MercadoPagoPreapprovalResponse> {
  const payload: CreatePreapprovalPayload = {
    payer_email: params.email,
    back_url: params.returnUrl,
    reason: 'Membresía Mensual Team Naty',
    external_reference: params.membershipId,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 25000,
      currency_id: 'CLP',
      free_trial: {
        frequency: 7,
        frequency_type: 'days',
      },
    },
    status: 'pending',
  };

  const response = await fetch(`${MP_API_BASE}/preapproval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error en Mercado Pago createSubscription (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Consulta el estado actual de una suscripción (/preapproval/{id})
 */
export async function getSubscription(preapprovalId: string): Promise<MercadoPagoPreapprovalResponse> {
  const response = await fetch(`${MP_API_BASE}/preapproval/${preapprovalId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error en Mercado Pago getSubscription (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Cancela una suscripción en Mercado Pago.
 * REGLA ESTRICTA DE MERCADO PAGO: el body exige { "status": "canceled" } (1 'l')
 */
export async function cancelSubscription(preapprovalId: string): Promise<MercadoPagoPreapprovalResponse> {
  const response = await fetch(`${MP_API_BASE}/preapproval/${preapprovalId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      status: 'canceled', // Convención oficial de la API de Mercado Pago
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error en Mercado Pago cancelSubscription (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Consulta una factura autorizada de suscripción (/authorized_payments/{id})
 */
export async function getAuthorizedPayment(authorizedPaymentId: string | number): Promise<MercadoPagoAuthorizedPaymentResponse> {
  const response = await fetch(`${MP_API_BASE}/authorized_payments/${authorizedPaymentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error en Mercado Pago getAuthorizedPayment (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Consulta un pago individual (/v1/payments/{id})
 */
export async function getPayment(paymentId: string | number): Promise<MercadoPagoPaymentResponse> {
  const response = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error en Mercado Pago getPayment (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * RESOLUCIÓN DE PAGO CANÓNICO (Deduplicación Cross-Topic: Caso J)
 * Mercado Pago emite notificaciones por subscription_authorized_payment y por payment.
 * Esta función consulta el recurso correspondiente en Mercado Pago y resuelve:
 * - canonicalPaymentId (ID único e inequívoco de la transacción económica)
 * - externalReference (ID de membresía asociado)
 * - status (estado real confirmado por Mercado Pago)
 * - amount y currency
 */
export async function resolveCanonicalPayment(
  topicOrType: string,
  resourceId: string
): Promise<{
  canonicalPaymentId: string;
  externalReference?: string;
  preapprovalId?: string;
  status: string;
  amount: number;
  currency: string;
}> {
  if (topicOrType === 'subscription_authorized_payment') {
    const authPayment = await getAuthorizedPayment(resourceId);
    
    // Si la factura autorizada contiene el objeto payment anidado con su ID,
    // ese ID es el pago canónico subyacente. De lo contrario, se usa el ID de la factura.
    const canonicalPaymentId = authPayment.payment?.id 
      ? String(authPayment.payment.id) 
      : String(authPayment.id);

    return {
      canonicalPaymentId,
      externalReference: authPayment.external_reference,
      preapprovalId: authPayment.preapproval_id,
      status: authPayment.status,
      amount: authPayment.transaction_amount,
      currency: authPayment.currency_id || 'CLP',
    };
  } else if (topicOrType === 'payment') {
    const payment = await getPayment(resourceId);

    return {
      canonicalPaymentId: String(payment.id),
      externalReference: payment.external_reference,
      status: payment.status,
      amount: payment.transaction_amount,
      currency: payment.currency_id || 'CLP',
    };
  }

  throw new Error(`Tipo de recurso no soportado para cobros financieros: ${topicOrType}`);
}
