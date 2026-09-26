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

/**
 * Función de utilidad de alto nivel para evaluar rate limiting en Route Handlers y Server Actions.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const provider = getRateLimitProvider();

  try {
    return await provider.checkLimit(options);
  } catch (err: any) {
    logger.error('Rate limit provider invocation failed, applying fail-safe fallback', {
      namespace: options.namespace,
      error: err.message,
    });

    return {
      allowed: true,
      status: 'PROVIDER_UNAVAILABLE',
      limit: options.limit,
      remaining: options.limit,
      resetSeconds: options.windowSeconds,
      policy: `"${options.limit};w=${options.windowSeconds}"`,
    };
  }
}
