import { NextResponse } from 'next/server.js';
import type { RateLimitResult } from './types.ts';

/**
 * FASE M-09.3E.1: CABECERAS HTTP DE RATE LIMITING
 * 
 * Basadas en el Internet-Draft vigente de IETF:
 * "draft-ietf-httpapi-ratelimit-headers" (Nota técnica: Internet-Draft, NO es un RFC final aún).
 * Utiliza Structured Fields (RFC 8941):
 * - RateLimit-Policy: "<policy_id>";q=<limit>;w=<windowSeconds>
 * - RateLimit: "<policy_id>";r=<remaining>;t=<resetSeconds>
 * - Retry-After: <seconds> (Estándar RFC 9110 para respuestas HTTP 429)
 */

export interface ParsedRateLimitPolicy {
  policyId: string;
  quota: number;
  windowSeconds: number;
}

export interface ParsedRateLimit {
  policyId: string;
  remaining: number;
  resetSeconds: number;
}

/**
 * Formatea el header RateLimit-Policy según Structured Fields del draft IETF.
 * Ejemplo: RateLimit-Policy: "auth";q=5;w=60
 */
export function formatRateLimitPolicy(policyId: string, limit: number, windowSeconds: number): string {
  const sanitizedId = policyId.replace(/["\\]/g, '');
  return `"${sanitizedId}";q=${limit};w=${windowSeconds}`;
}

/**
 * Formatea el header RateLimit según Structured Fields del draft IETF.
 * Ejemplo: RateLimit: "auth";r=0;t=42
 */
export function formatRateLimit(policyId: string, remaining: number, resetSeconds: number): string {
  const sanitizedId = policyId.replace(/["\\]/g, '');
  return `"${sanitizedId}";r=${remaining};t=${resetSeconds}`;
}

/**
 * Parsea y valida el header RateLimit-Policy.
 * Retorna null si la sintaxis no cumple con el draft IETF.
 */
export function parseRateLimitPolicyHeader(headerValue: string | null): ParsedRateLimitPolicy | null {
  if (!headerValue) return null;
  const match = headerValue.trim().match(/^"([^"]+)";q=(\d+);w=(\d+)$/);
  if (!match) return null;
  return {
    policyId: match[1],
    quota: parseInt(match[2], 10),
    windowSeconds: parseInt(match[3], 10),
  };
}

/**
 * Parsea y valida el header RateLimit.
 * Retorna null si la sintaxis no cumple con el draft IETF.
 */
export function parseRateLimitHeader(headerValue: string | null): ParsedRateLimit | null {
  if (!headerValue) return null;
  const match = headerValue.trim().match(/^"([^"]+)";r=(\d+);t=(\d+)$/);
  if (!match) return null;
  return {
    policyId: match[1],
    remaining: parseInt(match[2], 10),
    resetSeconds: parseInt(match[3], 10),
  };
}

/**
 * Añade las cabeceras RateLimit del draft IETF a una respuesta HTTP.
 */
export function applyRateLimitHeaders(
  response: Response | NextResponse,
  result: RateLimitResult,
  options?: { policyId?: string; windowSeconds?: number }
): void {
  // Solo exponer cabeceras si el resultado proviene de un evaluador activo
  if (result.status === 'PROVIDER_UNAVAILABLE') {
    return;
  }

  const policyId = options?.policyId || result.policyId || 'default';
  const windowSeconds = options?.windowSeconds || result.resetSeconds;

  response.headers.set('RateLimit-Policy', formatRateLimitPolicy(policyId, result.limit, windowSeconds));
  response.headers.set('RateLimit', formatRateLimit(policyId, result.remaining, result.resetSeconds));

  if (!result.allowed && result.retryAfterSeconds !== undefined) {
    response.headers.set('Retry-After', String(result.retryAfterSeconds));
  }
}

/**
 * Construye una respuesta HTTP 429 Too Many Requests con cabeceras según el draft IETF.
 */
export function createRateLimitExceededResponse(
  result: RateLimitResult,
  message: string = 'Demasiadas solicitudes. Por favor, reintenta más tarde.',
  options?: { policyId?: string; windowSeconds?: number }
): NextResponse {
  const response = NextResponse.json(
    {
      error: message,
      retryAfterSeconds: result.retryAfterSeconds ?? result.resetSeconds,
    },
    { status: 429 }
  );

  applyRateLimitHeaders(response, result, options);
  return response;
}
