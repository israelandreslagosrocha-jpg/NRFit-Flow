import type { RateLimitProvider, RateLimitOptions, RateLimitResult } from './types.ts';
import { InMemoryRateLimiter } from './memory-provider.ts';
import { DistributedRateLimiter } from './distributed-provider.ts';
import { logger } from '../logger.ts';

export * from './types.ts';
export * from './memory-provider.ts';
export * from './distributed-provider.ts';
export * from './client-identity.ts';
export * from './headers.ts';
export * from './config.ts';
export * from './audit-protection.ts';

let customProvider: RateLimitProvider | null = null;
let activeProvider: RateLimitProvider | null = null;

/**
 * Obtiene el RateLimitProvider activo según el entorno.
 * - Test / Development: InMemoryRateLimiter.
 * - Production: DistributedRateLimiter (si no está configurado, marca PRODUCTION_RATE_LIMIT = NOT_CONFIGURED).
 */
export function getRateLimitProvider(): RateLimitProvider {
  if (customProvider) {
    return customProvider;
  }

  if (activeProvider) {
    return activeProvider;
  }

  if (process.env.NODE_ENV === 'production') {
    activeProvider = new DistributedRateLimiter();
  } else {
    activeProvider = new InMemoryRateLimiter();
  }

  return activeProvider;
}

/**
 * Inyecta un proveedor personalizado (utilizado exclusivamente en tests o bootstrapping).
 */
export function setRateLimitProvider(provider: RateLimitProvider | null): void {
  customProvider = provider;
}

export const RATE_LIMIT_PROVIDER_TIMEOUT_MS = parseInt(
  process.env.RATE_LIMIT_PROVIDER_TIMEOUT_MS || '250',
  10
);

/**
 * Función de utilidad de alto nivel para evaluar rate limiting en Route Handlers y Server Actions.
 * Implementa guardia de timeout (250ms por defecto) para que lentitudes de la red o del proveedor
 * distribuido jamás retrasen la respuesta al cliente ni bloqueen el flujo de negocio.
 */
export async function checkRateLimit(
  options: RateLimitOptions,
  customTimeoutMs?: number
): Promise<RateLimitResult> {
  const provider = getRateLimitProvider();
  const timeoutMs = customTimeoutMs ?? RATE_LIMIT_PROVIDER_TIMEOUT_MS;
  const policyId = options.policyId || options.namespace;

  try {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('RATE_LIMIT_PROVIDER_TIMEOUT')), timeoutMs);
    });

    const result = await Promise.race([provider.checkLimit(options), timeoutPromise]);
    if (timer) clearTimeout(timer);
    return result;
  } catch (err: any) {
    logger.warn('Rate limit provider invocation failed or timed out, applying fail-safe fallback', {
      namespace: options.namespace,
      error: err.message,
    });

    return {
      allowed: true,
      status: 'PROVIDER_UNAVAILABLE',
      limit: options.limit,
      remaining: options.limit,
      resetSeconds: options.windowSeconds,
      policyId,
      policy: `"${policyId}";q=${options.limit};w=${options.windowSeconds}`,
    };
  }
}
