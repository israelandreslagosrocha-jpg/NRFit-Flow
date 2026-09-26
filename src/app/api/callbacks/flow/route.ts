import { NextRequest, NextResponse } from 'next/server.js';
import { createAdminClient } from '../../../../lib/supabase/admin.ts';
import { processFlowCallback } from '../../../../lib/payments/flow/processor.ts';
import { logger } from '../../../../lib/logger.ts';
import { checkRateLimit } from '../../../../lib/rate-limit/index.ts';
import { RATE_LIMIT_CONFIG } from '../../../../lib/rate-limit/config.ts';
import { createRateLimitExceededResponse } from '../../../../lib/rate-limit/headers.ts';
import { handleRateLimitHit } from '../../../../lib/rate-limit/audit-protection.ts';

const MAX_BODY_SIZE_BYTES = 64 * 1024; // 64 KB máximo para callbacks

/**
 * FASE M-09.3E: ENDPOINT DE CALLBACK FLOW CHILE CON POLÍTICA FINANCIERA ESPECIAL
 * 
 * Reglas de seguridad y diseño:
 * 1. PROHIBIDO rate limiting genérico per-IP: Flow envía reintentos legítimos que no deben descartarse.
 * 2. Bulkhead global para evitar agotamiento de recursos S2S del servidor.
 * 3. Fallo del provider distribuido (PROVIDER_UNAVAILABLE): El callback financiero NUNCA se descarta
 *    por caída de Redis/KV; se continúa con la resolución S2S e idempotencia.
 * 4. Higiene previa: Método, Content-Type, tamaño máximo y saneamiento básico de token.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verificación de tamaño máximo de cuerpo (Anti-DoS / Payload Bomb)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE_BYTES) {
      logger.warn('Flow callback payload exceeds maximum size limit', {
        content_length: contentLength,
        max_allowed: MAX_BODY_SIZE_BYTES,
      });
      return NextResponse.json({ error: 'Cuerpo de petición excede el tamaño máximo permitido' }, { status: 413 });
    }

    // 2. Validación de Content-Type esperado
    const contentType = req.headers.get('content-type') || '';
    const isUrlEncoded = contentType.includes('application/x-www-form-urlencoded');
    const isFormData = contentType.includes('multipart/form-data');
    const isJson = contentType.includes('application/json');

    if (!isUrlEncoded && !isFormData && !isJson) {
      // Si no es ninguno de los formatos oficiales ni hay query string
      const url = new URL(req.url);
      if (!url.searchParams.has('token')) {
        return NextResponse.json(
          { error: 'Content-Type no soportado. Se espera application/x-www-form-urlencoded o application/json' },
          { status: 415 }
        );
      }
    }

    // 3. Extracción de token y datos de formulario
    let token: string | null = null;
    let resourceHint: string | undefined = undefined;
    let bodyData: any = {};

    if (isUrlEncoded || isFormData) {
      const formData = await req.formData();
      token = (formData.get('token') as string) || null;
      resourceHint = (formData.get('resource') as string) || (formData.get('type') as string) || undefined;
      bodyData = Object.fromEntries(formData.entries());
    } else if (isJson) {
      const json = await req.json();
      token = json.token || null;
      resourceHint = json.resource || json.type || undefined;
      bodyData = json;
    } else {
      const url = new URL(req.url);
      token = url.searchParams.get('token');
      resourceHint = url.searchParams.get('resource') || url.searchParams.get('type') || undefined;
    }

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
    });

    if (rateLimitResult.status === 'LIMITED') {
      await handleRateLimitHit({
        namespace: 'flow-callback',
        keyHash: 'bulkhead_global',
        limit: bulkheadConfig.limit,
      });
      return createRateLimitExceededResponse(
        rateLimitResult,
        'Capacidad temporal de procesamiento de callbacks excedida. Reintente en breve.'
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
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ status: 'FLOW_CALLBACK_ENDPOINT_READY' }, { status: 200 });
  }

  // Si envían token por GET, aplicar el mismo bulkhead global
  const bulkheadConfig = RATE_LIMIT_CONFIG.flowCallbackBulkhead;
  const rateLimitResult = await checkRateLimit({
    namespace: 'flow-callback',
    key: 'bulkhead_global',
    limit: bulkheadConfig.limit,
    windowSeconds: bulkheadConfig.windowSeconds,
  });

  if (rateLimitResult.status === 'LIMITED') {
    return createRateLimitExceededResponse(rateLimitResult);
  }

  const supabase = createAdminClient();
  const result = await processFlowCallback({
    supabase,
    token,
    payload: { query: Object.fromEntries(url.searchParams.entries()) },
  });

  return NextResponse.json(result, { status: 200 });
}
