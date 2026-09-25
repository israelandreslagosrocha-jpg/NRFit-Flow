/**
 * Logger estructurado para el motor transaccional de Naty Entrenadora.
 * FASE M-09.3B: TraceContext y Propagación Segura de trace_id
 *
 * REGLAS ESTRICTAS DE SEGURIDAD Y PRIVACIDAD:
 * - Cero registro de correos electrónicos (payer_email, recipient_email).
 * - Cero registro de nombres, números de teléfono o RUT.
 * - Cero registro de datos sensibles de tarjetas (PAN, CVV, fecha expiración).
 * - Cero registro de tokens (MERCADOPAGO_ACCESS_TOKEN, bearer tokens, Flow SecretKey/apiKey), secretos o contraseñas.
 * - Toda correlación operativa se realiza mediante identificadores técnicos opacos:
 *   trace_id, membership_id, payment_transaction_id, payment_event_id, outbox_id,
 *   gateway_payment_id, gateway_subscription_id, result, duration_ms.
 */

import crypto from 'node:crypto';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * Contexto de trazabilidad y correlación E2E (TraceContext)
 * Requisitos M-09.3B:
 * - trace_id generado exclusivamente en backend vía crypto.randomUUID().
 * - Identificador técnico de correlación; no es token de auth, secreto ni idempotency key.
 */
export interface TraceContext {
  trace_id: string;
  event?: string;
  gateway?: string;
  membership_id?: string;
  payment_transaction_id?: string;
  payment_event_id?: string;
  outbox_id?: string;
  gateway_payment_id?: string;
  gateway_subscription_id?: string;
  result?: string;
  duration_ms?: number;
  [key: string]: any;
}

export interface StructuredLogPayload {
  timestamp: string;
  level: LogLevel;
  service: string;
  event: string;
  trace_id?: string;
  data: Record<string, any>;
  error?: string;
}

/**
 * Generador criptográficamente seguro de trace_id (UUID v4)
 */
export function generateTraceId(): string {
  return crypto.randomUUID();
}

/**
 * Lista canónica de campos de correlación permitidos en logs operacionales
 */
export const ALLOWED_CORRELATION_FIELDS = [
  'trace_id',
  'event',
  'gateway',
  'membership_id',
  'payment_transaction_id',
  'payment_event_id',
  'outbox_id',
  'gateway_payment_id',
  'gateway_subscription_id',
  'result',
  'duration_ms',
] as const;

/**
 * Sanitiza recursivamente cadenas, objetos y arreglos para suprimir PII, PAN y secretos.
 */
export function sanitizeValue(val: any): any {
  if (val == null) return val;

  if (typeof val === 'string') {
    let sanitized = val;
    // Sustituir patrones sensibles
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
    sanitized = sanitized.replace(/(?:TEST|APP_USR)-[a-zA-Z0-9_-]{10,}/g, '[REDACTED_TOKEN]');
    sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_BEARER]');
    sanitized = sanitized.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_PAN]');
    sanitized = sanitized.replace(/\b\d{1,2}(?:\.?\d{3}){2}-[\dkK]\b/g, '[REDACTED_RUT]');
    return sanitized;
  }

  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }

  if (typeof val === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      const keyLower = k.toLowerCase();
      // Omitir o redactar explícitamente llaves con nombres sensibles
      if (
        keyLower.includes('email') ||
        keyLower.includes('payer') ||
        keyLower.includes('token') ||
        keyLower.includes('secret') ||
        keyLower.includes('password') ||
        keyLower.includes('pass') ||
        keyLower.includes('cvv') ||
        keyLower.includes('card_number') ||
        keyLower.includes('pan') ||
        keyLower.includes('rut') ||
        keyLower.includes('phone') ||
        keyLower.includes('nombre') ||
        keyLower.includes('full_name') ||
        keyLower.includes('apikey') ||
        keyLower.includes('api_key') ||
        keyLower.includes('cookie') ||
        keyLower.includes('session') ||
        keyLower.includes('authorization') ||
        keyLower.includes('headers') ||
        keyLower.includes('request') ||
        keyLower.includes('env')
      ) {
        cleanObj[k] = '[REDACTED]';
      } else {
        cleanObj[k] = sanitizeValue(v);
      }
    }
    return cleanObj;
  }

  return val;
}

/**
 * Filtra los datos de correlación permitidos eliminando objetos crudos
 * y garantizando estricta sanitización.
 */
export function sanitizeTraceData(data: Record<string, any>): Record<string, any> {
  const sanitized = sanitizeValue(data) || {};
  const result: Record<string, any> = {};

  for (const [k, v] of Object.entries(sanitized)) {
    // Si es un objeto crudo de request, header o env, excluir
    if (k === 'headers' || k === 'request' || k === 'env' || k === 'req') {
      continue;
    }
    result[k] = v;
  }

  return result;
}

/**
 * Genera el log estructurado en formato JSON.
 */
export function formatLog(
  level: LogLevel,
  event: string,
  data: Record<string, any> = {},
  error?: any
): StructuredLogPayload {
  const sanitizedData = sanitizeTraceData(data);
  const traceId = data.trace_id || sanitizedData.trace_id;

  const payload: StructuredLogPayload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'payments-engine',
    event,
    data: sanitizedData,
  };

  if (traceId) {
    payload.trace_id = traceId;
  }

  if (error) {
    payload.error = typeof error === 'string' ? sanitizeValue(error) : sanitizeValue(error.message || String(error));
  }

  return payload;
}

export const logger = {
  info(event: string, data?: Record<string, any>) {
    const entry = formatLog('INFO', event, data);
    console.log(JSON.stringify(entry));
    return entry;
  },

  warn(event: string, data?: Record<string, any>, error?: any) {
    const entry = formatLog('WARN', event, data, error);
    console.warn(JSON.stringify(entry));
    return entry;
  },

  error(event: string, data?: Record<string, any>, error?: any) {
    const entry = formatLog('ERROR', event, data, error);
    console.error(JSON.stringify(entry));
    return entry;
  },

  debug(event: string, data?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      const entry = formatLog('DEBUG', event, data);
      console.debug(JSON.stringify(entry));
      return entry;
    }
    return null;
  },

  /**
   * Crea un sub-logger contextual anclado a un TraceContext específico
   */
  withTrace(context: TraceContext) {
    return {
      info: (event: string, extra?: Record<string, any>) =>
        logger.info(event, { ...context, ...extra }),
      warn: (event: string, extra?: Record<string, any>, err?: any) =>
        logger.warn(event, { ...context, ...extra }, err),
      error: (event: string, extra?: Record<string, any>, err?: any) =>
        logger.error(event, { ...context, ...extra }, err),
      debug: (event: string, extra?: Record<string, any>) =>
        logger.debug(event, { ...context, ...extra }),
    };
  },
};
