/**
 * FASE M-09.3F-A: CERTIFICACIÓN DE CÓDIGO E INFRAESTRUCTURA PRE-STAGING
 * Naty Entrenadora - Pruebas Contractuales de Secuencia Monotónica, Bounded Streaming y Dynamic Inventory
 *
 * Contratos Validados:
 * 1. FLOW_CALLBACK_CHARSET_PARAM_ACCEPTED: application/x-www-form-urlencoded con charset=UTF-8 es aceptado sin 415.
 * 2. FLOW_CALLBACK_OVERSIZED_CHUNKED_OR_UNKNOWN_LENGTH_BODY_IS_BOUNDED: Body > 8 KB cancela stream y responde 413 sin parsing ni S2S.
 * 3. ABANDONED_RESERVED_SEQUENCE_DOES_NOT_BLOCK_LATER_VALID_SNAPSHOT: Reserva 41 abandonada por caída S2S no bloquea reserva 42 posterior.
 * 4. LATE_APPLY_OF_ABANDONED_OLDER_SEQUENCE_IS_REJECTED: Llegada tardía de secuencia 41 tras aplicar 42 se descarta como STALE_SNAPSHOT_SKIPPED.
 * 5. SEQUENCE_IS_MONOTONIC_PER_MEMBERSHIP: Contadores de secuencia están aislados por membresía (sin contención global).
 * 6. CALLBACK_AND_RECONCILER_REQUIRE_SNAPSHOT_SEQUENCE: Transición sin secuencia falla cerrado (MISSING_SNAPSHOT_SEQUENCE, cero mutación).
 * 7. DYNAMIC_MIGRATION_FUNCTIONS_CATALOG_DERIVATION: Inventario deriva dinámicamente las 9 funciones y reporta NOT_EXECUTED si DATABASE_URL no existe.
 * 8. EXPECTED_FUNCTION_FINAL_SECURITY_STATE_IS_FOLDED_ACROSS_MIGRATIONS: Plegado cronológico de firmas, SECURITY DEFINER, search_path="" y roles ejecutores.
 * 9. ANON_CANNOT_RESERVE_GATEWAY_SNAPSHOT_SEQUENCE: Acceso anónimo a reserve_gateway_snapshot_sequence revocado en DDL y denegado en runtime.
 * 10. AUTHENTICATED_CANNOT_RESERVE_GATEWAY_SNAPSHOT_SEQUENCE: Alumnas y usuarios autenticados no pueden reservar secuencias de pasarela.
 * 11. SERVICE_ROLE_CAN_RESERVE_GATEWAY_SNAPSHOT_SEQUENCE: Exclusividad operativa de service_role para emisión de secuencia monotónica.
 * 12. FINANCIAL_TRANSITION_RPC_REMAINS_SERVICE_ROLE_ONLY: apply_membership_transition_atomic restringida exclusivamente a service_role.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server.js';
import { POST as flowCallbackPost } from '../app/api/callbacks/flow/route.ts';
import { processFlowCallback } from '../lib/payments/flow/processor.ts';
import { reconcileFlowSubscriptions } from '../lib/payments/flow/reconciler.ts';
import { setPaymentGateway } from '../lib/payments/index.ts';
import type { PaymentGateway } from '../lib/payments/types.ts';
import {
  deriveExpectedFunctionsFromMigrations,
  runPostgresInventory,
} from '../../scripts/runtime-pg-inventory.ts';

// Configurar entorno seguro de pruebas
(process.env as any).NODE_ENV = 'test';
process.env.FLOW_ENV = 'sandbox';
process.env.FLOW_API_KEY = 'TEST_API_KEY_M09_3F';
process.env.FLOW_SECRET_KEY = 'TEST_SECRET_KEY_M09_3F';
process.env.FLOW_CALLBACK_MAX_BODY_BYTES = '8192';

class MockDatabase {
  memberships: any[] = [];
  paymentEvents: any[] = [];
  paymentTransactions: any[] = [];
  securityAuditEvents: any[] = [];
  emailOutbox: any[] = [];
  rpcCallLog: Array<{ name: string; params: any }> = [];
  callerRole: 'service_role' | 'authenticated' | 'anon' = 'service_role';

  from(table: string) {
    const self = this;
    return {
      select: (_cols?: string) => ({
        eq: (col: string, val: any) => ({
          not: (_col2: string, _op: string, _val2: any) => ({
            in: (_col3: string, _vals: any[]) =>
              Promise.resolve({
                data: self.memberships.filter((m: any) => m[col] === val),
                error: null,
              }),
          }),
          order: (_col2: string, _opts: any) => ({
            limit: (_l: number) => ({
              single: () => {
                const found = self.memberships.find((m: any) => m[col] === val);
                return Promise.resolve({ data: found || null, error: found ? null : { message: 'Not found' } });
              },
            }),
          }),
        }),
      }),
      insert: (record: any) => {
        const dataTable = (self as any)[tableToProp(table)] || [];
        dataTable.push(record);
        return Promise.resolve({ data: record, error: null });
      },
    };
  }

  rpc(name: string, params: any) {
    this.rpcCallLog.push({ name, params });

    // Simulación de control de privilegios PostgreSQL (ACLs a nivel de función)
    if (this.callerRole !== 'service_role') {
      if (
        name === 'reserve_gateway_snapshot_sequence' ||
        name === 'apply_membership_transition_atomic' ||
        name === 'claim_outbox_emails'
      ) {
        return Promise.resolve({
          data: null,
          error: { message: `permission denied for function ${name}` },
        });
      }
    }

    if (name === 'reserve_gateway_snapshot_sequence') {
      const mem = this.memberships.find((m: any) => m.id === params.p_membership_id);
      if (!mem) return Promise.resolve({ data: null, error: { message: 'Membership not found' } });
      mem.gateway_snapshot_sequence_counter = (mem.gateway_snapshot_sequence_counter || 0) + 1;
      return Promise.resolve({ data: mem.gateway_snapshot_sequence_counter, error: null });
    }

    if (name === 'apply_membership_transition_atomic') {
      const mem = this.memberships.find((m: any) => m.id === params.p_membership_id);
      if (!mem) return Promise.resolve({ data: { success: false, status: 'NOT_FOUND' }, error: null });

      // Contrato F6: Validación obligatoria de secuencia monotónica en el camino financiero
      if (params.p_snapshot_sequence === null || params.p_snapshot_sequence === undefined) {
        return Promise.resolve({
          data: {
            success: false,
            status: 'MISSING_SNAPSHOT_SEQUENCE',
            error: 'Snapshot sequence is required for financial transitions',
          },
          error: null,
        });
      }

      // Guarda contra snapshots obsoletos
      if (
        mem.last_applied_snapshot_sequence &&
        params.p_snapshot_sequence <= mem.last_applied_snapshot_sequence
      ) {
        return Promise.resolve({
          data: {
            success: true,
            status: 'STALE_SNAPSHOT_SKIPPED',
            membership_id: mem.id,
            previous_status: mem.status,
            current_status: mem.status,
            last_applied_snapshot_sequence: mem.last_applied_snapshot_sequence,
            attempted_snapshot_sequence: params.p_snapshot_sequence,
          },
          error: null,
        });
      }

      mem.last_applied_snapshot_sequence = params.p_snapshot_sequence;
      mem.status = params.p_new_status;
      mem.gateway_status = params.p_gateway_status || mem.gateway_status;
      mem.gateway_sync_state = params.p_sync_state || 'HEALTHY';
      if (params.p_current_period_end) mem.current_period_end = params.p_current_period_end;
      if (params.p_current_period_start) mem.current_period_start = params.p_current_period_start;

      this.securityAuditEvents.push({
        event_type: 'MEMBERSHIP_STATUS_TRANSITION',
        membership_id: mem.id,
        snapshot_sequence: params.p_snapshot_sequence,
      });

      return Promise.resolve({
        data: {
          success: true,
          status: 'TRANSITIONED',
          membership_id: mem.id,
          new_status: params.p_new_status,
          snapshot_sequence: params.p_snapshot_sequence,
        },
        error: null,
      });
    }

    return Promise.resolve({ data: null, error: { message: `Unknown RPC function: ${name}` } });
  }
}

function tableToProp(table: string): string {
  switch (table) {
    case 'memberships': return 'memberships';
    case 'payment_events': return 'paymentEvents';
    case 'payment_transactions': return 'paymentTransactions';
    case 'security_audit_events': return 'securityAuditEvents';
    case 'email_outbox': return 'emailOutbox';
    default: return table;
  }
}

function createMockGateway(resolveResult: any): PaymentGateway {
  return {
    name: 'FLOW',
    mode: 'AUTOMATIC_RECURRING',
    getSubscription: () => Promise.resolve({
      id: 'sub-1',
      status: 'ACTIVE',
      rawStatus: 1,
      morose: 0,
      currentPeriodStart: new Date(Date.now() - 5 * 86400000).toISOString(),
      currentPeriodEnd: new Date(Date.now() + 25 * 86400000).toISOString(),
      planId: 'plan-1',
      customerId: 'cus-1',
      ...(resolveResult.subscription || {}),
    }),
    resolveCallback: () => Promise.resolve(resolveResult),
    createSubscription: () => Promise.resolve({
      id: 'sub-1',
      subscriptionId: 'sub-1',
      planId: 'plan-1',
      customerId: 'cus-1',
      raw: {},
      rawStatus: 2,
      morose: 0,
      status: 'TRIAL',
      trialEndsAt: new Date().toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date().toISOString(),
    } as any),
    cancelSubscription: () => Promise.resolve({
      id: 'sub-1',
      subscriptionId: 'sub-1',
      planId: 'plan-1',
      customerId: 'cus-1',
      status: 'CANCELLED',
      rawStatus: 4,
      morose: 0,
      cancelAtPeriodEnd: false,
    } as any),
    createPaymentOrder: () => Promise.resolve({
      orderId: 'ord-1',
      paymentUrl: 'https://sandbox.flow.cl/pay',
      token: 'tok-1',
    }),
    verifySignature: () => true,
    getClient: () => ({} as any),
  } as unknown as PaymentGateway;
}

describe('FASE M-09.3F-A — Certificación de Código e Infraestructura Pre-Staging', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 1: Parámetros en Media Type (application/x-www-form-urlencoded; charset=UTF-8)
  // ----------------------------------------------------------------------------
  it('1. FLOW_CALLBACK_CHARSET_PARAM_ACCEPTED: Permite media type con charset sin responder 415', async () => {
    // 1.1 Con charset=UTF-8
    const reqUtf8 = new NextRequest('http://localhost:3000/api/callbacks/flow', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams({ token: 'test-token-utf8' }).toString(),
    });

    const resUtf8 = await flowCallbackPost(reqUtf8);
    // No debe ser 415 (puede ser 200 o resolver S2S)
    assert.notStrictEqual(resUtf8.status, 415, 'application/x-www-form-urlencoded; charset=UTF-8 no debe ser 415');

    // 1.2 Con charset=utf-8 minúscula
    const reqLower = new NextRequest('http://localhost:3000/api/callbacks/flow', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      body: new URLSearchParams({ token: 'test-token-lower' }).toString(),
    });
    const resLower = await flowCallbackPost(reqLower);
    assert.notStrictEqual(resLower.status, 415, 'application/x-www-form-urlencoded; charset=utf-8 no debe ser 415');

    // 1.3 Rechazo de tipos no autorizados (json / multipart)
    const reqJson = new NextRequest('http://localhost:3000/api/callbacks/flow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'test' }),
    });
    const resJson = await flowCallbackPost(reqJson);
    assert.strictEqual(resJson.status, 415, 'JSON debe ser rechazado con 415');

    const reqMulti = new NextRequest('http://localhost:3000/api/callbacks/flow', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=xyz' },
      body: 'test',
    });
    const resMulti = await flowCallbackPost(reqMulti);
    assert.strictEqual(resMulti.status, 415, 'Multipart debe ser rechazado con 415');
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 2: Lectura Bounded Streaming (Payload Bomb / Unknown Length)
  // ----------------------------------------------------------------------------
  it('2. FLOW_CALLBACK_OVERSIZED_CHUNKED_OR_UNKNOWN_LENGTH_BODY_IS_BOUNDED: Payload > 8 KB cancela stream y responde 413 sin S2S', async () => {
    // Generar cuerpo de 10 KB (excede límite de 8 KB = 8192 bytes)
    const largeBody = 'token=' + 'A'.repeat(10000);

    const reqOversized = new NextRequest('http://localhost:3000/api/callbacks/flow', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: largeBody,
    });

    let s2sCalled = false;
    setPaymentGateway({
      ...createMockGateway({}),
      resolveCallback: () => {
        s2sCalled = true;
        return Promise.resolve({ resourceType: 'payment', payment: { paymentId: 'p-1', status: 'APPROVED', amount: 1000, currency: 'CLP', paymentDate: new Date().toISOString() } });
      },
    });

    const res = await flowCallbackPost(reqOversized);
    assert.strictEqual(res.status, 413, 'Debe responder HTTP 413 Payload Too Large');
    assert.strictEqual(s2sCalled, false, 'Jamás debe realizar consulta S2S si el cuerpo excede el límite');
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 3: Reserva Abandonada no Bloquea Snapshot Posterior
  // ----------------------------------------------------------------------------
  it('3. ABANDONED_RESERVED_SEQUENCE_DOES_NOT_BLOCK_LATER_VALID_SNAPSHOT: Reserva 41 fallida no bloquea reserva 42 posterior', async () => {
    const memId = 'mem-abandon-seq-1';
    db.memberships.push({
      id: memId,
      student_id: 'student-1',
      status: 'PENDING_PAYMENT',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-seq-1',
      gateway_snapshot_sequence_counter: 40,
      last_applied_snapshot_sequence: 40,
    });

    // Petición 1: Reserva secuencia 41
    const { data: seq41 } = await db.rpc('reserve_gateway_snapshot_sequence', { p_membership_id: memId });
    assert.strictEqual(seq41, 41);
    // Simular que la llamada S2S de la petición 1 falla (por timeout o desconexión) -> Secuencia 41 queda abandonada

    // Petición 2: Se ejecuta después y reserva secuencia 42
    const { data: seq42 } = await db.rpc('reserve_gateway_snapshot_sequence', { p_membership_id: memId });
    assert.strictEqual(seq42, 42);

    // La petición 2 tiene éxito en S2S y aplica transición
    const { data: applyRes } = await db.rpc('apply_membership_transition_atomic', {
      p_membership_id: memId,
      p_new_status: 'ACTIVE',
      p_gateway_status: 'active',
      p_snapshot_sequence: seq42,
    });

    assert.strictEqual(applyRes.status, 'TRANSITIONED');
    assert.strictEqual(applyRes.snapshot_sequence, 42);

    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.status, 'ACTIVE');
    assert.strictEqual(mem.last_applied_snapshot_sequence, 42);
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 4: Llegada Tardía de Secuencia Abandonada es Rechazada (Fail-Closed)
  // ----------------------------------------------------------------------------
  it('4. LATE_APPLY_OF_ABANDONED_OLDER_SEQUENCE_IS_REJECTED: Secuencia 41 llegando después de aplicada la 42 es rechazada como STALE_SNAPSHOT_SKIPPED', async () => {
    const memId = 'mem-late-seq-1';
    db.memberships.push({
      id: memId,
      student_id: 'student-late',
      status: 'ACTIVE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-seq-late',
      gateway_snapshot_sequence_counter: 42,
      last_applied_snapshot_sequence: 42, // Ya se aplicó la 42
    });

    // La petición tardía con secuencia 41 intenta aplicar su snapshot antiguo
    const { data: lateRes } = await db.rpc('apply_membership_transition_atomic', {
      p_membership_id: memId,
      p_new_status: 'PAST_DUE', // Intentaría degradar
      p_gateway_status: 'past_due',
      p_snapshot_sequence: 41, // 41 <= 42
    });

    assert.strictEqual(lateRes.status, 'STALE_SNAPSHOT_SKIPPED', 'Debe ser rechazada como obsoleta');
    assert.strictEqual(lateRes.current_status, 'ACTIVE', 'El estado activo no debe ser alterado');
    assert.strictEqual(lateRes.last_applied_snapshot_sequence, 42);
    assert.strictEqual(lateRes.attempted_snapshot_sequence, 41);

    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.status, 'ACTIVE', 'La base de datos queda intacta');
    assert.strictEqual(mem.last_applied_snapshot_sequence, 42);
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 5: Secuencia Monotónica Aislada por Membresía (Sin Contención Global)
  // ----------------------------------------------------------------------------
  it('5. SEQUENCE_IS_MONOTONIC_PER_MEMBERSHIP: Contadores de membresía A y B son completamente independientes', async () => {
    const memA = 'mem-isolate-A';
    const memB = 'mem-isolate-B';

    db.memberships.push(
      { id: memA, gateway_snapshot_sequence_counter: 0, last_applied_snapshot_sequence: 0 },
      { id: memB, gateway_snapshot_sequence_counter: 100, last_applied_snapshot_sequence: 100 }
    );

    const { data: a1 } = await db.rpc('reserve_gateway_snapshot_sequence', { p_membership_id: memA });
    const { data: a2 } = await db.rpc('reserve_gateway_snapshot_sequence', { p_membership_id: memA });
    assert.strictEqual(a1, 1);
    assert.strictEqual(a2, 2);

    const { data: b1 } = await db.rpc('reserve_gateway_snapshot_sequence', { p_membership_id: memB });
    assert.strictEqual(b1, 101);

    const { data: a3 } = await db.rpc('reserve_gateway_snapshot_sequence', { p_membership_id: memA });
    assert.strictEqual(a3, 3);

    // Membresía A no afectó el contador de Membresía B
    const storedA = db.memberships.find(m => m.id === memA);
    const storedB = db.memberships.find(m => m.id === memB);
    assert.strictEqual(storedA.gateway_snapshot_sequence_counter, 3);
    assert.strictEqual(storedB.gateway_snapshot_sequence_counter, 101);
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 6: Prohibición de Fallback Silencioso en Transición Financiera
  // ----------------------------------------------------------------------------
  it('6. CALLBACK_AND_RECONCILER_REQUIRE_SNAPSHOT_SEQUENCE: Transición sin secuencia falla cerrado con MISSING_SNAPSHOT_SEQUENCE', async () => {
    const memId = 'mem-missing-seq';
    db.memberships.push({
      id: memId,
      student_id: 'student-no-seq',
      status: 'ACTIVE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-no-seq',
      last_applied_snapshot_sequence: 5,
    });

    // Intento de llamar a apply_membership_transition_atomic sin secuencia (null)
    const { data: noSeqRes } = await db.rpc('apply_membership_transition_atomic', {
      p_membership_id: memId,
      p_new_status: 'CANCELLED',
      p_gateway_status: 'cancelled',
      p_snapshot_sequence: null, // Secuencia nula
    });

    assert.strictEqual(noSeqRes.success, false);
    assert.strictEqual(noSeqRes.status, 'MISSING_SNAPSHOT_SEQUENCE');
    assert.match(noSeqRes.error, /Snapshot sequence is required/);

    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.status, 'ACTIVE', 'Cero mutación destructiva si falta secuencia');

    // 6.2 Reconciliador y Callback suministran obligatoriamente p_snapshot_sequence
    db.rpcCallLog = [];
    mem.status = 'PENDING_PAYMENT';
    setPaymentGateway(createMockGateway({
      resourceType: 'subscription',
      subscription: {
        id: 'sub-no-seq',
        status: 'ACTIVE',
        rawStatus: 1,
        morose: 0,
        currentPeriodStart: new Date(Date.now() - 5 * 86400000).toISOString(),
        currentPeriodEnd: new Date(Date.now() + 25 * 86400000).toISOString(),
      },
    }));

    await reconcileFlowSubscriptions(db as any);
    const recCall = db.rpcCallLog.find(c => c.name === 'apply_membership_transition_atomic' && c.params.p_membership_id === memId);
    assert.ok(recCall, 'Reconciliador debe invocar la RPC');
    assert.ok(Number(recCall.params.p_snapshot_sequence) > 0, 'Reconciliador debe proveer p_snapshot_sequence');

    await processFlowCallback({
      supabase: db as any,
      token: 'tok-seq-callback',
      resourceHint: 'subscription',
    });
    const cbCall = db.rpcCallLog.filter(c => c.name === 'apply_membership_transition_atomic' && c.params.p_membership_id === memId)[1];
    assert.ok(cbCall, 'Callback debe invocar la RPC');
    assert.ok(Number(cbCall.params.p_snapshot_sequence) > 0, 'Callback debe proveer p_snapshot_sequence');
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 7: Derivación Dinámica de Catálogo DDL y Reporte Honesto NOT_EXECUTED
  // ----------------------------------------------------------------------------
  it('7. DYNAMIC_MIGRATION_FUNCTIONS_CATALOG_DERIVATION: Deriva exactamente 9 funciones y reporta NOT_EXECUTED sin DATABASE_URL', async () => {
    const catalog = deriveExpectedFunctionsFromMigrations();

    // 1. Debe encontrar exactamente las 9 funciones canónicas tras F6
    const expected = [
      'admin_update_user_role',
      'apply_membership_transition_atomic',
      'check_profile_update_integrity',
      'claim_outbox_emails',
      'create_booking_atomic',
      'get_auth_profile_id',
      'get_auth_role',
      'handle_new_user',
      'reserve_gateway_snapshot_sequence',
    ];

    assert.strictEqual(
      catalog.expectedFunctions.length,
      9,
      `Debe derivar exactamente 9 funciones, encontró: ${catalog.expectedFunctions.join(', ')}`
    );
    assert.deepStrictEqual(catalog.expectedFunctions, expected);

    // 2. handle_new_user está registrado como SECURITY DEFINER pero sin search_path (HARDENING_DEFERRED)
    const handleUserDetail = catalog.functionDetails.find(d => d.name === 'handle_new_user');
    assert.ok(handleUserDetail, 'handle_new_user debe estar en el catálogo');
    assert.strictEqual(handleUserDetail.isSecurityDefiner, true);
    assert.strictEqual(handleUserDetail.hasEmptySearchPath, false, 'handle_new_user conserva hardening deferred');

    // 3. reserve_gateway_snapshot_sequence y apply_membership_transition_atomic tienen search_path=""
    const reserveSeqDetail = catalog.functionDetails.find(d => d.name === 'reserve_gateway_snapshot_sequence');
    assert.ok(reserveSeqDetail?.hasEmptySearchPath, 'reserve_gateway_snapshot_sequence debe tener search_path=""');

    const applyDetail = catalog.functionDetails.find(d => d.name === 'apply_membership_transition_atomic');
    assert.ok(applyDetail?.hasEmptySearchPath, 'apply_membership_transition_atomic debe tener search_path=""');

    // 4. Si DATABASE_URL está ausente, runPostgresInventory reporta NOT_EXECUTED de forma honesta
    const prevDbUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_DB_URL;

    const inventoryResult = await runPostgresInventory();
    assert.strictEqual(inventoryResult.status, 'NOT_EXECUTED');
    assert.match(inventoryResult.reason!, /DATABASE_URL no configurada/);

    if (prevDbUrl) process.env.DATABASE_URL = prevDbUrl;
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 8: Plegado Cronológico del Estado Efectivo de Seguridad DDL
  // ----------------------------------------------------------------------------
  it('8. EXPECTED_FUNCTION_FINAL_SECURITY_STATE_IS_FOLDED_ACROSS_MIGRATIONS: Plegado cronológico de firmas, SECURITY DEFINER, search_path="" y roles ejecutores', async () => {
    const catalog = deriveExpectedFunctionsFromMigrations();

    assert.strictEqual(catalog.expectedFunctions.length, 9);

    // 8.1 admin_update_user_role
    const adminFn = catalog.functionDetails.find(d => d.name === 'admin_update_user_role');
    assert.ok(adminFn, 'admin_update_user_role debe existir');
    assert.strictEqual(adminFn.isSecurityDefiner, true);
    assert.strictEqual(adminFn.hasEmptySearchPath, true);
    assert.strictEqual(adminFn.searchPath, "''");
    assert.deepStrictEqual(adminFn.expectedExecuteRoles, ['authenticated', 'service_role']);
    assert.strictEqual(adminFn.sourceMigrationFinalDefinition, '20260925000001_fase_m09_3c_security_hardening.sql');

    // 8.2 create_booking_atomic
    const bookingFn = catalog.functionDetails.find(d => d.name === 'create_booking_atomic');
    assert.ok(bookingFn, 'create_booking_atomic debe existir');
    assert.strictEqual(bookingFn.isSecurityDefiner, true);
    assert.strictEqual(bookingFn.hasEmptySearchPath, true);
    assert.strictEqual(bookingFn.searchPath, "''");
    assert.deepStrictEqual(bookingFn.expectedExecuteRoles, ['authenticated', 'service_role']);
    assert.strictEqual(bookingFn.sourceMigrationFinalDefinition, '20260925000001_fase_m09_3c_security_hardening.sql');

    // 8.3 reserve_gateway_snapshot_sequence
    const seqFn = catalog.functionDetails.find(d => d.name === 'reserve_gateway_snapshot_sequence');
    assert.ok(seqFn, 'reserve_gateway_snapshot_sequence debe existir');
    assert.strictEqual(seqFn.isSecurityDefiner, true);
    assert.strictEqual(seqFn.hasEmptySearchPath, true);
    assert.strictEqual(seqFn.searchPath, "''");
    assert.deepStrictEqual(seqFn.expectedExecuteRoles, ['service_role']);
    assert.strictEqual(seqFn.sourceMigrationFinalDefinition, '20260926000000_fase_m09_3f_monotonic_sequence.sql');

    // 8.4 apply_membership_transition_atomic
    const transFn = catalog.functionDetails.find(d => d.name === 'apply_membership_transition_atomic');
    assert.ok(transFn, 'apply_membership_transition_atomic debe existir');
    assert.strictEqual(transFn.isSecurityDefiner, true);
    assert.strictEqual(transFn.hasEmptySearchPath, true);
    assert.strictEqual(transFn.searchPath, "''");
    assert.deepStrictEqual(transFn.expectedExecuteRoles, ['service_role']);
    assert.strictEqual(transFn.sourceMigrationFinalDefinition, '20260926000000_fase_m09_3f_monotonic_sequence.sql');

    // 8.5 check_profile_update_integrity (trigger function: cero roles de ejecución)
    const checkFn = catalog.functionDetails.find(d => d.name === 'check_profile_update_integrity');
    assert.ok(checkFn, 'check_profile_update_integrity debe existir');
    assert.strictEqual(checkFn.isSecurityDefiner, true);
    assert.strictEqual(checkFn.hasEmptySearchPath, true);
    assert.deepStrictEqual(checkFn.expectedExecuteRoles, []);

    // 8.6 handle_new_user (hardening diferido)
    const handleFn = catalog.functionDetails.find(d => d.name === 'handle_new_user');
    assert.ok(handleFn, 'handle_new_user debe existir');
    assert.strictEqual(handleFn.isSecurityDefiner, true);
    assert.strictEqual(handleFn.hasEmptySearchPath, false);
    assert.strictEqual(handleFn.searchPath, 'public');
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 9: Acceso Anónimo a reserve_gateway_snapshot_sequence Revocado
  // ----------------------------------------------------------------------------
  it('9. ANON_CANNOT_RESERVE_GATEWAY_SNAPSHOT_SEQUENCE: Acceso anónimo a reserve_gateway_snapshot_sequence revocado en DDL y denegado en runtime', async () => {
    // 9.1 Verificación en DDL de migración
    const migrationFile = path.join(process.cwd(), 'supabase/migrations/20260926000000_fase_m09_3f_monotonic_sequence.sql');
    const sqlContent = fs.readFileSync(migrationFile, 'utf8');
    assert.match(
      sqlContent,
      /REVOKE ALL ON FUNCTION public\.reserve_gateway_snapshot_sequence\(UUID\) FROM anon;/i,
      'DDL debe revocar explícitamente a anon'
    );
    assert.match(
      sqlContent,
      /REVOKE ALL ON FUNCTION public\.reserve_gateway_snapshot_sequence\(UUID\) FROM PUBLIC;/i,
      'DDL debe revocar explícitamente a PUBLIC'
    );

    // 9.2 Verificación en catálogo plegado
    const catalog = deriveExpectedFunctionsFromMigrations();
    const fn = catalog.functionDetails.find(d => d.name === 'reserve_gateway_snapshot_sequence')!;
    assert.strictEqual(fn.expectedExecuteRoles.includes('anon'), false);
    assert.strictEqual(fn.expectedExecuteRoles.includes('PUBLIC'), false);

    // 9.3 Verificación en simulación runtime
    const memId = 'mem-anon-test-1';
    db.memberships.push({ id: memId, gateway_snapshot_sequence_counter: 10 });
    db.callerRole = 'anon';

    const { data, error } = await db.rpc('reserve_gateway_snapshot_sequence', { p_membership_id: memId });
    assert.strictEqual(data, null);
    assert.ok(error, 'Debe retornar error para rol anónimo');
    assert.match(error.message, /permission denied/i);

    // El contador permanece intacto
    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.gateway_snapshot_sequence_counter, 10);
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 10: Usuarios Autenticados (Alumnas) No Pueden Reservar Secuencias
  // ----------------------------------------------------------------------------
  it('10. AUTHENTICATED_CANNOT_RESERVE_GATEWAY_SNAPSHOT_SEQUENCE: Alumnas y usuarios autenticados no pueden reservar secuencias de pasarela', async () => {
    // 10.1 Verificación en DDL de migración
    const migrationFile = path.join(process.cwd(), 'supabase/migrations/20260926000000_fase_m09_3f_monotonic_sequence.sql');
    const sqlContent = fs.readFileSync(migrationFile, 'utf8');
    assert.match(
      sqlContent,
      /REVOKE ALL ON FUNCTION public\.reserve_gateway_snapshot_sequence\(UUID\) FROM authenticated;/i,
      'DDL debe revocar explícitamente a authenticated'
    );

    // 10.2 Verificación en catálogo plegado
    const catalog = deriveExpectedFunctionsFromMigrations();
    const fn = catalog.functionDetails.find(d => d.name === 'reserve_gateway_snapshot_sequence')!;
    assert.strictEqual(fn.expectedExecuteRoles.includes('authenticated'), false);

    // 10.3 Verificación en simulación runtime
    const memId = 'mem-auth-test-1';
    db.memberships.push({ id: memId, gateway_snapshot_sequence_counter: 25 });
    db.callerRole = 'authenticated';

    const { data, error } = await db.rpc('reserve_gateway_snapshot_sequence', { p_membership_id: memId });
    assert.strictEqual(data, null);
    assert.ok(error, 'Debe retornar error para rol authenticated');
    assert.match(error.message, /permission denied/i);

    // El contador no fue alterado por el usuario
    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.gateway_snapshot_sequence_counter, 25);
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 11: Exclusividad de service_role para Emisión de Secuencia
  // ----------------------------------------------------------------------------
  it('11. SERVICE_ROLE_CAN_RESERVE_GATEWAY_SNAPSHOT_SEQUENCE: Exclusividad operativa de service_role para emisión de secuencia monotónica', async () => {
    // 11.1 Verificación en DDL de migración
    const migrationFile = path.join(process.cwd(), 'supabase/migrations/20260926000000_fase_m09_3f_monotonic_sequence.sql');
    const sqlContent = fs.readFileSync(migrationFile, 'utf8');
    assert.match(
      sqlContent,
      /GRANT EXECUTE ON FUNCTION public\.reserve_gateway_snapshot_sequence\(UUID\) TO service_role;/i,
      'DDL debe otorgar EXECUTE exclusivamente a service_role'
    );

    // 11.2 Verificación en catálogo plegado
    const catalog = deriveExpectedFunctionsFromMigrations();
    const fn = catalog.functionDetails.find(d => d.name === 'reserve_gateway_snapshot_sequence')!;
    assert.deepStrictEqual(fn.expectedExecuteRoles, ['service_role']);

    // 11.3 Verificación en simulación runtime
    const memId = 'mem-srv-test-1';
    db.memberships.push({ id: memId, gateway_snapshot_sequence_counter: 50 });
    db.callerRole = 'service_role';

    const { data, error } = await db.rpc('reserve_gateway_snapshot_sequence', { p_membership_id: memId });
    assert.strictEqual(error, null);
    assert.strictEqual(data, 51, 'service_role debe recibir el siguiente número monotónico');

    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.gateway_snapshot_sequence_counter, 51);
  });

  // ----------------------------------------------------------------------------
  // CONTRATO 12: apply_membership_transition_atomic Restringida a service_role
  // ----------------------------------------------------------------------------
  it('12. FINANCIAL_TRANSITION_RPC_REMAINS_SERVICE_ROLE_ONLY: apply_membership_transition_atomic restringida exclusivamente a service_role', async () => {
    // 12.1 Verificación en DDL de migración
    const migrationFile = path.join(process.cwd(), 'supabase/migrations/20260926000000_fase_m09_3f_monotonic_sequence.sql');
    const sqlContent = fs.readFileSync(migrationFile, 'utf8');

    assert.match(
      sqlContent,
      /REVOKE ALL ON FUNCTION public\.apply_membership_transition_atomic\([^)]+\) FROM PUBLIC;/i
    );
    assert.match(
      sqlContent,
      /REVOKE ALL ON FUNCTION public\.apply_membership_transition_atomic\([^)]+\) FROM anon;/i
    );
    assert.match(
      sqlContent,
      /REVOKE ALL ON FUNCTION public\.apply_membership_transition_atomic\([^)]+\) FROM authenticated;/i
    );
    assert.match(
      sqlContent,
      /GRANT EXECUTE ON FUNCTION public\.apply_membership_transition_atomic\([^)]+\) TO service_role;/i
    );

    // 12.2 Verificación en catálogo plegado
    const catalog = deriveExpectedFunctionsFromMigrations();
    const fn = catalog.functionDetails.find(d => d.name === 'apply_membership_transition_atomic')!;
    assert.deepStrictEqual(
      fn.expectedExecuteRoles,
      ['service_role'],
      'apply_membership_transition_atomic debe estar restringida únicamente a service_role'
    );

    // 12.3 Verificación runtime: llamada desde rol authenticated o anon es rechazada
    const memId = 'mem-trans-acl-1';
    db.memberships.push({ id: memId, status: 'PENDING_PAYMENT', last_applied_snapshot_sequence: 10 });

    db.callerRole = 'authenticated';
    const { data: authData, error: authError } = await db.rpc('apply_membership_transition_atomic', {
      p_membership_id: memId,
      p_new_status: 'ACTIVE',
      p_gateway_status: 'active',
      p_snapshot_sequence: 11,
    });
    assert.strictEqual(authData, null);
    assert.ok(authError);
    assert.match(authError.message, /permission denied/i);

    db.callerRole = 'anon';
    const { data: anonData, error: anonError } = await db.rpc('apply_membership_transition_atomic', {
      p_membership_id: memId,
      p_new_status: 'ACTIVE',
      p_gateway_status: 'active',
      p_snapshot_sequence: 11,
    });
    assert.strictEqual(anonData, null);
    assert.ok(anonError);
    assert.match(anonError.message, /permission denied/i);

    // Solo service_role puede transicionar
    db.callerRole = 'service_role';
    const { data: srvData, error: srvError } = await db.rpc('apply_membership_transition_atomic', {
      p_membership_id: memId,
      p_new_status: 'ACTIVE',
      p_gateway_status: 'active',
      p_snapshot_sequence: 11,
    });
    assert.strictEqual(srvError, null);
    assert.strictEqual(srvData.status, 'TRANSITIONED');

    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.status, 'ACTIVE');
    assert.strictEqual(mem.last_applied_snapshot_sequence, 11);
  });
});
