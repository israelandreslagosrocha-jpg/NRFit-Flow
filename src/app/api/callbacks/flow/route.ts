import { NextRequest, NextResponse } from 'next/server.js';
import { createAdminClient } from '../../../../lib/supabase/admin.ts';
import { processFlowCallback } from '../../../../lib/payments/flow/processor.ts';
import { logger } from '../../../../lib/logger.ts';
import { checkRateLimit } from '../../../../lib/rate-limit/index.ts';
import { RATE_LIMIT_CONFIG } from '../../../../lib/rate-limit/config.ts';
import { createRateLimitExceededResponse } from '../../../../lib/rate-limit/headers.ts';
import { handleRateLimitHit } from '../../../../lib/rate-limit/audit-protection.ts';

const MAX_CALLBACK_BODY_BYTES = parseInt(process.env.FLOW_CALLBACK_MAX_BODY_BYTES || '8192', 10); // 8 KB según contrato Flow

/**
 * FASE M-09.3E.1: ENDPOINT DE CALLBACK FLOW CHILE CON POLÍTICA FINANCIERA ESPECIAL
 * 
 * Reglas contractuales Flow Chile:
 * 1. Content-Type: EXCLUSIVAMENTE application/x-www-form-urlencoded (según especificación oficial Flow).
 *    JSON y multipart/form-data son rechazados con HTTP 415 para reducir superficie de parsing innecesaria.
 * 2. Tamaño máximo de payload: 8 KB (configurable vía FLOW_CALLBACK_MAX_BODY_BYTES).
 * 3. PROHIBIDO rate limiting genérico per-IP: Flow envía reintentos legítimos que no deben descartarse por IP.
 * 4. Bulkhead global para evitar agotamiento de recursos S2S del servidor ante ráfagas.
 * 5. Caída del provider distribuido (PROVIDER_UNAVAILABLE): El callback financiero NUNCA se descarta
 *    por caída de Redis/KV; se continúa con la resolución S2S e idempotencia.
 * 6. BULKHEAD_LIMITED: Si el bulkhead limita un callback puntual, la consistencia financiera se recupera
 *    garantizadamente mediante el cron reconciliador S2S sin depender de repetición del callback.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verificación estricta de Content-Type: Flow documenta exclusivamente application/x-www-form-urlencoded
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
      logger.warn('Flow callback rejected: unsupported Content-Type', {
        content_type: contentType,
        expected: 'application/x-www-form-urlencoded',
      });
      return NextResponse.json(
        { error: 'Unsupported Media Type: Se requiere exclusivamente application/x-www-form-urlencoded' },
        { status: 415 }
      );
    }

    // 2. Verificación de tamaño máximo de cuerpo (Anti-DoS / Payload Bomb)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_CALLBACK_BODY_BYTES) {
      logger.warn('Flow callback payload exceeds maximum size limit', {
        content_length: contentLength,
        max_allowed: MAX_CALLBACK_BODY_BYTES,
      });
      return NextResponse.json({ error: 'Cuerpo de petición excede el tamaño máximo permitido' }, { status: 413 });
    }

    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_CALLBACK_BODY_BYTES) {
      logger.warn('Flow callback raw body exceeds maximum size limit', {
        byte_length: Buffer.byteLength(rawBody, 'utf8'),
        max_allowed: MAX_CALLBACK_BODY_BYTES,
      });
      return NextResponse.json({ error: 'Cuerpo de petición excede el tamaño máximo permitido' }, { status: 413 });
    }

    // 3. Extracción de token y datos según contrato x-www-form-urlencoded
    const formData = new URLSearchParams(rawBody);
    let token = formData.get('token');
    const resourceHint = formData.get('resource') || formData.get('type') || undefined;
    const bodyData = Object.fromEntries(formData.entries());

    // 4. Validación de presencia y formato básico de token (sin asumir longitud fija)
    if (!token || typeof token !== 'string' || token.trim().length === 0 || token.length > 512) {
      return NextResponse.json({ error: 'Falta parámetro token o formato inválido en callback de Flow' }, { status: 400 });
    }

    token = token.trim();

    // 5. Protección de disponibilidad: Bulkhead global contra agotamiento de recursos
    // NOTA: No utiliza IP como key para no bloquear reintentos financieros válidos de Flow
    const bulkheadConfig = RATE_LIMIT_CONFIG.flowCallbackBulkhead;
    const rateLimitResult = await checkRateLimit({
      namespace: 'flow-callback',
      key: 'bulkhead_global',
      limit: bulkheadConfig.limit,
      windowSeconds: bulkheadConfig.windowSeconds,
      policyId: bulkheadConfig.policyId,
    });

    if (rateLimitResult.status === 'LIMITED') {
      await handleRateLimitHit({
        namespace: 'flow-callback',
        keyHash: 'bulkhead_global',
        limit: bulkheadConfig.limit,
      });
      return createRateLimitExceededResponse(
        rateLimitResult,
        'Capacidad temporal de procesamiento de callbacks excedida. Reintente en breve.',
        { policyId: bulkheadConfig.policyId, windowSeconds: bulkheadConfig.windowSeconds }
      );
    }

    if (rateLimitResult.status === 'PROVIDER_UNAVAILABLE') {
      // Regla Crítica: Caída del rate limiter distribuido no descarta callbacks financieros
      logger.warn('RATE_LIMIT_PROVIDER_UNAVAILABLE', {
        gateway: 'FLOW',
        endpoint: '/api/callbacks/flow',
        action: 'CONTINUE_PROCESSING_WITH_S2S',
      });
    }

    // 6. Procesamiento S2S desacoplado con idempotencia transaccional y trace_id
    const supabase = createAdminClient();
    const result = await processFlowCallback({
      supabase,
      token,
      resourceHint,
      payload: bodyData,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    logger.error('flow_callback_route_error', { gateway: 'FLOW' }, error);
    return NextResponse.json(
      { error: 'Error interno al procesar callback Flow', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Los callbacks oficiales de Flow Chile son exclusivamente peticiones POST con body application/x-www-form-urlencoded.
  // GET opera como sondeo o healthcheck del endpoint sin realizar mutaciones financieras.
  return NextResponse.json({ status: 'FLOW_CALLBACK_ENDPOINT_READY' }, { status: 200 });
}
