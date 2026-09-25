/**
 * FASE M-09.3C: SERVICIO DE AUDITORÍA DE SEGURIDAD Y EVENTOS ADMINISTRATIVOS
 * Naty Entrenadora - Registro Append-Only Inmutable y Sanitización Estricta
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const MAX_AUDIT_METADATA_BYTES = 8192;

/**
 * Claves sensibles prohibidas en registros de auditoría
 */
export const SENSITIVE_AUDIT_KEYS = new Set([
  'password',
  'passwd',
  'token',
  'secret',
  'secretkey',
  'apikey',
  'api_key',
  'flow_secret_key',
  'flow_api_key',
  'service_role_key',
  'authorization',
  'cookie',
  'cookies',
  'smtp_pass',
  'smtp_user',
  'creditcard',
  'pan',
  'cvv',
  'cvc',
  'cardnumber',
]);

export interface SecurityAuditEventInput {
  eventType: string;
  actorProfileId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  traceId?: string | null;
  result: 'SUCCESS' | 'DENIED' | 'ERROR';
  metadata?: Record<string, any>;
}

export interface SecurityAuditEventResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Calcula el tamaño en bytes de una cadena codificada en UTF-8
 */
export function getUtf8ByteLength(str: string): number {
  return Buffer.byteLength(str, 'utf8');
}

/**
 * Sanitiza recursivamente un valor para eliminar secretos, PII y limitar tamaño UTF-8
 */
export function sanitizeAuditValue(key: string, val: any): any {
  if (val === null || val === undefined) return val;

  const lowerKey = key.toLowerCase();
  if (SENSITIVE_AUDIT_KEYS.has(lowerKey)) {
    return '[REDACTED_SECRET]';
  }

  if (typeof val === 'string') {
    // Redactar tokens JWT o Bearer
    if (val.startsWith('Bearer ') || val.startsWith('eyJh') || val.length > 200 && /^[a-zA-Z0-9_\-\.]+$/.test(val)) {
      if (lowerKey.includes('auth') || lowerKey.includes('token') || lowerKey.includes('key')) {
        return '[REDACTED_TOKEN]';
      }
    }
    // Redactar números de tarjeta (PAN de 13 a 19 dígitos)
    if (/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}$/.test(val)) {
      return '[REDACTED_PAN]';
    }
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((item, idx) => sanitizeAuditValue(`${key}_${idx}`, item));
  }

  if (typeof val === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      cleanObj[k] = sanitizeAuditValue(k, v);
    }
    return cleanObj;
  }

  return val;
}

/**
 * Sanitiza la metadata de auditoría y garantiza estrictamente que su
 * representación serializada en UTF-8 no exceda los 8192 bytes.
 *
 * Contrato Único M-09.3C:
 * 1. Purgar secretos y PII sensible.
 * 2. Si el JSON serializado supera 8192 bytes, truncar campos extensos de forma determinista
 *    hasta que Buffer.byteLength(json, 'utf8') <= 8192.
 */
export function sanitizeAuditMetadata(metadata?: Record<string, any>): Record<string, any> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  // 1. Sanitizar claves y valores sensibles
  let clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(metadata)) {
    clean[k] = sanitizeAuditValue(k, v);
  }

  let jsonStr = JSON.stringify(clean);
  if (getUtf8ByteLength(jsonStr) <= MAX_AUDIT_METADATA_BYTES) {
    return clean;
  }

  // 2. Si excede 8192 bytes, truncar campos de texto extensos y arrays
  const budget = MAX_AUDIT_METADATA_BYTES - 200; // Margen de seguridad para overhead JSON
  for (const [k, v] of Object.entries(clean)) {
    if (typeof v === 'string' && getUtf8ByteLength(v) > 256) {
      // Recortar string respetando límite de caracteres
      let truncated = v.slice(0, 100) + '... [TRUNCATED_UTF8]';
      clean[k] = truncated;
    } else if (Array.isArray(v) && v.length > 5) {
      clean[k] = v.slice(0, 3).concat([`[TRUNCATED: ${v.length - 3} items omitted]`]);
    }
    jsonStr = JSON.stringify(clean);
    if (getUtf8ByteLength(jsonStr) <= budget) {
      break;
    }
  }

  // 3. Salvaguarda final: si aún supera el límite, generar objeto de fallback con tamaño garantizado
  if (getUtf8ByteLength(JSON.stringify(clean)) > MAX_AUDIT_METADATA_BYTES) {
    clean = {
      _warning: 'PAYLOAD_OVERSIZED_TRUNCATED',
      _byte_length_original: getUtf8ByteLength(JSON.stringify(metadata)),
      summary: 'Metadata excedió el límite máximo de 8192 bytes UTF-8 y fue compactada.',
      keys_present: Object.keys(metadata).slice(0, 10),
    };
  }

  return clean;
}

/**
 * Cliente Supabase de servidor con privilegios service_role
 */
let serviceClientInstance: SupabaseClient | null = null;

export function getServiceSupabaseClient(): SupabaseClient {
  if (serviceClientInstance) return serviceClientInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wqsmimxjnfanrenlhdgx.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  serviceClientInstance = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceClientInstance;
}

/**
 * Registra un evento de auditoría de seguridad en public.security_audit_events
 * utilizando client backend privilegiado y metadata sanitizada.
 */
export async function recordSecurityAuditEvent(
  input: SecurityAuditEventInput,
  customClient?: SupabaseClient
): Promise<SecurityAuditEventResult> {
  const client = customClient || getServiceSupabaseClient();
  const sanitizedMeta = sanitizeAuditMetadata(input.metadata);

  // Verificación adicional de contrato antes de persistir
  const byteSize = getUtf8ByteLength(JSON.stringify(sanitizedMeta));
  if (byteSize > MAX_AUDIT_METADATA_BYTES) {
    return {
      success: false,
      error: `AUDIT_CONTRACT_VIOLATION: Metadata size (${byteSize} bytes) exceeds limit of ${MAX_AUDIT_METADATA_BYTES} bytes`,
    };
  }

  try {
    const { data, error } = await client
      .from('security_audit_events')
      .insert({
        event_type: input.eventType,
        actor_profile_id: input.actorProfileId || null,
        target_type: input.targetType || null,
        target_id: input.targetId || null,
        trace_id: input.traceId || null,
        result: input.result,
        metadata: sanitizedMeta,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
