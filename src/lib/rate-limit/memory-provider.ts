import type { RateLimitProvider, RateLimitOptions, RateLimitResult } from './types.ts';

interface RateLimitRecord {
  count: number;
  resetAtMs: number;
}

/**
 * FASE M-09.3E: IN-MEMORY RATE LIMITER
 * 
 * Uso exclusivo para Entornos de Desarrollo Local y Tests Automatizados.
 * PROHIBICIÓN ESTRICTA: No puede instanciarse ni ejecutarse en entornos de staging o producción.
 */
export class InMemoryRateLimiter implements RateLimitProvider {
  readonly name = 'in_memory';
  private stores: Map<string, Map<string, RateLimitRecord>> = new Map();

  constructor() {
    this.assertNotProduction();
  }

  private assertNotProduction(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SECURITY_VIOLATION: InMemoryRateLimiter is strictly prohibited in staging and production environments. A distributed provider (Redis/KV) must be used.'
      );
    }
  }

  async checkLimit(options: RateLimitOptions): Promise<RateLimitResult> {
    this.assertNotProduction();

    const { namespace, key, limit, windowSeconds } = options;
    const nowMs = Date.now();
    const windowMs = windowSeconds * 1000;

    let nsStore = this.stores.get(namespace);
    if (!nsStore) {
      nsStore = new Map();
      this.stores.set(namespace, nsStore);
    }

    let record = nsStore.get(key);

    // Si no existe o la ventana expiró, iniciar nuevo ciclo
    if (!record || nowMs >= record.resetAtMs) {
      record = {
        count: 1,
        resetAtMs: nowMs + windowMs,
      };
      nsStore.set(key, record);

      const resetSeconds = Math.ceil((record.resetAtMs - nowMs) / 1000);
      return {
        allowed: true,
        status: 'ALLOWED',
        limit,
        remaining: Math.max(0, limit - 1),
        resetSeconds,
        policy: `"${limit};w=${windowSeconds}"`,
      };
    }

    // Ventana activa: verificar cuota
    if (record.count < limit) {
      record.count += 1;
      const resetSeconds = Math.ceil((record.resetAtMs - nowMs) / 1000);
      return {
        allowed: true,
        status: 'ALLOWED',
        limit,
        remaining: limit - record.count,
        resetSeconds,
        policy: `"${limit};w=${windowSeconds}"`,
      };
    }

    // Límite excedido
    const resetSeconds = Math.ceil((record.resetAtMs - nowMs) / 1000);
    return {
      allowed: false,
      status: 'LIMITED',
      limit,
      remaining: 0,
      resetSeconds,
      retryAfterSeconds: Math.max(1, resetSeconds),
      policy: `"${limit};w=${windowSeconds}"`,
    };
  }

  /**
   * Limpia los almacenes en memoria (utilizado para reset en tests).
   */
  clear(): void {
    this.stores.clear();
  }
}
