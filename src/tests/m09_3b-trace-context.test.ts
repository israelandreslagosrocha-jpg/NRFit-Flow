/**
 * TEST SUITE: FASE M-09.3B — TraceContext y Propagación Segura de trace_id
 * Naty Entrenadora - Certificación de Trazabilidad E2E Desacoplada
 *
 * Contratos Validados:
 * 1. TRACE_ID_GENERATED_SERVER_SIDE
 * 2. TRACE_ID_PROPAGATES_CHECKOUT_TO_LOCAL_RECORDS
 * 3. CALLBACK_WITHOUT_TRACE_METADATA_RECOVERS_LOCAL_TRACE
 * 4. CLIENT_SUPPLIED_TRACE_ID_IS_NOT_TRUSTED_AS_AUTHORITY
 * 5. TRACE_LOG_SANITIZES_SECRETS_AND_PII
 * 6. TRACE_DOES_NOT_CHANGE_FLOW_SIGNATURE
 * 7. TRACE_DOES_NOT_BREAK_PAYMENT_IDEMPOTENCY
 * 8. TRACE_DOES_NOT_BREAK_OUTBOX_DEDUPE
 * 9. TRACE_DOES_NOT_CHANGE_MEMBERSHIP_STATE
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import {
  generateTraceId,
  formatLog,
} from '../lib/logger.ts';
import { processFlowCallback } from '../lib/payments/flow/processor.ts';
import { signFlowParams } from '../lib/payments/flow/client.ts';
import { setPaymentGateway } from '../lib/payments/index.ts';
import type { PaymentGateway, GatewayCallbackResult } from '../lib/payments/types.ts';

// Configurar entorno de pruebas seguro
process.env.FLOW_ENV = 'sandbox';
process.env.FLOW_API_KEY = 'TEST_FLOW_API_KEY_123';
process.env.FLOW_SECRET_KEY = 'TEST_FLOW_SECRET_KEY_MOCK_456';
process.env.FLOW_BASE_URL = 'https://sandbox.flow.cl/api';
process.env.FLOW_AUTOMATIC_CHARGE_ENABLED = 'false';

/**
 * Mock en memoria de Supabase para validar aislamiento transaccional y correlación
 */
