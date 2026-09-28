import type { RateLimitProvider, RateLimitOptions, RateLimitResult } from './types.ts';
import { logger } from '../logger.ts';

/**
 * Limitador distribuido para runtimes serverless.
 *
 * Usa la API REST de Upstash (o Vercel KV compatible) para que todas las
 * instancias de Vercel compartan la misma cuota. La actualización se ejecuta
 * dentro de un script Lua atómico: INCR + expiración nunca quedan separados.
 */
const FIXED_WINDOW_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end",
  "local ttl = redis.call('TTL', KEYS[1])",
  'return { count, ttl }',
].join('\n');

type UpstashCommandResponse = {
  result?: unknown;
  error?: string;
};

function getRestConfiguration(): { url?: string; token?: string } {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  };
}

function unavailableResult(options: RateLimitOptions): RateLimitResult {
  const policyId = options.policyId || options.namespace;

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

function asPositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export class DistributedRateLimiter implements RateLimitProvider {
  readonly name = 'distributed-upstash-rest';
  private readonly restUrl?: string;
  private readonly restToken?: string;
  private readonly isConfigured: boolean;

  constructor() {
    const config = getRestConfiguration();
    this.restUrl = config.url?.replace(/\/+$/, '');
    this.restToken = config.token;
    this.isConfigured = Boolean(
      this.restUrl
      && this.restToken
      && /^https:\/\//.test(this.restUrl)
    );

    if (!this.isConfigured && process.env.NODE_ENV === 'production') {
      logger.warn('RATE_LIMIT_GATE_ACTIVE: Production distributed rate limiter is not configured', {
        gate: 'PRODUCTION_RATE_LIMIT = NOT_CONFIGURED',
        required: 'UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or Vercel KV equivalents)',
      });
    }
  }

  get configured(): boolean {
    return this.isConfigured;
  }

  async checkLimit(options: RateLimitOptions): Promise<RateLimitResult> {
    if (!this.isConfigured || !this.restUrl || !this.restToken) {
      return unavailableResult(options);
    }

    const policyId = options.policyId || options.namespace;
    const policy = `"${policyId}";q=${options.limit};w=${options.windowSeconds}`;
    const normalizedKey = options.key.trim();

    if (!normalizedKey || normalizedKey.length > 512 || options.limit < 1 || options.windowSeconds < 1) {
      logger.error('Distributed rate limiter rejected an invalid internal configuration', {
        namespace: options.namespace,
      });
      return unavailableResult(options);
    }

    const redisKey = `naty:rate-limit:${options.namespace}:${normalizedKey}`;

    try {
      const response = await fetch(this.restUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          'EVAL',
          FIXED_WINDOW_SCRIPT,
          1,
          redisKey,
          String(options.windowSeconds),
        ]),
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => ({})) as UpstashCommandResponse;
      if (!response.ok || payload.error) {
        throw new Error('UPSTASH_RATE_LIMIT_COMMAND_FAILED');
      }

      if (!Array.isArray(payload.result) || payload.result.length < 2) {
        throw new Error('UPSTASH_RATE_LIMIT_INVALID_RESPONSE');
      }

      const count = asPositiveInteger(payload.result[0]);
      const ttl = asPositiveInteger(payload.result[1]);
      if (count === null || ttl === null) {
        throw new Error('UPSTASH_RATE_LIMIT_INVALID_COUNTER');
      }

      const resetSeconds = Math.max(1, ttl || options.windowSeconds);
      const allowed = count <= options.limit;

      return {
        allowed,
        status: allowed ? 'ALLOWED' : 'LIMITED',
        limit: options.limit,
        remaining: Math.max(0, options.limit - count),
        resetSeconds,
        retryAfterSeconds: allowed ? undefined : resetSeconds,
        policyId,
        policy,
      };
    } catch {
      // No incluir la respuesta ni la URL del proveedor en logs: podrían contener
      // datos operativos o de autenticación. Cada endpoint decide si falla abierto.
      logger.error('Distributed rate limiter check failed', {
        provider: 'upstash-rest',
        namespace: options.namespace,
        error_code: 'RATE_LIMIT_PROVIDER_REQUEST_FAILED',
      });
      return unavailableResult(options);
    }
  }
}
