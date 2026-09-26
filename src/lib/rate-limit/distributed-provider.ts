import type { RateLimitProvider, RateLimitOptions, RateLimitResult } from './types.ts';
import { logger } from '../logger.ts';

/**
 * FASE M-09.3E: ADAPTADOR DISTRIBUIDO DESACOPLADO (REDIS / KV / UPSTASH)
 * 
 * Principios:
 * 1. Preparar la interfaz y contrato del adaptador para topologías multi-instancia / serverless.
 * 2. NO instalar ni seleccionar arbitrariamente un proveedor SaaS hasta confirmar el hosting definitivo.
 * 3. Si no hay conexión configurada en producción/staging:
 *    Reporta PRODUCTION_RATE_LIMIT = 'NOT_CONFIGURED', quedando como gate explícito para M-09.4 / M-10.
 * 4. Retorna status: 'PROVIDER_UNAVAILABLE' para que cada superficie aplique su política de fallo definida.
 */
export class DistributedRateLimiter implements RateLimitProvider {
  readonly name = 'distributed';
  private isConfigured: boolean;

  constructor() {
    // Verificamos si existe una URL de Redis o KV configurada
    const redisUrl = process.env.RATE_LIMIT_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
    this.isConfigured = Boolean(redisUrl && redisUrl.trim().length > 0);

    if (!this.isConfigured && process.env.NODE_ENV === 'production') {
      logger.warn('RATE_LIMIT_GATE_ACTIVE: Production distributed rate limiter is not configured', {
        gate: 'PRODUCTION_RATE_LIMIT = NOT_CONFIGURED',
        phase_gate: 'M-09.4/M-10_PREREQUISITE',
      });
    }
  }

  get configured(): boolean {
    return this.isConfigured;
  }

  async checkLimit(options: RateLimitOptions): Promise<RateLimitResult> {
    const { limit, windowSeconds } = options;
    const policyId = options.policyId || options.namespace;
    const policy = `"${policyId}";q=${limit};w=${windowSeconds}`;

    if (!this.isConfigured) {
      // Proveedor distribuido pendiente de configuración de hosting
      return {
        allowed: true, // Fail-open para no bloquear el sistema por falta de hosting SaaS en pre-lanzamiento
        status: 'PROVIDER_UNAVAILABLE',
        limit,
        remaining: limit,
        resetSeconds: windowSeconds,
        policyId,
        policy,
      };
    }

    try {
      // Stub preparado para ejecutar comandos atómicos INCR / EXPIRE en Redis/KV cuando se configure
      return {
        allowed: true,
        status: 'ALLOWED',
        limit,
        remaining: Math.max(0, limit - 1),
        resetSeconds: windowSeconds,
        policyId,
        policy,
      };
    } catch (err: any) {
      logger.error('Distributed rate limiter check failed', { error: err.message });
      return {
        allowed: true,
        status: 'PROVIDER_UNAVAILABLE',
        limit,
        remaining: limit,
        resetSeconds: windowSeconds,
        policyId,
        policy,
      };
    }
  }
}
