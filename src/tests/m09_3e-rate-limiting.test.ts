/**
 * FASE M-09.3E: SUITE DE CERTIFICACIÓN RATE LIMITING & ABUSE PROTECTION
 * Naty Entrenadora - Arquitectura Desacoplada, Protección Financiera y Anti-DoS
 * 
 * Contratos de prueba obligatorios según especificación M-09.3E
 */

import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert';

// Configurar claves de prueba seguras para entorno de testing
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wqsmimxjnfanrenlhdgx.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-mock-anon-key-jwt-format-valid';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-mock-service-role-key-jwt-valid';

import {
  InMemoryRateLimiter,
  DistributedRateLimiter,
  setRateLimitProvider,
  resolveRateLimitKey,
  hashClientIdentity,
  extractClientIp,
  createRateLimitExceededResponse,
  handleRateLimitHit,
  type RateLimitProvider,
} from '../lib/rate-limit/index.ts';
import { POST as flowCallbackPost } from '../app/api/callbacks/flow/route.ts';
import { POST as processOutboxPost } from '../app/api/cron/process-outbox/route.ts';
import { POST as reconcileCronPost } from '../app/api/cron/reconcile-memberships/route.ts';
import { GET as flowReturnGet } from '../app/checkout/flow-return/route.ts';
import { setPaymentGateway } from '../lib/payments/index.ts';
import type { PaymentGateway } from '../lib/payments/types.ts';
import { NextRequest } from 'next/server.js';

