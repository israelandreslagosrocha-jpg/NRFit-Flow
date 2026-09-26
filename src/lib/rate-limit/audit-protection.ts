import { logger, sanitizeValue } from '../logger.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * FASE M-09.3E: PROTECCIÓN ANTI-DOS DEL SISTEMA DE AUDITORÍA
 * 
 * Regla Crítica:
 * PROHIBIDO insertar un registro en security_audit_events por cada petición limitada.
 * Si cada 429 escribiera en PostgreSQL, un atacante convertiría el rate limiting
 * en una amplificación de escrituras (write-amplification attack) contra la base de datos.
 * 
 * Estrategia de defensa:
 * 1. Peticiones limitadas ordinarias: Exclusivamente métricas y structured logs en stdout.
 * 2. Auditoría en DB: Únicamente bajo muestreo estricto o cuando se supera un umbral crítico
 *    de flood masivo (ej. > 50 intentos bloqueados por el mismo actor).
 * 3. Sanitización estricta: Jamás persistir IP cruda, tokens de Flow, headers de autorización ni cookies.
 */

// Contador en memoria para muestreo y umbrales de alerta crítica
const floodCounters: Map<string, { count: number; lastLoggedAtMs: number }> = new Map();
const CRITICAL_FLOOD_THRESHOLD = 50;
const FLOOD_WINDOW_MS = 60 * 1000;

export interface RateLimitAuditOptions {
  namespace: string;
  keyHash: string;
  limit: number;
  supabase?: SupabaseClient | null;
  traceId?: string | null;
  extraMeta?: Record<string, any>;
}

/**
 * Procesa un evento de límite excedido.
 * Garantiza que peticiones normales bloqueadas NO generen escrituras directas en la base de datos.
 */
export async function handleRateLimitHit(options: RateLimitAuditOptions): Promise<boolean> {
  const { namespace, keyHash, limit, supabase, traceId, extraMeta } = options;
  const nowMs = Date.now();

  // 1. Registro estructurado en logs (stdout / streaming de observabilidad, sin write en DB)
  logger.warn('rate_limit_exceeded', {
    trace_id: traceId || undefined,
    namespace,
    key_hash: keyHash, // Ya anonimizada (no PII, no IP cruda)
    limit,
    status: 'LIMITED',
    meta: sanitizeValue(extraMeta || {}),
  });

  // 2. Control de umbral para prevenir write-amplification
  const floodKey = `${namespace}:${keyHash}`;
  let tracker = floodCounters.get(floodKey);

  if (!tracker || nowMs - tracker.lastLoggedAtMs > FLOOD_WINDOW_MS) {
    tracker = { count: 1, lastLoggedAtMs: nowMs };
    floodCounters.set(floodKey, tracker);
    return false; // No se escribe en DB en peticiones normales
  }

  tracker.count += 1;

  // Solo si se supera el umbral crítico de flood masivo Y existe cliente Supabase,
  // se registra 1 evento agregado para el equipo de seguridad
  if (tracker.count === CRITICAL_FLOOD_THRESHOLD && supabase && typeof supabase.from === 'function') {
    try {
      await supabase.from('security_audit_events').insert({
        event_type: 'RATE_LIMIT_FLOOD_DETECTED',
        target_type: 'endpoint',
        target_id: namespace,
        trace_id: traceId || null,
        result: 'BLOCKED',
        metadata: {
          namespace,
          key_hash: keyHash,
          blocked_requests_in_window: tracker.count,
          threshold: CRITICAL_FLOOD_THRESHOLD,
          // Privacidad garantizada: Sin IPs crudas, sin tokens, sin contraseñas
        },
      });
      return true;
    } catch (err: any) {
      logger.error('Failed to record rate limit flood security audit event', { error: err.message });
    }
  }

  return false;
}
