/**
 * FASE M-09.3D: SUITE DE CERTIFICACIÓN RECONCILIADOR S2S FLOW MULTIVARIABLE
 * Naty Entrenadora - Máquina de Estados, Concurrencia Determinista e Idempotencia
 *
 * 20 Contratos de Prueba Obligatorios con Correcciones Contractuales
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
  rpcCallLog: Array<{ name: string; params: any }> = [];
  simulateRpcFailure: boolean = false;

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
    this.rpcCallLog.push({ name, params });

    if (this.simulateRpcFailure) {
      return Promise.resolve({
        data: null,
        error: { message: 'Database connection error during atomic RPC' },
      });
    }

    if (name === 'apply_membership_transition_atomic') {
      const mem = this.memberships.find(m => m.id === params.p_membership_id);
      if (!mem) {
        return Promise.resolve({
          data: { success: false, status: 'NOT_FOUND', error: 'Membership not found' },
          error: null,
        });
      }

      // Guarda contra snapshots obsoletos
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
            previous_status: mem.status,
            current_status: mem.status,
            last_gateway_snapshot_observed_at: mem.last_gateway_snapshot_observed_at,
            attempted_snapshot_observed_at: params.p_gateway_snapshot_observed_at,
          },
          error: null,
        });
      }

      // Detección de No-Op
      const statusSame = mem.status === params.p_new_status;
      const periodSame = !params.p_current_period_end || mem.current_period_end === params.p_current_period_end;
      const trialSame = !params.p_trial_ends_at || mem.trial_ends_at === params.p_trial_ends_at;

      if (statusSame && periodSame && trialSame) {
        if (params.p_gateway_snapshot_observed_at && (!mem.last_gateway_snapshot_observed_at || params.p_gateway_snapshot_observed_at > mem.last_gateway_snapshot_observed_at)) {
          mem.last_gateway_snapshot_observed_at = params.p_gateway_snapshot_observed_at;
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
      if (params.p_new_status === 'CANCELLED' && !mem.cancelled_at) {
        mem.cancelled_at = new Date().toISOString();
      }
      mem.last_gateway_snapshot_observed_at = params.p_gateway_snapshot_observed_at || new Date().toISOString();
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
    resolveCallback: () => Promise.resolve({
      resourceType: 'subscription',
      subscription: {
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
      },
    }),
  };
}

describe('FASE M-09.3D — Reconciliador S2S Flow Multivariable y Máquina de Estados (Corregido)', () => {
  let db: MockDatabase;
  const fixedNow = new Date('2026-09-25T12:00:00Z');

  beforeEach(() => {
    db = new MockDatabase();
  });

  // ============================================================================
  // CONTRATOS 1-4: CANCELACIÓN Y TRIAL
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
    assert.strictEqual(state.accessUntil, '2026-09-30T23:59:59Z');
    assert.strictEqual(state.gatewayStatus, 'trial');
    assert.match(state.reason, /Active trial period/);
  });

  it('2. FLOW_TRIAL_STATUS_WITH_OVERDUE_INVOICE_IS_PAST_DUE: Mora durante trial revoca acceso y pasa a PAST_DUE', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 2,
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
      status: 2,
      morose: 0,
      trial_end: '2026-09-20T00:00:00Z', // Venció hace 5 días
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'EXPIRED');
    assert.strictEqual(state.hasAccess, false);
    assert.match(state.reason, /Trial period has expired/);
  });

  it('4. TRIAL_CANCEL_AT_PERIOD_END_REMAINS_TRIAL_UNTIL_TRIAL_END: Cancelación programada en trial permanece en TRIAL sin renovación', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 2, // Trial
      cancel_at_period_end: 1,
      trial_end: '2026-09-30T23:59:59Z',
      morose: 0,
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'TRIAL');
    assert.strictEqual(state.hasAccess, true);
    assert.strictEqual(state.accessUntil, '2026-09-30T23:59:59Z');
    assert.strictEqual(state.reason, 'TRIAL_CANCEL_AT_PERIOD_END_ACCESS_RETAINED');
  });

  // ============================================================================
  // CONTRATOS 5-8: ACTIVIDAD, FACTURAS Y MOROSIDAD
  // ============================================================================

  it('5. FLOW_ACTIVE_STATUS_WITH_ZERO_MOROSE_WITHIN_PERIOD_IS_ACTIVE: Período pagado vigente y al día es ACTIVE', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 1, // Activa
      morose: 0, // Al día
      period_start: '2026-09-01T00:00:00Z',
      period_end: '2026-10-01T00:00:00Z',
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'ACTIVE');
    assert.strictEqual(state.hasAccess, true);
    assert.strictEqual(state.accessUntil, '2026-10-01T00:00:00Z');
    assert.strictEqual(state.gatewayStatus, 'active');
  });

  it('6. FLOW_ACTIVE_STATUS_WITH_PENDING_UNEXPIRED_INVOICE_IS_ACTIVE: Factura emitida no vencida (morose=2) no corta acceso', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 1,
      morose: 2, // Invoice emitido pero no vencido
      period_start: '2026-09-01T00:00:00Z',
      period_end: '2026-10-01T00:00:00Z',
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'ACTIVE');
    assert.strictEqual(state.hasAccess, true);
    assert.match(state.reason, /pending \(not overdue\) invoice/);
  });

  it('7. FLOW_ACTIVE_STATUS_WITH_OVERDUE_INVOICE_IS_PAST_DUE: Factura vencida (morose=1) en activa corta acceso inmediatamente', () => {
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

  it('8. FLOW_ACTIVE_STATUS_WITH_LAPSED_PERIOD_IS_EXPIRED_EVEN_WITH_ZERO_MOROSE: morose=0 JAMÁS otorga acceso si el período contractual venció', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 1,
      morose: 0,
      period_start: '2026-08-01T00:00:00Z',
      period_end: '2026-09-01T00:00:00Z', // Venció hace 24 días
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    assert.strictEqual(state.status, 'EXPIRED', 'Prohibición: morose=0 no debe mantener ACTIVE con período vencido');
    assert.strictEqual(state.hasAccess, false);
    assert.match(state.reason, /Paid period has lapsed/);
  });

  // ============================================================================
  // CONTRATOS 9-11: CANCELACIÓN CONTRACTUAL VS ACCESO TEMPORAL
  // ============================================================================

  it('9. CANCELLED_AT_PERIOD_END_REMAINS_CANCELLED_BUT_RETAINS_PAID_ACCESS: Cancelación programada asigna CANCELLED y preserva acceso hasta period_end', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 4, // Cancelada en Flow
      cancel_at_period_end: 1,
      period_start: '2026-09-01T00:00:00Z',
      period_end: '2026-09-30T23:59:59Z', // Aún faltan 5 días
      morose: 0,
    };

    const state = deriveMembershipState(flowSub, null, fixedNow);
    // REGLA FUNDAMENTAL: Estado contractual es CANCELLED (no resucita a ACTIVE)
    assert.strictEqual(state.status, 'CANCELLED');
    assert.strictEqual(state.hasAccess, true, 'Debe retener acceso hasta period_end');
    assert.strictEqual(state.accessUntil, '2026-09-30T23:59:59Z');
    assert.strictEqual(state.reason, 'CANCELLED_AT_PERIOD_END_ACCESS_RETAINED');
  });

  it('10. CANCELLED_MEMBERSHIP_DOES_NOT_COUNT_AS_ACTIVE_CONTRACT: Estado CANCELLED previene inflar MRR contratado', () => {
    const flowSub: FlowSubscriptionSnapshot = {
      status: 4,
      cancel_at_period_end: 1,
      period_end: '2026-09-30T23:59:59Z',
      morose: 0,
    };

    const state = deriveMembershipState(flowSub, { status: 'ACTIVE' }, fixedNow);
    assert.strictEqual(state.status, 'CANCELLED', 'No debe persistirse como ACTIVE en DB');
    assert.strictEqual(state.hasAccess, true);
  });

  it('11. FLOW_CANCELLED_IMMEDIATE_OR_PAST_PERIOD_IS_CANCELLED: Cancelación inmediata o posterior al período no otorga días artificiales', () => {
    // Inmediata
    const stateImm = deriveMembershipState({
      status: 4,
      cancel_at_period_end: 0,
      period_end: '2026-09-30T23:59:59Z',
      morose: 0,
    }, null, fixedNow);
    assert.strictEqual(stateImm.status, 'CANCELLED');
    assert.strictEqual(stateImm.hasAccess, false);

    // Con período vencido
    const statePast = deriveMembershipState({
      status: 4,
      cancel_at_period_end: 1,
      period_end: '2026-09-10T00:00:00Z',
      morose: 0,
    }, null, fixedNow);
    assert.strictEqual(statePast.status, 'CANCELLED');
    assert.strictEqual(statePast.hasAccess, false);
  });

  // ============================================================================
  // CONTRATOS 12-13: RECUPERACIÓN ESTRICTA Y DATOS CORRUPTOS
  // ============================================================================

  it('12. PAST_DUE_RECOVERY_REEVALUATES_FULL_CANONICAL_MATRIX: Subsanación desde PAST_DUE evalúa la matriz íntegra sin atajos arbitrarios', () => {
    const localPastDue: LocalMembershipSnapshot = { id: 'mem-pd', status: 'PAST_DUE' };

    // 12.1 Recupera a ACTIVE si Flow está en 1 con período vigente
    const resActive = deriveMembershipState({
      status: 1,
      morose: 0,
      period_start: '2026-09-01T00:00:00Z',
      period_end: '2026-10-01T00:00:00Z',
    }, localPastDue, fixedNow);
    assert.strictEqual(resActive.status, 'ACTIVE');
    assert.strictEqual(resActive.hasAccess, true);

    // 12.2 Recupera a TRIAL (JAMÁS ACTIVE) si Flow está en trial con trial vigente
    const resTrial = deriveMembershipState({
      status: 2,
      morose: 0,
      trial_end: '2026-09-30T23:59:59Z',
    }, localPastDue, fixedNow);
    assert.strictEqual(resTrial.status, 'TRIAL', 'Subsanación en trial regresa a TRIAL, nunca ACTIVE');
    assert.strictEqual(resTrial.hasAccess, true);

    // 12.3 Transiciona a CANCELLED si Flow está cancelada (con acceso si cancel_at_period_end=1)
    const resCancelled = deriveMembershipState({
      status: 4,
      morose: 0,
      cancel_at_period_end: 1,
      period_end: '2026-09-30T23:59:59Z',
    }, localPastDue, fixedNow);
    assert.strictEqual(resCancelled.status, 'CANCELLED');
    assert.strictEqual(resCancelled.hasAccess, true);

    // 12.4 Transiciona a EXPIRED si Flow está inactiva (status 0)
    const resExpired = deriveMembershipState({
      status: 0,
      morose: 0,
    }, localPastDue, fixedNow);
    assert.strictEqual(resExpired.status, 'EXPIRED');
    assert.strictEqual(resExpired.hasAccess, false);
  });

  it('13. UNKNOWN_FLOW_STATUS_FAILS_CLOSED_WITHOUT_DESTRUCTIVE_STATE_MUTATION: Estados Flow desconocidos o corruptos bloquean acceso sin mutar DB erróneamente', () => {
    const localKnown: LocalMembershipSnapshot = { id: 'mem-known', status: 'ACTIVE' };

    // 13.1 Flow status 99 no soportado
    const unknownState = deriveMembershipState({ status: 99, morose: 0 }, localKnown, fixedNow);
    assert.strictEqual(unknownState.hasAccess, false, 'Debe fallar cerrado');
    assert.strictEqual(unknownState.applyStateMutation, false, 'No debe aplicar mutación destructiva en DB');
    assert.strictEqual(unknownState.status, 'ACTIVE', 'Debe preservar el estado conocido');
    assert.strictEqual(unknownState.reason, 'UNSUPPORTED_OR_INVALID_GATEWAY_STATE');

    // 13.2 Fechas esenciales ausentes en suscripción activa
    const corruptDates = deriveMembershipState({ status: 1, morose: 0, period_end: null }, localKnown, fixedNow);
    assert.strictEqual(corruptDates.hasAccess, false);
    assert.strictEqual(corruptDates.applyStateMutation, false);
    assert.strictEqual(corruptDates.reason, 'UNSUPPORTED_OR_INVALID_GATEWAY_STATE');
  });

  // ============================================================================
  // CONTRATOS 14-16: EMBUDO ATÓMICO EXCLUSIVO Y CONCURRENCIA
  // ============================================================================

  it('14. CALLBACK_AND_RECONCILER_USE_SAME_ATOMIC_TRANSITION_PATH: Callback y reconciliador convergen en apply_membership_transition_atomic', async () => {
    const memId = 'mem-funnel-1';
    db.memberships.push({
      id: memId,
      student_id: 'student-funnel',
      status: 'PENDING_PAYMENT',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-funnel-1',
      trace_id: 'trace-funnel-1',
    });

    const mockGw = createMockGateway({
      id: 'sub-funnel-1',
      rawStatus: 1,
      morose: 0,
      currentPeriodStart: '2026-09-01T00:00:00Z',
      currentPeriodEnd: '2026-10-01T00:00:00Z',
    });
    setPaymentGateway(mockGw);

    // 14.1 Ejecutar reconciliador
    await reconcileFlowSubscriptions(db as any, { referenceNow: fixedNow });
    assert.strictEqual(db.rpcCallLog.length, 1);
    assert.strictEqual(db.rpcCallLog[0].name, 'apply_membership_transition_atomic');

    // 14.2 Ejecutar callback de suscripción
    await processFlowCallback({
      supabase: db as any,
      token: 'tok-funnel',
      resourceHint: 'subscription',
    });
    assert.strictEqual(db.rpcCallLog.length, 2);
    assert.strictEqual(db.rpcCallLog[1].name, 'apply_membership_transition_atomic');
  });

  it('15. RPC_FAILURE_DOES_NOT_FALLBACK_TO_DIRECT_MEMBERSHIP_MUTATION: Caída de la RPC deja membresía intacta sin fallback mutante', async () => {
    const memId = 'mem-fail-rpc';
    db.memberships.push({
      id: memId,
      student_id: 'student-fail',
      status: 'ACTIVE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-fail-1',
      last_gateway_snapshot_observed_at: '2026-09-25T10:00:00Z',
      trace_id: 'trace-fail-1',
    });

    // Gateway reporta morose=1 (debería transicionar a PAST_DUE)
    const mockGw = createMockGateway({
      id: 'sub-fail-1',
      rawStatus: 1,
      morose: 1,
    });
    setPaymentGateway(mockGw);

    // Simular fallo en la RPC atómica
    db.simulateRpcFailure = true;

    const res = await reconcileFlowSubscriptions(db as any, { referenceNow: fixedNow });
    assert.strictEqual(res.errors, 1);
    assert.strictEqual(res.details[0].action, 'APPLY_FAILED');

    // REGLA CRÍTICA: Base de datos intacta (cero bypass manual)
    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.status, 'ACTIVE', 'La membresía no debe mutar si la RPC falla');
    assert.strictEqual(db.securityAuditEvents.length, 0, 'No debe registrarse auditoría si la RPC falla');
  });

  it('16. OLDER_OBSERVED_SNAPSHOT_CANNOT_OVERWRITE_NEWER_APPLIED_SNAPSHOT: Snapshot con timestamp observado anterior es descartado', async () => {
    const memId = 'mem-older-snap';
    db.memberships.push({
      id: memId,
      student_id: 'student-snap',
      status: 'PAST_DUE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-snap-1',
      last_gateway_snapshot_observed_at: '2026-09-25T11:00:00Z',
      trace_id: 'trace-snap-1',
    });

    // Intentar aplicar un snapshot observado a las 10:00:00Z (desfasado respecto a las 11:00:00Z)
    const { data: rpcRes } = await db.rpc('apply_membership_transition_atomic', {
      p_membership_id: memId,
      p_new_status: 'ACTIVE',
      p_gateway_status: 'active',
      p_gateway_snapshot_observed_at: '2026-09-25T10:00:00Z',
      p_reason: 'Testing older snapshot rejection',
    });

    assert.strictEqual(rpcRes.status, 'STALE_SNAPSHOT_SKIPPED');
    assert.strictEqual(rpcRes.current_status, 'PAST_DUE', 'El estado local no debe degradarse');

    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.status, 'PAST_DUE');
  });

  // ============================================================================
  // CONTRATOS 17-20: IDEMPOTENCIA, DRY RUN, AUDITORÍA Y ESTRUCTURA SQL
  // ============================================================================

  it('17. RECONCILER_CRON_EXECUTES_IDEMPOTENTLY_NO_DUPLICATE_SIDE_EFFECTS: Ejecución repetida sin cambios no genera efectos colaterales', async () => {
    const memId = 'mem-idem-2';
    db.memberships.push({
      id: memId,
      student_id: 'student-idem-2',
      status: 'ACTIVE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-idem-2',
      current_period_start: '2026-09-01T00:00:00Z',
      current_period_end: '2026-10-01T00:00:00Z',
      last_gateway_snapshot_observed_at: '2026-09-25T10:00:00Z',
      trace_id: 'trace-idem-2',
    });

    const mockGw = createMockGateway({
      id: 'sub-idem-2',
      rawStatus: 1,
      morose: 0,
      currentPeriodStart: '2026-09-01T00:00:00Z',
      currentPeriodEnd: '2026-10-01T00:00:00Z',
    });
    setPaymentGateway(mockGw);

    const res1 = await reconcileFlowSubscriptions(db as any, { referenceNow: fixedNow });
    assert.strictEqual(res1.reconciled, 0);
    assert.strictEqual(db.securityAuditEvents.length, 0);

    const res2 = await reconcileFlowSubscriptions(db as any, { referenceNow: fixedNow });
    assert.strictEqual(res2.reconciled, 0);
    assert.strictEqual(db.securityAuditEvents.length, 0);
  });

  it('18. RECONCILER_DRY_RUN_MAKES_ZERO_DATABASE_MODIFICATIONS: dryRun informa acciones sin mutar registros', async () => {
    const memId = 'mem-dry-2';
    db.memberships.push({
      id: memId,
      student_id: 'student-dry-2',
      status: 'ACTIVE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-dry-2',
      current_period_start: '2026-09-01T00:00:00Z',
      current_period_end: '2026-10-01T00:00:00Z',
      trace_id: 'trace-dry-2',
    });

    const mockGw = createMockGateway({
      id: 'sub-dry-2',
      rawStatus: 1,
      morose: 1,
      currentPeriodStart: '2026-09-01T00:00:00Z',
      currentPeriodEnd: '2026-10-01T00:00:00Z',
    });
    setPaymentGateway(mockGw);

    const res = await reconcileFlowSubscriptions(db as any, { dryRun: true, referenceNow: fixedNow });
    assert.strictEqual(res.reconciled, 1);
    assert.strictEqual(res.details[0].action, 'DRY_RUN_TRANSITION_TO_PAST_DUE');

    const mem = db.memberships.find(m => m.id === memId);
    assert.strictEqual(mem.status, 'ACTIVE');
    assert.strictEqual(db.securityAuditEvents.length, 0);
  });

  it('19. ATOMIC_RPC_APPLIES_FOR_UPDATE_AND_RECORDS_SECURITY_AUDIT_ON_REAL_TRANSITION: Migración SQL implementa FOR UPDATE, search_path="" y last_gateway_snapshot_observed_at', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260925000002_fase_m09_3d_multivariable_reconciliation.sql');
    assert.ok(fs.existsSync(migrationPath), 'El archivo de migración M-09.3D debe existir');

    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /last_gateway_snapshot_observed_at\s+TIMESTAMPTZ/, 'Debe utilizar el nombre preciso last_gateway_snapshot_observed_at');
    assert.match(sql, /FOR\s+UPDATE/, 'Debe utilizar FOR UPDATE para serialización estricta');
    assert.match(sql, /SET\s+search_path\s*=\s*''/, 'Debe forzar search_path vacío contra hijacking');
    assert.match(sql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.apply_membership_transition_atomic.*TO\s+service_role/i);
    assert.match(sql, /INSERT\s+INTO\s+public\.security_audit_events/, 'Debe insertar en security_audit_events en transiciones reales');
  });

  it('20. AUDIT_EVENT_FOR_MEMBERSHIP_TRANSITION_CONTAINS_SANITIZED_DATA: Auditoría registra previous_status, new_status y morose sin secretos ni PII', async () => {
    const memId = 'mem-audit-2';
    db.memberships.push({
      id: memId,
      student_id: 'student-audit-2',
      status: 'ACTIVE',
      gateway: 'FLOW',
      gateway_subscription_id: 'sub-audit-2',
      last_gateway_snapshot_observed_at: '2026-09-25T08:00:00Z',
      trace_id: 'trace-audit-uuid-2',
    });

    const mockGw = createMockGateway({
      id: 'sub-audit-2',
      rawStatus: 1,
      morose: 1,
      currentPeriodStart: '2026-09-01T00:00:00Z',
      currentPeriodEnd: '2026-10-01T00:00:00Z',
    });
    setPaymentGateway(mockGw);

    const res = await reconcileFlowSubscriptions(db as any, { referenceNow: fixedNow });
    assert.strictEqual(res.reconciled, 1);
    assert.strictEqual(db.securityAuditEvents.length, 1);

    const audit = db.securityAuditEvents[0];
    assert.strictEqual(audit.event_type, 'MEMBERSHIP_STATUS_TRANSITION');
    assert.strictEqual(audit.target_id, memId);
    assert.strictEqual(audit.trace_id, 'trace-audit-uuid-2');
    assert.strictEqual(audit.result, 'SUCCESS');
    assert.strictEqual(audit.metadata.previous_status, 'ACTIVE');
    assert.strictEqual(audit.metadata.new_status, 'PAST_DUE');
    assert.strictEqual(audit.metadata.gateway, 'FLOW');
    assert.strictEqual(audit.metadata.morose, 1);

    const metaStr = JSON.stringify(audit.metadata).toLowerCase();
    assert.ok(!metaStr.includes('secret'));
    assert.ok(!metaStr.includes('apikey'));
    assert.ok(!metaStr.includes('bearer'));
  });
});