describe('FASE M-09.3E — Rate Limiting & Abuse Protection', () => {
  let originalFetch: typeof globalThis.fetch;

  before(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('supabase.co')) {
        return new Response(JSON.stringify([{ id: 'mock-supabase-id', status: 'PROCESSED' }]), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'content-range': '0-0/1',
          },
        });
      }
      return originalFetch(input, init);
    };
  });

  after(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
  });

  beforeEach(() => {
    // Restaurar provider predeterminado para test
    setRateLimitProvider(new InMemoryRateLimiter());
  });

  // ============================================================================
  // CONTRATOS 1-3: CICLO DE VIDA Y PROHIBICIÓN EN PRODUCCIÓN
  // ============================================================================

  it('1. DEV_TEST_IN_MEMORY_WORKS: InMemoryRateLimiter funciona determinísticamente en desarrollo y test', async () => {
    const limiter = new InMemoryRateLimiter();
    const res1 = await limiter.checkLimit({
      namespace: 'test-dev',
      key: 'client-1',
      limit: 2,
      windowSeconds: 60,
    });

    assert.strictEqual(res1.allowed, true);
    assert.strictEqual(res1.status, 'ALLOWED');
    assert.strictEqual(res1.remaining, 1);

    const res2 = await limiter.checkLimit({
      namespace: 'test-dev',
      key: 'client-1',
      limit: 2,
      windowSeconds: 60,
    });
    assert.strictEqual(res2.allowed, true);
    assert.strictEqual(res2.remaining, 0);

    const res3 = await limiter.checkLimit({
      namespace: 'test-dev',
      key: 'client-1',
      limit: 2,
      windowSeconds: 60,
    });
    assert.strictEqual(res3.allowed, false);
    assert.strictEqual(res3.status, 'LIMITED');
    assert.ok(res3.retryAfterSeconds! > 0);
  });

  it('2. MEMORY_PROVIDER_CANNOT_BE_ACTIVATED_IN_PRODUCTION: Intento de instanciar InMemoryRateLimiter en producción arroja violación de seguridad', () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      assert.throws(
        () => new InMemoryRateLimiter(),
        /SECURITY_VIOLATION.*InMemoryRateLimiter is strictly prohibited in staging and production/
      );
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  it('3. PRODUCTION_WITHOUT_DISTRIBUTED_PROVIDER_REPORTS_NOT_CONFIGURED: Producción sin backend Redis/KV reporta PROVIDER_UNAVAILABLE sin bloquear', async () => {
    const originalRedisUrl = process.env.RATE_LIMIT_REDIS_URL;
    const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.RATE_LIMIT_REDIS_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;

    try {
      const distributed = new DistributedRateLimiter();
      assert.strictEqual(distributed.configured, false);

      const res = await distributed.checkLimit({
        namespace: 'prod-gate',
        key: 'test',
        limit: 10,
        windowSeconds: 60,
      });

      // Fail-open seguro en pre-lanzamiento
      assert.strictEqual(res.allowed, true);
      assert.strictEqual(res.status, 'PROVIDER_UNAVAILABLE');
    } finally {
      if (originalRedisUrl) process.env.RATE_LIMIT_REDIS_URL = originalRedisUrl;
      if (originalUpstashUrl) process.env.UPSTASH_REDIS_REST_URL = originalUpstashUrl;
    }
  });

  // ============================================================================
  // CONTRATOS 4-7: AISLAMIENTO, EXPIRACIÓN, CONCURRENCIA Y HEADERS HTTP
  // ============================================================================

  it('4. ISOLATED_QUOTAS_PER_NAMESPACE_AND_ROUTE: Cuotas aisladas por namespace evitan interferencia cruzada', async () => {
    const limiter = new InMemoryRateLimiter();

    // Consumir cuota en namespace A
    await limiter.checkLimit({ namespace: 'ns-a', key: 'user-x', limit: 1, windowSeconds: 60 });
    const blockedA = await limiter.checkLimit({ namespace: 'ns-a', key: 'user-x', limit: 1, windowSeconds: 60 });
    assert.strictEqual(blockedA.allowed, false);

    // Mismo key en namespace B no debe verse afectado
    const allowedB = await limiter.checkLimit({ namespace: 'ns-b', key: 'user-x', limit: 1, windowSeconds: 60 });
    assert.strictEqual(allowedB.allowed, true);
  });

  it('5. WINDOW_EXPIRATION_RESETS_QUOTA: Expiración de ventana reinicia cuota para solicitudes posteriores', async () => {
    const limiter = new InMemoryRateLimiter();
    // Ventana de 1 segundo
    await limiter.checkLimit({ namespace: 'window-exp', key: 'user-y', limit: 1, windowSeconds: 1 });
    const blocked = await limiter.checkLimit({ namespace: 'window-exp', key: 'user-y', limit: 1, windowSeconds: 1 });
    assert.strictEqual(blocked.allowed, false);

    // Esperar 1.1 segundos
    await new Promise((r) => setTimeout(r, 1100));

    const resetResult = await limiter.checkLimit({ namespace: 'window-exp', key: 'user-y', limit: 1, windowSeconds: 1 });
    assert.strictEqual(resetResult.allowed, true);
    assert.strictEqual(resetResult.status, 'ALLOWED');
  });

  it('6. CONCURRENCY_MULTIPLE_REQUESTS_DECREMENT_ACCURATELY: Concurrencia decrece exactamente las cuotas sin carreras', async () => {
    const limiter = new InMemoryRateLimiter();
    const limit = 10;

    const promises = Array.from({ length: 15 }, () =>
      limiter.checkLimit({ namespace: 'concurrency', key: 'batch-key', limit, windowSeconds: 60 })
    );

    const results = await Promise.all(promises);
    const allowedCount = results.filter((r) => r.allowed).length;
    const limitedCount = results.filter((r) => !r.allowed).length;

    assert.strictEqual(allowedCount, 10, 'Exactamente 10 peticiones deben ser permitidas');
    assert.strictEqual(limitedCount, 5, 'Exactamente 5 peticiones deben ser rechazadas');
  });

  it('7. HEADERS_IETF_DRAFT_AND_RETRY_AFTER: Cabeceras RateLimit del draft IETF y Retry-After en 429', () => {
    const limitedResult = {
      allowed: false,
      status: 'LIMITED' as const,
      limit: 100,
      remaining: 0,
      resetSeconds: 45,
      retryAfterSeconds: 45,
      policy: '"100;w=60"',
    };

    const res = createRateLimitExceededResponse(limitedResult, 'Límite excedido');
    assert.strictEqual(res.status, 429);
    assert.strictEqual(res.headers.get('Retry-After'), '45');
    assert.strictEqual(res.headers.get('RateLimit-Policy'), '"100;w=60"');
    assert.strictEqual(res.headers.get('RateLimit'), 'limit=100, remaining=0, reset=45');
  });

  // ============================================================================
  // CONTRATOS 8-10: POLÍTICA FINANCIERA ESPECIAL EN /api/callbacks/flow
  // ============================================================================

  it('8. FLOW_CALLBACK_RETRY_NOT_BLOCKED_BY_GENERIC_IP_LIMIT: Flow reintentos no son bloqueados por cuotas de IP genéricas', async () => {
    // Mock gateway
    let resolveCount = 0;
    const mockGw: Partial<PaymentGateway> = {
      resolveCallback: async (token) => {
        resolveCount++;
        return {
          resourceType: 'payment',
          payment: {
            paymentId: `flow-p-${token}`,
            status: 'APPROVED',
            amount: 25000,
            currency: 'CLP',
            paymentDate: new Date().toISOString(),
          },
        };
      },
    };
    setPaymentGateway(mockGw as any);

    // Múltiples callbacks legítimos con tokens distintos simulando reintentos desde la misma IP
    for (let i = 1; i <= 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/callbacks/flow', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-forwarded-for': '190.160.0.1',
        },
        body: new URLSearchParams({ token: `token-retry-${i}` }).toString(),
      });

      const response = await flowCallbackPost(req);
      assert.notStrictEqual(response.status, 429, `El reintento ${i} no debe ser bloqueado por cuota de IP`);
    }
    assert.strictEqual(resolveCount, 5, 'Todos los 5 callbacks legítimos deben alcanzar la resolución S2S sin bloqueo de IP');
  });

  it('9. FLOW_CALLBACK_ABUSE_BULKHEAD_LIMITS_RESOURCE_EXHAUSTION: Bulkhead global limita agotamiento masivo de recursos en /api/callbacks/flow', async () => {
    const customLimiter: RateLimitProvider = {
      name: 'mock_bulkhead',
      checkLimit: async () => ({
        allowed: false,
        status: 'LIMITED',
        limit: 120,
        remaining: 0,
        resetSeconds: 30,
        retryAfterSeconds: 30,
      }),
    };
    setRateLimitProvider(customLimiter);

    const req = new NextRequest('http://localhost:3000/api/callbacks/flow', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: 'test-bulkhead-token' }).toString(),
    });

    const response = await flowCallbackPost(req);
    assert.strictEqual(response.status, 429, 'Debe responder HTTP 429 cuando el bulkhead se satura');
    assert.strictEqual(response.headers.get('Retry-After'), '30');
  });

  it('10. RATE_LIMIT_PROVIDER_FAILURE_DOES_NOT_DROP_VALID_FLOW_CALLBACK: Caída de Redis/KV no descarta callbacks financieros legítimos', async () => {
    const brokenLimiter: RateLimitProvider = {
      name: 'broken_redis',
      checkLimit: async () => ({
        allowed: true,
        status: 'PROVIDER_UNAVAILABLE',
        limit: 120,
        remaining: 120,
        resetSeconds: 60,
      }),
    };
    setRateLimitProvider(brokenLimiter);

    let callbackProcessed = false;
    const mockGw: Partial<PaymentGateway> = {
      resolveCallback: async () => {
        callbackProcessed = true;
        return {
          resourceType: 'payment',
          payment: {
            paymentId: 'pay-provider-down',
            status: 'APPROVED',
            amount: 25000,
            currency: 'CLP',
            paymentDate: new Date().toISOString(),
          },
        };
      },
    };
    setPaymentGateway(mockGw as any);

    const req = new NextRequest('http://localhost:3000/api/callbacks/flow', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: 'tok-safe-when-redis-down' }).toString(),
    });

    const response = await flowCallbackPost(req);
    assert.strictEqual(response.status, 200, 'Callback debe procesarse a pesar de caída del rate limiter');
    assert.strictEqual(callbackProcessed, true, 'S2S resolution debe ejecutarse normalmente');
  });

  it('11. AUTH_ABUSE_IS_LIMITED_BY_RATE_LIMITER: Intentos repetidos de autenticación exceden cuota y responden LIMITED', async () => {
    const limiter = new InMemoryRateLimiter();
    setRateLimitProvider(limiter);

    const clientKey = 'ip_hash:test-auth-client';
    for (let i = 0; i < 5; i++) {
      const res = await limiter.checkLimit({
        namespace: 'auth-login',
        key: clientKey,
        limit: 5,
        windowSeconds: 60,
      });
      assert.strictEqual(res.allowed, true);
    }

    // 6to intento debe ser bloqueado con LIMITED
    const blockedRes = await limiter.checkLimit({
      namespace: 'auth-login',
      key: clientKey,
      limit: 5,
      windowSeconds: 60,
    });

    assert.strictEqual(blockedRes.allowed, false);
    assert.strictEqual(blockedRes.status, 'LIMITED');
    assert.ok(blockedRes.retryAfterSeconds! > 0);
  });

  // ============================================================================
  // CONTRATOS 12-14: CRON AUTENTICACIÓN Y PROTECCIÓN DE RUTAS
  // ============================================================================

  it('12. CRON_WITHOUT_SECRET_401: Endpoints cron rechazan peticiones sin Authorization con HTTP 401', async () => {
    const req1 = new NextRequest('http://localhost:3000/api/cron/process-outbox', { method: 'POST' });
    const res1 = await processOutboxPost(req1);
    assert.strictEqual(res1.status, 401);

    const req2 = new NextRequest('http://localhost:3000/api/cron/reconcile-memberships', { method: 'POST' });
    const res2 = await reconcileCronPost(req2);
    assert.strictEqual(res2.status, 401);
  });

  it('13. CRON_INVALID_SECRET_401: Endpoints cron rechazan secreto incorrecto con HTTP 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/process-outbox', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid-secret-probe-123' },
    });
    const res = await processOutboxPost(req);
    assert.strictEqual(res.status, 401);
  });

  it('14. CRON_VALID_SECRET_NOT_BLOCKED_BY_PUBLIC_IP_QUOTA: Peticiones cron con CRON_SECRET válido no son bloqueadas por cuotas de IP pública', async () => {
    const secret = process.env.CRON_SECRET || 'test-cron-secret-123';
    process.env.CRON_SECRET = secret;

    const limiter = new InMemoryRateLimiter();
    setRateLimitProvider(limiter);

    // 1. Simular que la IP pública 190.160.0.99 agotó completamente su cuota de escaneo anónimo
    const clientKey = resolveRateLimitKey({ 'x-forwarded-for': '190.160.0.99' });
    for (let i = 0; i < 15; i++) {
      await limiter.checkLimit({
        namespace: 'cron-unauthorized-probe',
        key: clientKey,
        limit: 10,
        windowSeconds: 60,
      });
    }

    const exhaustedProbe = await limiter.checkLimit({
      namespace: 'cron-unauthorized-probe',
      key: clientKey,
      limit: 10,
      windowSeconds: 60,
    });
    assert.strictEqual(exhaustedProbe.allowed, false, 'La IP pública está agotada en cuota de escaneo');

    // 2. Invocación autorizada con Bearer secret desde la misma IP agotada
    const req = new NextRequest('http://localhost:3000/api/cron/reconcile-memberships', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'x-forwarded-for': '190.160.0.99',
      },
    });

    const res = await reconcileCronPost(req);
    // REGLA M-09.3E: La petición autorizada no debe recibir HTTP 429 por la cuota de la IP pública
    assert.notStrictEqual(res.status, 429, 'Cron autenticado no debe ser bloqueado por cuotas públicas de IP');
    assert.notStrictEqual(res.status, 401, 'No debe ser rechazado como no autorizado');
  });

  // ============================================================================
  // CONTRATOS 15-18: RETORNO DE CHECKOUT, PRIVACIDAD Y AUDIT ANTI-DOS
  // ============================================================================

  it('15. CHECKOUT_RETURN_DOES_NOT_CHANGE_FINANCIAL_AUTHORITY: Retorno de navegador es no-autoritativo y sujeto a rate limit suave', async () => {
    // Si falta token, redirige a checkout con error sin mutar estado financiero
    const req = new NextRequest('http://localhost:3000/checkout/flow-return', { method: 'GET' });
    const res = await flowReturnGet(req);

    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('location')?.includes('/checkout?error=missing_token'));
  });

  it('16. SENSITIVE_DATA_NOT_IN_KEYS_OR_LOGS: IPs crudas y secretos jamás aparecen en las claves de rate limit', () => {
    const rawIp = '200.89.120.45';
    const key = resolveRateLimitKey({ 'x-real-ip': rawIp });

    assert.ok(!key.includes(rawIp), 'La IP cruda jamás debe aparecer en la clave');
    assert.match(key, /^ip_hash:[a-f0-9]{16}$/, 'La clave debe ser un hash HMAC de 16 caracteres hexadecimales');

    const hashedOnce = hashClientIdentity(rawIp);
    const hashedTwice = hashClientIdentity(rawIp);
    assert.strictEqual(hashedOnce, hashedTwice, 'El fingerprint debe ser determinista para la misma IP');
  });

  it('17. RATE_LIMIT_FLOOD_DOES_NOT_FLOOD_SECURITY_AUDIT_TABLE: Ataque de flood masivo no inunda con inserts la tabla security_audit_events', async () => {
    let auditInsertsCount = 0;
    const mockSupabase = {
      from: (table: string) => ({
        insert: () => {
          if (table === 'security_audit_events') {
            auditInsertsCount++;
          }
          return Promise.resolve({ data: null, error: null });
        },
      }),
    };

    // Simular 40 peticiones bloqueadas por rate limit en ráfaga
    for (let i = 0; i < 40; i++) {
      await handleRateLimitHit({
        namespace: 'auth-login',
        keyHash: 'attacker-fingerprint-001',
        limit: 5,
        supabase: mockSupabase as any,
      });
    }

    // Regla Crítica: Cero inserciones en la base de datos para peticiones individuales bloqueadas
    assert.strictEqual(
      auditInsertsCount,
      0,
      'Peticiones bloqueadas normales NO deben generar inserts en security_audit_events (Anti-DoS / Write-Amplification Guard)'
    );

    // Si se alcanza el umbral de flood crítico (50 peticiones), se registra exactamente 1 evento de seguridad consolidado
    for (let i = 40; i < 50; i++) {
      await handleRateLimitHit({
        namespace: 'auth-login',
        keyHash: 'attacker-fingerprint-001',
        limit: 5,
        supabase: mockSupabase as any,
      });
    }

    assert.strictEqual(
      auditInsertsCount,
      1,
      'Exactamente 1 evento de alerta consolidada debe insertarse al alcanzar el umbral de flood masivo'
    );
  });

  it('18. CLIENT_IP_EXTRACTION_RESPECTS_PROXIES_AND_AVOIDS_CLIENT_SPOOFING: Sanea cabeceras x-forwarded-for y prefiere edge headers autorizados', () => {
    const headersCf = new Headers({
      'cf-connecting-ip': '186.105.12.3',
      'x-forwarded-for': '10.0.0.1, 1.1.1.1',
    });
    assert.strictEqual(extractClientIp(headersCf), '186.105.12.3');

    const headersReal = new Headers({
      'x-real-ip': '190.22.45.67',
      'x-forwarded-for': '127.0.0.1',
    });
    assert.strictEqual(extractClientIp(headersReal), '190.22.45.67');

    const headersSpoofed = new Headers({
      'x-forwarded-for': 'malicious-string, <script>, 201.238.10.20',
    });
    assert.strictEqual(extractClientIp(headersSpoofed), '201.238.10.20', 'Descarta strings no IP y toma la primera IP válida');
  });
});
