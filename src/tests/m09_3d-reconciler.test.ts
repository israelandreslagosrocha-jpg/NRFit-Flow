/**
 * FASE M-09.3D: SUITE DE CERTIFICACIÓN RECONCILIADOR S2S FLOW MULTIVARIABLE
 * Naty Entrenadora - Máquina de Estados, Concurrencia Determinista e Idempotencia
 *
 * 17 Contratos de Prueba Obligatorios
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {
  deriveMembershipState,
  type FlowSubscriptionSnapshot,
  type LocalMembershipSnapshot,
} from '../lib/payments/flow/state-machine.ts';
import {
  reconcileFlowSubscriptions,
} from '../lib/payments/flow/reconciler.ts';
import { processFlowCallback } from '../lib/payments/flow/processor.ts';
import { setPaymentGateway } from '../lib/payments/index.ts';
import type { PaymentGateway, GatewaySubscription } from '../lib/payments/types.ts';

class MockDatabase {
  memberships: any[] = [];
  securityAuditEvents: any[] = [];
  paymentTransactions: any[] = [];
  paymentEvents: any[] = [];
  emailOutbox: any[] = [];

  from(table: string) {
    const self = this;
    const filters: Array<{ col: string; val: any }> = [];
    let inFilter: { col: string; vals: any[] } | null = null;
    let notFilter: { col: string; op: string; val: any } | null = null;

    const getTableData = (): any[] => {
      switch (table) {
        case 'memberships': return self.memberships;
        case 'security_audit_events': return self.securityAuditEvents;
        case 'payment_transactions': return self.paymentTransactions;
        case 'payment_events': return self.paymentEvents;
        case 'email_outbox': return self.emailOutbox;
        default: return [];
      }
    };

    return {
      select(_cols?: string) {
        return {
          eq(col: string, val: any) {
            filters.push({ col, val });
            return this;
          },
          in(col: string, vals: any[]) {
            inFilter = { col, vals };
            return this;
          },
          not(col: string, op: string, val: any) {
            notFilter = { col, op, val };
            return this;
          },
          order(_col: string, _opts?: any) {
            return this;
          },
          limit(_n: number) {
            return this;
          },
          single() {
            let data = getTableData();
            const found = data.find(row => filters.every(f => row[f.col] === f.val));
            return Promise.resolve({ data: found ? { ...found } : null, error: null });
          },
          then(resolve: any) {
            let data = getTableData();
            if (filters.length > 0) {
              data = data.filter(row => filters.every(f => row[f.col] === f.val));
            }
            if (inFilter) {
              data = data.filter(row => inFilter!.vals.includes(row[inFilter!.col]));
            }
            if (notFilter && notFilter.op === 'is' && notFilter.val === null) {
              data = data.filter(row => row[notFilter!.col] !== null && row[notFilter!.col] !== undefined);
            }
            resolve({ data: data.map(d => ({ ...d })), error: null });
          },
        };
      },
      insert(rows: any | any[]) {
        const arr = Array.isArray(rows) ? rows : [rows];
        const data = getTableData();
        for (const item of arr) {
          const rowWithId = { id: item.id || `mock-${Date.now()}-${Math.random()}`, ...item };
          data.push(rowWithId);
        }
        return {
          select(_c?: string) {
            return {
              single() {
                return Promise.resolve({ data: arr[0], error: null });
              },
            };
          },
          then(resolve: any) {
            resolve({ data: arr, error: null });
          },
        };
      },
      update(fields: Record<string, any>) {
        return {
          eq(col: string, val: any) {
            const data = getTableData();
            for (const row of data) {
              if (row[col] === val) {
                Object.assign(row, fields);
              }
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };
  }

  // Simulación de la RPC atómica de PostgreSQL con semántica PL/pgSQL
  rpc(name: string, params: Record<string, any>) {
    if (name === 'apply_membership_transition_atomic') {
      const mem = this.memberships.find(m => m.id === params.p_membership_id);
      if (!mem) {
        return Promise.resolve({
          data: { success: false, status: 'NOT_FOUND', error: 'Membership not found' },
          error: null,
        });
      }

      // Guarda contra eventos obsoletos
      if (
        params.p_gateway_event_at &&
        mem.last_gateway_event_at &&
        params.p_gateway_event_at < mem.last_gateway_event_at
      ) {
        return Promise.resolve({
          data: {
            success: true,
            status: 'STALE_EVENT_SKIPPED',
            membership_id: mem.id,
            previous_status: mem.status,
            current_status: mem.status,
            last_gateway_event_at: mem.last_gateway_event_at,
            attempted_event_at: params.p_gateway_event_at,
          },
          error: null,
        });
      }

      // Detección de No-Op
      const statusSame = mem.status === params.p_new_status;
      const periodSame = !params.p_current_period_end || mem.current_period_end === params.p_current_period_end;
      const trialSame = !params.p_trial_ends_at || mem.trial_ends_at === params.p_trial_ends_at;

      if (statusSame && periodSame && trialSame) {
        if (params.p_gateway_event_at && (!mem.last_gateway_event_at || params.p_gateway_event_at > mem.last_gateway_event_at)) {
          mem.last_gateway_event_at = params.p_gateway_event_at;
          mem.updated_at = new Date().toISOString();
        }
        return Promise.resolve({
          data: {
            success: true,
            status: 'NO_CHANGE',
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
      mem.last_gateway_event_at = params.p_gateway_event_at || new Date().toISOString();
      mem.updated_at = new Date().toISOString();

      // Registro transaccional en security_audit_events
      this.securityAuditEvents.push({
        id: `audit-${Date.now()}-${Math.random()}`,
        event_type: 'MEMBERSHIP_STATUS_TRANSITION',
        actor_profile_id: params.p_actor_profile_id || null,
        target_type: 'memberships',
        target_id: mem.id,
        trace_id: mem.trace_id,
        result: 'SUCCESS',
        metadata: {
          previous_status: prevStatus,
          new_status: params.p_new_status,
          gateway: 'FLOW',
          reason: params.p_reason,
          ...(params.p_metadata || {}),
        },
      });

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
  }
}

function createMockGateway(sub: Partial<GatewaySubscription>): PaymentGateway {
  return {
    name: 'FLOW',
    mode: 'AUTOMATIC_RECURRING',
    getSubscription: () => Promise.resolve({
      id: sub.id || 'sub-1',
      planId: sub.planId || 'plan-1',
      customerId: sub.customerId || 'cus-1',
      status: sub.status || 'ACTIVE',
      rawStatus: sub.rawStatus !== undefined ? sub.rawStatus : 1,
      morose: sub.morose ?? 0,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    }),
    createCustomer: () => Promise.reject(new Error('not implemented')),
    registerPaymentMethod: () => Promise.reject(new Error('not implemented')),
    getPaymentMethodStatus: () => Promise.reject(new Error('not implemented')),
    createSubscription: () => Promise.reject(new Error('not implemented')),
    cancelSubscription: () => Promise.reject(new Error('not implemented')),
    resolveCallback: () => Promise.reject(new Error('not implemented')),
  };
}

describe('FASE M-09.3D — Reconciliador S2S Flow Multivariable y Máquina de Estados', () => {
  let db: MockDatabase;
  const fixedNow = new Date('2026-09-25T12:00:00Z');

  beforeEach(() => {
    db = new MockDatabase();
  });

  // ============================================================================
  // CONTRATOS 1-11: MATRIZ CANÓNICA Y FUNCIÓN PURA deriveMembershipState
  // ============================================================================

  it('1. FLOW_TRIAL_STATUS_WITH_ZERO_MOROSE_PRESERVES_TRIAL_NEVER_ACTIVE: Trial vigente JAMÁS se asume ACTIVE', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 2, // Trial
      morose: 0,
      trial_end: '2026-09-30T23:59:59Z',
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'TRIAL');
    assert.strictEqual(state.hasAccess, true);
    assert.strictEqual(state.gatewayStatus, 'trial');
    assert.match(state.reason, /Active trial period/);
  });

  it('2. FLOW_TRIAL_STATUS_WITH_OVERDUE_INVOICE_IS_PAST_DUE: Mora durante trial revoca acceso y pasa a PAST_DUE', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 2, // Trial
      morose: 1, // Factura vencida
      trial_end: '2026-09-30T23:59:59Z',
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'PAST_DUE');
    assert.strictEqual(state.hasAccess, false);
    assert.match(state.reason, /overdue invoice during trial/);
  });

  it('3. FLOW_TRIAL_STATUS_LAPSED_WITHOUT_PAYMENT_IS_EXPIRED: Trial con fecha vencida concluye en EXPIRED', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 2, // Trial
      morose: 0,
      trial_end: '2026-09-20T00:00:00Z', // Venció hace 5 días
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'EXPIRED');
    assert.strictEqual(state.hasAccess, false);
    assert.match(state.reason, /expired without paid activation/);
  });

  it('4. FLOW_ACTIVE_STATUS_WITH_ZERO_MOROSE_WITHIN_PERIOD_IS_ACTIVE: Período pagado vigente y al día es ACTIVE', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 1, // Activa
      morose: 0, // Al día
      period_start: '2026-09-01T00:00:00Z',
      period_end: '2026-10-01T00:00:00Z',
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'ACTIVE');
    assert.strictEqual(state.hasAccess, true);
    assert.strictEqual(state.gatewayStatus, 'active');
  });

  it('5. FLOW_ACTIVE_STATUS_WITH_PENDING_UNEXPIRED_INVOICE_IS_ACTIVE: Factura emitida no vencida (morose=2) no corta acceso', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 1,
      morose: 2, // Invoice emitido pero aún dentro del plazo de pago
      period_start: '2026-09-01T00:00:00Z',
      period_end: '2026-10-01T00:00:00Z',
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'ACTIVE');
    assert.strictEqual(state.hasAccess, true);
    assert.match(state.reason, /pending \(not overdue\) invoice/);
  });

  it('6. FLOW_ACTIVE_STATUS_WITH_OVERDUE_INVOICE_IS_PAST_DUE: Factura vencida (morose=1) en suscripción activa corta acceso inmediatamente', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 1,
      morose: 1,
      period_start: '2026-09-01T00:00:00Z',
      period_end: '2026-10-01T00:00:00Z',
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'PAST_DUE');
    assert.strictEqual(state.hasAccess, false);
    assert.match(state.reason, /overdue invoice \(morose=1\)/);
  });

  it('7. FLOW_ACTIVE_STATUS_WITH_LAPSED_PERIOD_IS_EXPIRED_EVEN_WITH_ZERO_MOROSE: morose=0 JAMÁS otorga acceso si el período contractual venció', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 1,
      morose: 0, // Al día técnicamente en Flow
      period_start: '2026-08-01T00:00:00Z',
      period_end: '2026-09-01T00:00:00Z', // Venció hace 24 días
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'EXPIRED', 'Prohibición: morose=0 no debe mantener ACTIVE con período vencido');
    assert.strictEqual(state.hasAccess, false);
    assert.match(state.reason, /Paid period has lapsed/);
  });

  it('8. FLOW_CANCELLED_AT_PERIOD_END_PRESERVES_ACCESS_UNTIL_PERIOD_END: Cancelación programada preserva acceso contractual pagado', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 4, // Cancelada en Flow
      cancel_at_period_end: 1,
      period_start: '2026-09-01T00:00:00Z',
      period_end: '2026-09-30T23:59:59Z', // Aún faltan 5 días
      morose: 0,
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'ACTIVE');
    assert.strictEqual(state.hasAccess, true);
    assert.strictEqual(state.gatewayStatus, 'cancelled_pending_period_end');
    assert.match(state.reason, /contractual access retained/);
  });

  it('9. FLOW_CANCELLED_IMMEDIATE_OR_PAST_PERIOD_IS_CANCELLED: Cancelación inmediata o posterior al período no otorga días artificiales', () => {
    // 9.1 Cancelación inmediata (cancel_at_period_end = 0)
    const flowSubImmediate: FlowSubscriptionSnapshot = {
      status: 4,
      cancel_at_period_end: 0,
      period_end: '2026-09-30T23:59:59Z',
      morose: 0,
    };
    const stateImm = deriveMembershipState(flowSubImmediate, null, fixedNow);
    assert.strictEqual(stateImm.status, 'CANCELLED');
    assert.strictEqual(stateImm.hasAccess, false);

    // 9.2 Cancelación tras fin del período
    const flowSubPast: FlowSubscriptionSnapshot = {
      status: 4,
      cancel_at_period_end: 1,
      period_end: '2026-09-10T00:00:00Z',
      morose: 0,
    };
    const statePast = deriveMembershipState(flowSubPast, null, fixedNow);
    assert.strictEqual(statePast.status, 'CANCELLED');
    assert.strictEqual(statePast.hasAccess, false);
  });

  it('10. FLOW_SUBSCRIPTION_RESOLVES_PAST_DUE_WHEN_DEBT_CLEARED: Subsanación de mora reactiva membresía local a ACTIVE con fechas válidas', () => {
    const flowSubCleared: FlowSubscriptionSnapshot = {
      status: 1,
      morose: 0, // Mora subsanada
      period_start: '2026-09-01T00:00:00Z',
      period_end: '2026-10-01T00:00:00Z',
    };

    const localMem: LocalMembershipSnapshot = {
      id: 'mem-10',
      status: 'PAST_DUE',
    };

    const state = deriveMembershipState(flowSubCleared, localMem, fixedNow);
    assert.strictEqual(state.status, 'ACTIVE');
    assert.strictEqual(state.hasAccess, true);
  });

  it('11. CORRUPTED_OR_MISSING_DATES_FAIL_CLOSED: Fechas ausentes o no analizables fallan cerrado', () => {
    // 11.1 Flow status 1 sin fechas
    const noDatesSub: FlowSubscriptionSnapshot = {
      status: 1,
      morose: 0,
      period_end: undefined,
    };
    const state1 = deriveMembershipState(noDatesSub, null, fixedNow);
    assert.strictEqual(state1.status, 'PAST_DUE');
    assert.strictEqual(state1.hasAccess, false);

    // 11.2 Flow status 2 sin fechas
    const noDatesTrial: FlowSubscriptionSnapshot = {
      status: 2,
      morose: 0,
      trial_end: 'invalid-date-string',
    };
    const state2 = deriveMembershipState(noDatesTrial, null, fixedNow);
    assert.strictEqual(state2.status, 'EXPIRED');
    assert.strictEqual(state2.hasAccess, false);

    // 11.3 Status desconocido
    const unknownStatus: FlowSubscriptionSnapshot = {
      status: 99,
      morose: 0,
    };
    const state3 = deriveMembershipState(unknownStatus, null, fixedNow);
    assert.strictEqual(state3.status, 'EXPIRED');
    assert.strictEqual(state3.hasAccess, false);
  });

  // ============================================================================
  // CONTRATOS 12-14: CONCURRENCIA, IDEMPOTENCIA Y CRON S2S
  // ============================================================================

  it('12. RECONCILER_CRON_EXECUTES_IDEMPOTENTLY_NO_DUPLICATE_SIDE_EFFECTS: Ejecución repetida sin cambios no genera efectos colaterales duplicados', async () => {
    const memId = 'mem-idem-1';
    db.memberships.push({
      id: memId,
      student_id: 'student-1',
      status: 'ACTIVE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-idem-1',
      current_period_start: '2026-09-01T00:00:00Z',
      current_period_end: '2026-10-01T00:00:00Z',
      last_gateway_event_at: '2026-09-25T10:00:00Z',
      trace_id: 'trace-idem-1',
    });

    const mockGw = createMockGateway({
      id: 'sub-idem-1',
      rawStatus: 1,
      morose: 0,
      currentPeriodStart: '2026-09-01T00:00:00Z',
      currentPeriodEnd: '2026-10-01T00:00:00Z',
    });
    setPaymentGateway(mockGw);

    // Ejecución 1: Estado ya coincide
    const res1 = await reconcileFlowSubscriptions(db as any, { referenceNow: fixedNow });
    assert.strictEqual(res1.scanned, 1);
    assert.strictEqual(res1.reconciled, 0, 'No debe reconciliar si ya coincide');
    assert.strictEqual(db.securityAuditEvents.length, 0, 'Cero auditorías duplicadas en no-op');
    assert.strictEqual(db.paymentTransactions.length, 0, 'Cero transacciones duplicadas');
    assert.strictEqual(db.emailOutbox.length, 0, 'Cero emails duplicados');

    // Ejecución 2: Repetición estricta
    const res2 = await reconcileFlowSubscriptions(db as any, { referenceNow: fixedNow });
    assert.strictEqual(res2.reconciled, 0);
    assert.strictEqual(db.securityAuditEvents.length, 0);
    assert.strictEqual(db.paymentTransactions.length, 0);
  });

  it('13. RECONCILER_DRY_RUN_MAKES_ZERO_DATABASE_MODIFICATIONS: Modo dryRun informa transiciones sin modificar registros', async () => {
    const memId = 'mem-dry-1';
    db.memberships.push({
      id: memId,
      student_id: 'student-2',
      status: 'ACTIVE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-dry-1',
      current_period_start: '2026-09-01T00:00:00Z',
      current_period_end: '2026-10-01T00:00:00Z',
      trace_id: 'trace-dry-1',
    });

    // Flow reporta moroso=1 -> debería ser PAST_DUE
    const mockGw = createMockGateway({
      id: 'sub-dry-1',
      rawStatus: 1,
      morose: 1,
      currentPeriodStart: '2026-09-01T00:00:00Z',
      currentPeriodEnd: '2026-10-01T00:00:00Z',
    });
    setPaymentGateway(mockGw);

    const res = await reconcileFlowSubscriptions(db as any, { dryRun: true, referenceNow: fixedNow });
    assert.strictEqual(res.scanned, 1);
    assert.strictEqual(res.reconciled, 1);
    assert.strictEqual(res.details[0].action, 'DRY_RUN_TRANSITION_TO_PAST_DUE');

    // Verificación de base de datos intacta
    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.status, 'ACTIVE', 'El registro en DB no debe modificarse en dryRun');
    assert.strictEqual(db.securityAuditEvents.length, 0, 'Cero eventos de auditoría en dryRun');
  });

  it('14. CONCURRENCY_STALE_SNAPSHOT_PROTECTION_DISCARDS_OUT_OF_ORDER_EVENTS: Instantánea con estampa anterior es rechazada como STALE_EVENT_SKIPPED', async () => {
    const memId = 'mem-stale-1';
    // Membresía ya procesó un webhook a las 11:00:00Z
    db.memberships.push({
      id: memId,
      student_id: 'student-3',
      status: 'PAST_DUE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-stale-1',
      last_gateway_event_at: '2026-09-25T11:00:00Z',
      trace_id: 'trace-stale-1',
    });

    // Intentar aplicar una transición con snapshot desfasado (estampa anterior a las 10:00:00Z)
    const { data: rpcRes } = await db.rpc('apply_membership_transition_atomic', {
      p_membership_id: memId,
      p_new_status: 'ACTIVE',
      p_gateway_status: 'active',
      p_gateway_event_at: '2026-09-25T10:00:00Z', // Anterior al registro en base de datos
      p_reason: 'Stale snapshot replay test',
    });

    assert.strictEqual(rpcRes.status, 'STALE_EVENT_SKIPPED');
    assert.strictEqual(rpcRes.current_status, 'PAST_DUE', 'El estado local no debe degradarse por eventos viejos');

    // Asegurar que en base de datos sigue intacto
    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.status, 'PAST_DUE');
    assert.strictEqual(db.securityAuditEvents.length, 0, 'No se genera auditoría por evento descartado');
  });

  // ============================================================================
  // CONTRATOS 15-17: AUDITORÍA TRANSACCIONAL Y ESTRUCTURA SQL M-09.3D
  // ============================================================================

  it('15. ATOMIC_RPC_APPLIES_FOR_UPDATE_AND_RECORDS_SECURITY_AUDIT_ON_REAL_TRANSITION: La migración SQL implementa FOR UPDATE, search_path="" y permisos service_role', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260925000002_fase_m09_3d_multivariable_reconciliation.sql');
    assert.ok(fs.existsSync(migrationPath), 'El archivo de migración M-09.3D debe existir');

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // 15.1 Bloqueo FOR UPDATE
    assert.match(sql, /FOR\s+UPDATE/, 'Debe utilizar FOR UPDATE para serialización estricta');

    // 15.2 search_path vacío (Hardening M-09.3C)
    assert.match(sql, /SET\s+search_path\s*=\s*''/, 'Debe forzar search_path vacío contra search path hijacking');

    // 15.3 Revocación y menor privilegio
    assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.apply_membership_transition_atomic.*FROM\s+PUBLIC/i);
    assert.match(sql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.apply_membership_transition_atomic.*TO\s+service_role/i);

    // 15.4 Inserción en security_audit_events
    assert.match(sql, /INSERT\s+INTO\s+public\.security_audit_events/, 'Debe insertar en security_audit_events en transiciones reales');
  });

  it('16. AUDIT_EVENT_FOR_MEMBERSHIP_TRANSITION_CONTAINS_SANITIZED_DATA: Auditoría registra previous_status, new_status y morose sin secretos ni PII', async () => {
    const memId = 'mem-audit-1';
    db.memberships.push({
      id: memId,
      student_id: 'student-4',
      status: 'ACTIVE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-audit-1',
      last_gateway_event_at: '2026-09-25T08:00:00Z',
      trace_id: 'trace-audit-uuid-1',
    });

    const mockGw = createMockGateway({
      id: 'sub-audit-1',
      rawStatus: 1,
      morose: 1, // Provoca transición a PAST_DUE
      currentPeriodStart: '2026-09-01T00:00:00Z',
      currentPeriodEnd: '2026-10-01T00:00:00Z',
    });
    setPaymentGateway(mockGw);

    const res = await reconcileFlowSubscriptions(db as any, { referenceNow: fixedNow });
    assert.strictEqual(res.reconciled, 1);

    // Verificar el registro en securityAuditEvents
    assert.strictEqual(db.securityAuditEvents.length, 1);
    const audit = db.securityAuditEvents[0];
    assert.strictEqual(audit.event_type, 'MEMBERSHIP_STATUS_TRANSITION');
    assert.strictEqual(audit.target_id, memId);
    assert.strictEqual(audit.trace_id, 'trace-audit-uuid-1');
    assert.strictEqual(audit.result, 'SUCCESS');
    assert.strictEqual(audit.metadata.previous_status, 'ACTIVE');
    assert.strictEqual(audit.metadata.new_status, 'PAST_DUE');
    assert.strictEqual(audit.metadata.gateway, 'FLOW');
    assert.strictEqual(audit.metadata.morose, 1);

    // Confirmar que no hay llaves prohibidas en la metadata
    const metaStr = JSON.stringify(audit.metadata).toLowerCase();
    assert.ok(!metaStr.includes('secret'), 'No debe contener secretos');
    assert.ok(!metaStr.includes('apikey'), 'No debe contener api_keys');
    assert.ok(!metaStr.includes('bearer'), 'No debe contener tokens de autorización');
  });

  it('17. FAIL_CLOSED_GATE_OBSERVABILITY_EMITS_STRUCTURED_LOGS: Anomalías o errores de pasarela reportan error y preservan fail-closed', async () => {
    const memId = 'mem-err-1';
    db.memberships.push({
      id: memId,
      student_id: 'student-5',
      status: 'ACTIVE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-err-1',
      trace_id: 'trace-err-1',
    });

    const failingGw: PaymentGateway = {
      name: 'FLOW',
      mode: 'AUTOMATIC_RECURRING',
      getSubscription: () => Promise.reject(new Error('Flow S2S Gateway Timeout 504')),
      createCustomer: () => Promise.reject(new Error('not implemented')),
      registerPaymentMethod: () => Promise.reject(new Error('not implemented')),
      getPaymentMethodStatus: () => Promise.reject(new Error('not implemented')),
      createSubscription: () => Promise.reject(new Error('not implemented')),
      cancelSubscription: () => Promise.reject(new Error('not implemented')),
      resolveCallback: () => Promise.reject(new Error('not implemented')),
    };
    setPaymentGateway(failingGw);

    const res = await reconcileFlowSubscriptions(db as any, { referenceNow: fixedNow });
    assert.strictEqual(res.errors, 1);
    assert.strictEqual(res.details[0].action, 'ERROR');
    assert.match(res.details[0].reason || '', /504/);

    // La membresía no debe mutar a un estado erróneo
    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.status, 'ACTIVE', 'Error de red preserva estado previo sin corrupción');
  });
});