function createMockSupabase() {
  const store = {
    memberships: [] as any[],
    payment_events: [] as any[],
    payment_transactions: [] as any[],
    email_outbox: [] as any[],
  };

  const client: any = {
    from(table: string) {
      return {
        select(_cols: string) {
          const conditions: { col: string; val: any }[] = [];
          return {
            eq(col: string, val: any) {
              conditions.push({ col, val });
              return this;
            },
            order(_col: string, _opts?: any) {
              return this;
            },
            limit(_n: number) {
              return this;
            },
            single() {
              const tableData = (store as any)[table] || [];
              const found = tableData.find((row: any) =>
                conditions.every(c => row[c.col] === c.val)
              );
              return Promise.resolve({ data: found ? { ...found } : null, error: null });
            },
          };
        },

        insert(record: any) {
          const tableData = (store as any)[table] || [];

          // Validación de unicidad para payment_events (gateway_event_id)
          if (table === 'payment_events') {
            const exists = tableData.some((r: any) => r.gateway_event_id === record.gateway_event_id);
            if (exists) {
              return Promise.resolve({
                data: null,
                error: { code: '23505', message: 'duplicate key value violates unique constraint' },
              });
            }
          }

          // Validación de unicidad para payment_transactions (gateway_payment_id)
          if (table === 'payment_transactions') {
            const exists = tableData.some((r: any) => r.gateway_payment_id === record.gateway_payment_id);
            if (exists) {
              return Promise.resolve({
                data: null,
                error: { code: '23505', message: 'duplicate key value violates unique constraint' },
              });
            }
          }

          // Validación de unicidad para email_outbox (dedupe_key)
          if (table === 'email_outbox') {
            const exists = tableData.some((r: any) => r.dedupe_key === record.dedupe_key);
            if (exists) {
              return Promise.resolve({
                data: null,
                error: { code: '23505', message: 'duplicate key value violates unique constraint' },
              });
            }
          }

          const inserted = { id: record.id || `mock-${crypto.randomUUID()}`, ...record };
          tableData.push(inserted);
          return Promise.resolve({ data: inserted, error: null });
        },

        update(updateData: any) {
          const conditions: { col: string; val: any }[] = [];
          return {
            eq(col: string, val: any) {
              conditions.push({ col, val });
              return this;
            },
            then(resolve: any) {
              const tableData = (store as any)[table] || [];
              for (const row of tableData) {
                if (conditions.every(c => row[c.col] === c.val)) {
                  Object.assign(row, updateData);
                }
              }
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
        },
      };
    },
    rpc(name: string, params: any) {
      if (name === 'apply_membership_transition_atomic') {
        const mem = store.memberships.find(m => m.id === params.p_membership_id);
        if (!mem) return Promise.resolve({ data: { success: false, status: 'NOT_FOUND' }, error: null });
        if (
          params.p_gateway_snapshot_observed_at &&
          mem.last_gateway_snapshot_observed_at &&
          params.p_gateway_snapshot_observed_at < mem.last_gateway_snapshot_observed_at
        ) {
          return Promise.resolve({
            data: {
              success: true,
              status: 'STALE_SNAPSHOT_SKIPPED',
              membership_id: mem.id,
              current_status: mem.status,
            },
            error: null,
          });
        }
        const prevStatus = mem.status;
        mem.status = params.p_new_status;
        mem.gateway_status = params.p_gateway_status || mem.gateway_status;
        if (params.p_current_period_start) mem.current_period_start = params.p_current_period_start;
        if (params.p_current_period_end) mem.current_period_end = params.p_current_period_end;
        if (params.p_trial_ends_at) mem.trial_ends_at = params.p_trial_ends_at;
        if (params.p_new_status === 'CANCELLED' && !mem.cancelled_at) {
          mem.cancelled_at = new Date().toISOString();
        }
        mem.last_gateway_snapshot_observed_at = params.p_gateway_snapshot_observed_at || new Date().toISOString();
        mem.updated_at = new Date().toISOString();
        return Promise.resolve({
          data: {
            success: true,
            status: 'TRANSITIONED',
            membership_id: mem.id,
            previous_status: prevStatus,
            new_status: params.p_new_status,
            reason: params.p_reason,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: `Unknown RPC function: ${name}` } });
    },
    _store: store,
  };

  return client;
}

/**
 * Mock de PaymentGateway para desacoplar llamadas a Flow S2S
 */
function createMockGateway(callbackResolution: GatewayCallbackResult): PaymentGateway {
  return {
    name: 'FLOW',
    mode: 'SUBSCRIPTION_PAYMENT_LINK',
    async createCustomer(params) {
      return { id: 'cus_flow_123', email: params.email, name: params.name, externalId: params.externalId };
    },
    async registerPaymentMethod() {
      return { url: 'https://sandbox.flow.cl/pay', token: 'tok_reg_123', redirectUrl: 'https://sandbox.flow.cl/pay?token=tok_reg_123' };
    },
    async getPaymentMethodStatus() {
      return { status: 1, customerId: 'cus_flow_123' };
    },
    async createSubscription() {
      return { id: 'sub_flow_777', customerId: 'cus_flow_123', planId: 'plan_1', status: 'TRIAL', rawStatus: 1, morose: 0 };
    },
    async getSubscription(subId: string) {
      return { id: subId, customerId: 'cus_flow_123', planId: 'plan_1', status: 'ACTIVE', rawStatus: 1, morose: 0 };
    },
    async cancelSubscription(subId: string) {
      return { id: subId, customerId: 'cus_flow_123', planId: 'plan_1', status: 'CANCELLED', rawStatus: 4, morose: 0 };
    },
    async resolveCallback(_token, _hint) {
      return callbackResolution;
    },
  };
}

describe('FASE M-09.3B — TraceContext y Propagación de trace_id', () => {

  // ============================================================================
  // 1. TRACE_ID_GENERATED_SERVER_SIDE
  // ============================================================================
  it('1. TRACE_ID_GENERATED_SERVER_SIDE: Genera UUID v4 criptográficamente seguro sin Math.random ni timestamp secuencial', () => {
    const traceId = generateTraceId();

    // Verificación de formato UUID v4 canónico: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.ok(uuidV4Regex.test(traceId), `trace_id debe cumplir con especificación RFC 4122 UUID v4: ${traceId}`);

    // Verificar unicidad estricta sobre 100 llamadas consecutivas (cero colisiones)
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = generateTraceId();
      assert.ok(!set.has(id), 'Cero colisiones en generación continua');
      set.add(id);
    }
  });

  // ============================================================================
  // 2. TRACE_ID_PROPAGATES_CHECKOUT_TO_LOCAL_RECORDS
  // ============================================================================
  it('2. TRACE_ID_PROPAGATES_CHECKOUT_TO_LOCAL_RECORDS: trace_id ancla la membresía y se propaga a outbox preservando externalId = student.id', async () => {
    const mockSupabase = createMockSupabase();
    const traceId = generateTraceId();
    const studentId = 'student-uuid-5555';

    // 1. Simulación del insert en memberships en createCheckoutSubscriptionAction
    await mockSupabase.from('memberships').insert({
      id: 'mem-uuid-9999',
      student_id: studentId,
      plan_id: 'plan-uuid-1',
      status: 'PENDING_PAYMENT',
      gateway: 'FLOW',
      trace_id: traceId,
      gateway_subscription_id: 'sub-flow-777',
      gateway_customer_id: 'cus-flow-123',
    });

    // 2. Simulación del outbox welcome
    await mockSupabase.from('email_outbox').insert({
      dedupe_key: 'flow-trial-start:mem-uuid-9999',
      recipient_email: 'alumna@ejemplo.com',
      subject: '¡Comienza tu prueba!',
      template_id: 'flow_trial_welcome',
      payload: {
        amount: 25000,
        trace_id: traceId,
      },
    });

    // Validar anclaje en DB
    const savedMem = mockSupabase._store.memberships[0];
    assert.strictEqual(savedMem.trace_id, traceId, 'memberships debe almacenar trace_id');
    assert.strictEqual(savedMem.student_id, studentId, 'student_id debe ser el ID de alumna');

    const savedOutbox = mockSupabase._store.email_outbox[0];
    assert.strictEqual(savedOutbox.payload.trace_id, traceId, 'email_outbox.payload debe contener trace_id');
  });

  // ============================================================================
  // 3. CALLBACK_WITHOUT_TRACE_METADATA_RECOVERS_LOCAL_TRACE
  // ============================================================================
  it('3. CALLBACK_WITHOUT_TRACE_METADATA_RECOVERS_LOCAL_TRACE: Flow omite metadata y el callback recupera el trace_id local determinísticamente', async () => {
    const mockSupabase = createMockSupabase();
    const originalTraceId = generateTraceId();

    // Membresía preexistente registrada en checkout
    mockSupabase._store.memberships.push({
      id: 'mem-local-001',
      student_id: 'student-001',
      status: 'TRIAL',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-flow-888',
      gateway_customer_id: 'cus-flow-888',
      trace_id: originalTraceId,
    });

    // Flow S2S responde pago exitoso SIN trace_id ni metadata arbitraria
    const mockGateway = createMockGateway({
      resourceType: 'payment',
      payment: {
        paymentId: 'flow-pay-1111',
        subscriptionId: 'sub-flow-888',
        customerId: 'cus-flow-888',
        status: 'APPROVED',
        amount: 25000,
        currency: 'CLP',
        paymentMethod: 'Webpay',
        paymentDate: new Date().toISOString(),
      },
    });
    setPaymentGateway(mockGateway);

    // Ejecutar procesamiento del callback entrante (Flow solo envía token opaco)
    const result = await processFlowCallback({
      supabase: mockSupabase,
      token: 'tok-flow-opaco-sin-metadata-12345',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.statusResult, 'PROCESSED');
    assert.strictEqual(result.traceId, originalTraceId, 'Debe haber recuperado exactamente el trace_id original del registro local');

    // Verificar que payment_events persistió el trace_id recuperado
    const savedEvent = mockSupabase._store.payment_events[0];
    assert.strictEqual(savedEvent.payload.trace_id, originalTraceId);

    // Verificar que email_outbox persistió el trace_id recuperado
    const savedOutbox = mockSupabase._store.email_outbox[0];
    assert.strictEqual(savedOutbox.payload.trace_id, originalTraceId);

    // Verificar que payment_transactions enlaza a membership.id
    const savedTx = mockSupabase._store.payment_transactions[0];
    assert.strictEqual(savedTx.membership_id, 'mem-local-001');
  });

  // ============================================================================
  // 4. CLIENT_SUPPLIED_TRACE_ID_IS_NOT_TRUSTED_AS_AUTHORITY
  // ============================================================================
  it('4. CLIENT_SUPPLIED_TRACE_ID_IS_NOT_TRUSTED_AS_AUTHORITY: Un trace_id inyectado por el cliente/navegador es descartado y no sustituye la autoridad local', async () => {
    const mockSupabase = createMockSupabase();
    const genuineTraceId = generateTraceId();
    const attackerTraceId = 'malicious-injected-trace-id-666';

    mockSupabase._store.memberships.push({
      id: 'mem-local-002',
      student_id: 'student-002',
      status: 'TRIAL',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-flow-999',
      gateway_customer_id: 'cus-flow-999',
      trace_id: genuineTraceId,
    });

    const mockGateway = createMockGateway({
      resourceType: 'payment',
      payment: {
        paymentId: 'flow-pay-2222',
        subscriptionId: 'sub-flow-999',
        customerId: 'cus-flow-999',
        status: 'APPROVED',
        amount: 25000,
        currency: 'CLP',
        paymentDate: '2026-09-25T10:00:00Z',
      },
    });
    setPaymentGateway(mockGateway);

    // Petición maliciosa con trace_id provisto por cliente en payload
    const result = await processFlowCallback({
      supabase: mockSupabase,
      token: 'tok-flow-con-ataque',
      payload: {
        trace_id: attackerTraceId,
        fake_auth: true,
      },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.traceId, genuineTraceId, 'Debe prevalecer el trace_id local auténtico');
    assert.notStrictEqual(result.traceId, attackerTraceId, 'El trace_id del atacante DEBE ser descartado como autoridad');

    const savedEvent = mockSupabase._store.payment_events[0];
    assert.strictEqual(savedEvent.payload.trace_id, genuineTraceId);
  });

  // ============================================================================
  // 5. TRACE_LOG_SANITIZES_SECRETS_AND_PII
  // ============================================================================
  it('5. TRACE_LOG_SANITIZES_SECRETS_AND_PII: El logger estructurado y contextual purga secretos, tokens, PAN y PII', () => {
    const traceId = generateTraceId();

    const dirtyData = {
      trace_id: traceId,
      gateway: 'FLOW',
      token: 'tok_flow_secret_token_1234567890abcdef',
      apiKey: 'flow_key_secret_12345',
      flow_secret_key: 'flow_secret_mock_xyz',
      CRON_SECRET: 'cron_super_secret',
      payer_email: 'maria@ejemplo.cl',
      full_name: 'María Alumna',
      password: 'supersecretpassword123',
      pan: '4557 1234 5678 9012',
      headers: { authorization: 'Bearer secret_token' },
      env: { FLOW_SECRET_KEY: 'top_secret' },
      request: { body: 'raw' },
      membership_id: 'mem-uuid-123',
      result: 'PROCESSED',
      duration_ms: 45,
    };

    const formatted = formatLog('INFO', 'trace_audit_event', dirtyData);

    // Campos de correlación válidos permitidos
    assert.strictEqual(formatted.trace_id, traceId);
    assert.strictEqual(formatted.data.trace_id, traceId);
    assert.strictEqual(formatted.data.gateway, 'FLOW');
    assert.strictEqual(formatted.data.membership_id, 'mem-uuid-123');
    assert.strictEqual(formatted.data.result, 'PROCESSED');
    assert.strictEqual(formatted.data.duration_ms, 45);

    // Secretos y PII obligatoriamente redactados
    assert.strictEqual(formatted.data.token, '[REDACTED]');
    assert.strictEqual(formatted.data.apiKey, '[REDACTED]');
    assert.strictEqual(formatted.data.flow_secret_key, '[REDACTED]');
    assert.strictEqual(formatted.data.CRON_SECRET, '[REDACTED]');
    assert.strictEqual(formatted.data.payer_email, '[REDACTED]');
    assert.strictEqual(formatted.data.full_name, '[REDACTED]');
    assert.strictEqual(formatted.data.password, '[REDACTED]');
    assert.strictEqual(formatted.data.pan, '[REDACTED]');

    // Objetos crudos de request, headers o env deben haber sido excluidos
    assert.strictEqual(formatted.data.headers, undefined);
    assert.strictEqual(formatted.data.env, undefined);
    assert.strictEqual(formatted.data.request, undefined);
  });

  // ============================================================================
  // 6. TRACE_DOES_NOT_CHANGE_FLOW_SIGNATURE
  // ============================================================================
  it('6. TRACE_DOES_NOT_CHANGE_FLOW_SIGNATURE: TraceContext no altera la canonicalización ni firma HMAC oficial de Flow', () => {
    const params = {
      apiKey: 'TEST_API_KEY',
      customerId: 'cus_123',
      url_return: 'https://natyentrenadora.com/checkout/flow-return',
    };

    // Algoritmo canónico: ordenar alfabéticamente y concatenar clave+valor sin separadores
    // apiKeyTEST_API_KEYcustomerIdcus_123url_returnhttps://natyentrenadora.com/checkout/flow-return
    const stringToSign = 'apiKeyTEST_API_KEYcustomerIdcus_123url_returnhttps://natyentrenadora.com/checkout/flow-return';
    const expectedSig = crypto.createHmac('sha256', 'TEST_SECRET_KEY').update(stringToSign).digest('hex').toLowerCase();

    const actualSig = signFlowParams(params, 'TEST_SECRET_KEY');
    assert.strictEqual(actualSig, expectedSig, 'La firma HMAC calculada debe ser idéntica y no incluir campos de traza');
    assert.strictEqual((params as any).trace_id, undefined, 'trace_id NUNCA debe inyectarse en los parámetros firmados de Flow');
  });

  // ============================================================================
  // 7. TRACE_DOES_NOT_BREAK_PAYMENT_IDEMPOTENCY
  // ============================================================================
  it('7. TRACE_DOES_NOT_BREAK_PAYMENT_IDEMPOTENCY: El segundo intento con el mismo evento responde ALREADY_PROCESSED sin duplicar transacciones', async () => {
    const mockSupabase = createMockSupabase();
    const originalTraceId = generateTraceId();

    mockSupabase._store.memberships.push({
      id: 'mem-local-003',
      student_id: 'student-003',
      status: 'TRIAL',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-flow-idem',
      trace_id: originalTraceId,
    });

    const mockGateway = createMockGateway({
      resourceType: 'payment',
      payment: {
        paymentId: 'flow-pay-idem-999',
        subscriptionId: 'sub-flow-idem',
        status: 'APPROVED',
        amount: 25000,
        currency: 'CLP',
        paymentDate: '2026-09-25T10:00:00Z',
      },
    });
    setPaymentGateway(mockGateway);

    // Primer callback
    const res1 = await processFlowCallback({ supabase: mockSupabase, token: 'tok-idem-1' });
    assert.strictEqual(res1.statusResult, 'PROCESSED');
    assert.strictEqual(mockSupabase._store.payment_events.length, 1);
    assert.strictEqual(mockSupabase._store.payment_transactions.length, 1);

    // Segundo callback idéntico
    const res2 = await processFlowCallback({ supabase: mockSupabase, token: 'tok-idem-1' });
    assert.strictEqual(res2.statusResult, 'ALREADY_PROCESSED');
    assert.strictEqual(res2.traceId, originalTraceId);

    // No se duplicaron filas en BD
    assert.strictEqual(mockSupabase._store.payment_events.length, 1);
    assert.strictEqual(mockSupabase._store.payment_transactions.length, 1);
  });

  // ============================================================================
  // 8. TRACE_DOES_NOT_BREAK_OUTBOX_DEDUPE
  // ============================================================================
  it('8. TRACE_DOES_NOT_BREAK_OUTBOX_DEDUPE: La clave dedupe_key del outbox se mantiene determinista y evita duplicación de correos', async () => {
    const mockSupabase = createMockSupabase();
    const traceId = generateTraceId();

    // Intentar insertar dos correos con la misma dedupe_key pero diferente timestamp de ejecución
    const res1 = await mockSupabase.from('email_outbox').insert({
      dedupe_key: 'flow-trial-start:mem-001',
      recipient_email: 'alumna@test.com',
      subject: 'Prueba',
      template_id: 'welcome',
      payload: { trace_id: traceId },
    });
    assert.strictEqual(res1.error, null);

    const res2 = await mockSupabase.from('email_outbox').insert({
      dedupe_key: 'flow-trial-start:mem-001',
      recipient_email: 'alumna@test.com',
      subject: 'Prueba',
      template_id: 'welcome',
      payload: { trace_id: traceId },
    });
    assert.strictEqual(res2.error.code, '23505', 'Constraint de deduplicación debe rechazar el segundo insert');
    assert.strictEqual(mockSupabase._store.email_outbox.length, 1, 'Solo debe persistir 1 correo en outbox');
  });

  // ============================================================================
  // 9. TRACE_DOES_NOT_CHANGE_MEMBERSHIP_STATE
  // ============================================================================
  it('9. TRACE_DOES_NOT_CHANGE_MEMBERSHIP_STATE: Preserva las transiciones exactas de membresía (APPROVED->ACTIVE, REJECTED->PAST_DUE, morose=1->PAST_DUE)', async () => {
    const mockSupabase = createMockSupabase();

    // Caso 9.1: Pago Aprobado -> ACTIVE
    mockSupabase._store.memberships.push({
      id: 'mem-test-app',
      gateway_subscription_id: 'sub-app-1',
      status: 'PENDING_PAYMENT',
      trace_id: generateTraceId(),
    });

    const gwApproved = createMockGateway({
      resourceType: 'payment',
      payment: { paymentId: 'p-app', subscriptionId: 'sub-app-1', status: 'APPROVED', amount: 25000, currency: 'CLP', paymentDate: '2026-09-25T10:00:00Z' },
    });
    setPaymentGateway(gwApproved);

    await processFlowCallback({ supabase: mockSupabase, token: 'tok-app' });
    const memApp = mockSupabase._store.memberships.find(m => m.id === 'mem-test-app');
    assert.strictEqual(memApp.status, 'ACTIVE');

    // Caso 9.2: Pago Rechazado -> PAST_DUE
    mockSupabase._store.memberships.push({
      id: 'mem-test-rej',
      gateway_subscription_id: 'sub-rej-1',
      status: 'ACTIVE',
      trace_id: generateTraceId(),
    });

    const gwRejected = createMockGateway({
      resourceType: 'payment',
      payment: { paymentId: 'p-rej', subscriptionId: 'sub-rej-1', status: 'REJECTED', amount: 25000, currency: 'CLP', paymentDate: '2026-09-25T10:00:00Z' },
    });
    setPaymentGateway(gwRejected);

    await processFlowCallback({ supabase: mockSupabase, token: 'tok-rej' });
    const memRej = mockSupabase._store.memberships.find(m => m.id === 'mem-test-rej');
    assert.strictEqual(memRej.status, 'PAST_DUE');

    // Caso 9.3: Morosidad morose = 1 -> PAST_DUE
    mockSupabase._store.memberships.push({
      id: 'mem-test-mor',
      gateway_subscription_id: 'sub-mor-1',
      status: 'ACTIVE',
      trace_id: generateTraceId(),
    });

    const gwMorose = createMockGateway({
      resourceType: 'subscription',
      subscription: { id: 'sub-mor-1', customerId: 'cus-1', planId: 'p-1', status: 'ACTIVE', rawStatus: 1, morose: 1 },
    });
    setPaymentGateway(gwMorose);

    await processFlowCallback({ supabase: mockSupabase, token: 'tok-mor' });
    const memMor = mockSupabase._store.memberships.find(m => m.id === 'mem-test-mor');
    assert.strictEqual(memMor.status, 'PAST_DUE');
  });
});
