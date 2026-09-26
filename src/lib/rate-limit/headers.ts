import { NextResponse } from 'next/server.js';
import type { RateLimitResult } from './types.ts';

/**
 * FASE M-09.3E: CABECERAS HTTP DE RATE LIMITING
 * 
 * Basadas en el Internet-Draft vigente de IETF:
 * "draft-ietf-httpapi-ratelimit-headers" (Nota técnica: NO es un estándar RFC final aún).
 * - RateLimit-Policy: "<limit>;w=<windowSeconds>"
 * - RateLimit: "limit=<limit>, remaining=<remaining>, reset=<resetSeconds>"
 * - Retry-After: <seconds> (Estándar RFC 7231 / RFC 9110 para respuestas HTTP 429)
 */

/**
 * Añade las cabeceras RateLimit del draft IETF a una respuesta HTTP.
 */
export function applyRateLimitHeaders(
  response: Response | NextResponse,
  result: RateLimitResult
): void {
  // Solo exponer cabeceras si el resultado proviene de un evaluador activo
  if (result.status === 'PROVIDER_UNAVAILABLE') {
    return;
  }

  if (result.policy) {
    response.headers.set('RateLimit-Policy', result.policy);
  }

  response.headers.set(
    'RateLimit',
    `limit=${result.limit}, remaining=${result.remaining}, reset=${result.resetSeconds}`
  );

  if (!result.allowed && result.retryAfterSeconds !== undefined) {
    response.headers.set('Retry-After', String(result.retryAfterSeconds));
  }
}

/**
 * Construye una respuesta HTTP 429 Too Many Requests con cabeceras según el draft IETF.
 */
export function createRateLimitExceededResponse(
  result: RateLimitResult,
  message: string = 'Demasiadas solicitudes. Por favor, reintenta más tarde.'
): NextResponse {
  const response = NextResponse.json(
    {
      error: message,
      retryAfterSeconds: result.retryAfterSeconds ?? result.resetSeconds,
    },
    { status: 429 }
  );

  applyRateLimitHeaders(response, result);
  return response;
}
