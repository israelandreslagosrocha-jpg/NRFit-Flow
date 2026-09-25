/**
 * FASE M-09.3D: MÁQUINA DE ESTADOS Y NORMALIZACIÓN MULTIVARIABLE FLOW S2S
 * Naty Entrenadora - Motor Determinista de Membresías y Concurrencia
 *
 * Mapeo estricto contra PostgreSQL enum_membership_status:
 * 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'PAUSED' | 'PENDING_PAYMENT'
 */

export type CanonicalMembershipStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PAUSED'
  | 'PENDING_PAYMENT';

export interface FlowSubscriptionSnapshot {
  id?: string;
  status: number; // 0=inactiva, 1=activa, 2=trial, 4=cancelada
  morose: number; // 0=al día, 1=vencido, 2=pendiente no vencido
  trial_end?: string | null;
  trialEndsAt?: string | null;
  period_start?: string | null;
  currentPeriodStart?: string | null;
  period_end?: string | null;
  currentPeriodEnd?: string | null;
  cancel_at_period_end?: number | boolean;
  cancelAtPeriodEnd?: boolean;
  subscription_end?: string | null;
}

export interface LocalMembershipSnapshot {
  id: string;
  status: CanonicalMembershipStatus | string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  current_period_start?: string | null;
  last_gateway_snapshot_observed_at?: string | null;
  trace_id?: string | null;
}

export interface DerivedMembershipState {
  status: CanonicalMembershipStatus;
  gatewayStatus: string;
  hasAccess: boolean;
  accessUntil?: string | null;
  applyStateMutation: boolean;
  reason: string;
  effectivePeriodStart?: string | null;
  effectivePeriodEnd?: string | null;
  effectiveTrialEnd?: string | null;
}

/**
 * Función pura de derivación de estado multivariable.
 *
 * Principios rectores:
 * 1. Estado contractual != Derecho de acceso temporal.
 *    Cancelación programada asigna estado CANCELLED con hasAccess=true hasta period_end.
 *    Jamás resucita ACTIVE para mantener acceso.
 * 2. Cero atajos desde PAST_DUE: La subsanación evalúa la matriz canónica completa.
 * 3. Falla cerrada no destructiva ante datos corruptos o estados desconocidos:
 *    hasAccess=false, applyStateMutation=false, preservando el estado previo en DB.
 */
export function deriveMembershipState(
  flowSub: FlowSubscriptionSnapshot,
  localMem?: Partial<LocalMembershipSnapshot> | null,
  referenceNow: Date | string = new Date()
): DerivedMembershipState {
  const nowMs = typeof referenceNow === 'string' ? Date.parse(referenceNow) : referenceNow.getTime();

  // Resolución de fechas efectivas con prioridad: Pasarela > Local
  const rawPeriodStart = flowSub.period_start || flowSub.currentPeriodStart || localMem?.current_period_start || null;
  const rawPeriodEnd = flowSub.period_end || flowSub.currentPeriodEnd || localMem?.current_period_end || null;
  const rawTrialEnd = flowSub.trial_end || flowSub.trialEndsAt || localMem?.trial_ends_at || null;

  const parseDateMs = (d: string | null | undefined): number | null => {
    if (!d) return null;
    const ms = Date.parse(d);
    return isNaN(ms) ? null : ms;
  };

  const periodEndMs = parseDateMs(rawPeriodEnd);
  const trialEndMs = parseDateMs(rawTrialEnd);

  const isCancelAtPeriodEnd =
    flowSub.cancel_at_period_end === 1 ||
    flowSub.cancel_at_period_end === true ||
    flowSub.cancelAtPeriodEnd === true;

  const fallbackLocalStatus = (localMem?.status as CanonicalMembershipStatus) || 'PAST_DUE';

  // 1. CASO FLOW STATUS = 2 (TRIAL / PERÍODO DE PRUEBA)
  if (flowSub.status === 2) {
    // Si la fecha de fin de trial es inválida o faltante -> Fail-closed no destructivo
    if (trialEndMs === null) {
      return {
        status: fallbackLocalStatus,
        gatewayStatus: 'unsupported_or_invalid_gateway_state',
        hasAccess: false,
        accessUntil: null,
        applyStateMutation: false,
        reason: 'UNSUPPORTED_OR_INVALID_GATEWAY_STATE',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // Si el trial ya caducó respecto a la fecha actual y no hay pago
    if (nowMs > trialEndMs) {
      return {
        status: 'EXPIRED',
        gatewayStatus: 'trial_expired',
        hasAccess: false,
        accessUntil: null,
        applyStateMutation: true,
        reason: 'Trial period has expired without paid activation',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // Trial vigente en fechas:
    // Si morose = 1 (factura vencida en trial) -> PAST_DUE
    if (flowSub.morose === 1) {
      return {
        status: 'PAST_DUE',
        gatewayStatus: 'past_due',
        hasAccess: false,
        accessUntil: null,
        applyStateMutation: true,
        reason: 'Flow reports overdue invoice during trial (morose=1)',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // Cancelación programada durante trial (observada en Sandbox)
    if (isCancelAtPeriodEnd) {
      return {
        status: 'TRIAL',
        gatewayStatus: 'trial_cancelled_pending_end',
        hasAccess: true,
        accessUntil: rawTrialEnd,
        applyStateMutation: true,
        reason: 'TRIAL_CANCEL_AT_PERIOD_END_ACCESS_RETAINED',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // morose = 0 o 2 dentro de trial vigente -> TRIAL legítimo (CONTRATO: JAMÁS ACTIVE)
    return {
      status: 'TRIAL',
      gatewayStatus: 'trial',
      hasAccess: true,
      accessUntil: rawTrialEnd,
      applyStateMutation: true,
      reason: 'Active trial period within contractual trial window',
      effectivePeriodStart: rawPeriodStart,
      effectivePeriodEnd: rawPeriodEnd,
      effectiveTrialEnd: rawTrialEnd,
    };
  }

  // 2. CASO FLOW STATUS = 1 (SUSCRIPCIÓN ACTIVA EN FLOW)
  if (flowSub.status === 1) {
    // Morosidad crítica: morose = 1 (factura vencida) -> PAST_DUE inmediato
    if (flowSub.morose === 1) {
      return {
        status: 'PAST_DUE',
        gatewayStatus: 'past_due',
        hasAccess: false,
        accessUntil: null,
        applyStateMutation: true,
        reason: 'Flow reports overdue invoice (morose=1)',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // Si morose = 0 o 2: Validar ventana de período pagado
    if (periodEndMs === null) {
      return {
        status: fallbackLocalStatus,
        gatewayStatus: 'unsupported_or_invalid_gateway_state',
        hasAccess: false,
        accessUntil: null,
        applyStateMutation: false,
        reason: 'UNSUPPORTED_OR_INVALID_GATEWAY_STATE',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // REGLA CRÍTICA: morose = 0 NO otorga acceso si la fecha de período venció
    if (nowMs > periodEndMs) {
      return {
        status: 'EXPIRED',
        gatewayStatus: 'period_lapsed',
        hasAccess: false,
        accessUntil: null,
        applyStateMutation: true,
        reason: 'Paid period has lapsed past current_period_end',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // Período pagado vigente y al día (morose = 0 o morose = 2 pendiente no vencida)
    const reasonText =
      flowSub.morose === 2
        ? 'Active subscription with pending (not overdue) invoice within period'
        : 'Active subscription in good standing within contractual period';

    return {
      status: 'ACTIVE',
      gatewayStatus: 'active',
      hasAccess: true,
      accessUntil: rawPeriodEnd,
      applyStateMutation: true,
      reason: reasonText,
      effectivePeriodStart: rawPeriodStart,
      effectivePeriodEnd: rawPeriodEnd,
      effectiveTrialEnd: rawTrialEnd,
    };
  }

  // 3. CASO FLOW STATUS = 4 (SUSCRIPCIÓN CANCELADA EN FLOW)
  if (flowSub.status === 4) {
    // REGLA FUNDAMENTAL: Estado contractual CANCELLED != Acceso temporal.
    // Si la cancelación es al final del período y el período pagado sigue vigente:
    // targetState = CANCELLED (para no inflar MRR ni desvirtuar estado empresarial)
    // hasAccess = true hasta period_end.
    if (isCancelAtPeriodEnd && periodEndMs !== null && nowMs <= periodEndMs) {
      return {
        status: 'CANCELLED',
        gatewayStatus: 'cancelled_pending_period_end',
        hasAccess: true,
        accessUntil: rawPeriodEnd,
        applyStateMutation: true,
        reason: 'CANCELLED_AT_PERIOD_END_ACCESS_RETAINED',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // Cancelación inmediata o período ya concluido -> CANCELLED sin acceso (cero días de gracia)
    return {
      status: 'CANCELLED',
      gatewayStatus: 'cancelled',
      hasAccess: false,
      accessUntil: null,
      applyStateMutation: true,
      reason: 'CANCELLED_IMMEDIATE_OR_PERIOD_LAPSED',
      effectivePeriodStart: rawPeriodStart,
      effectivePeriodEnd: rawPeriodEnd,
      effectiveTrialEnd: rawTrialEnd,
    };
  }

  // 4. CASO FLOW STATUS = 0 (INACTIVA EN FLOW)
  if (flowSub.status === 0) {
    return {
      status: 'EXPIRED',
      gatewayStatus: 'inactive',
      hasAccess: false,
      accessUntil: null,
      applyStateMutation: true,
      reason: 'Flow reports subscription status 0 (inactive)',
      effectivePeriodStart: rawPeriodStart,
      effectivePeriodEnd: rawPeriodEnd,
      effectiveTrialEnd: rawTrialEnd,
    };
  }

  // 5. ESTADO FLOW DESCONOCIDO O NO SOPORTADO (E.G. STATUS = 5, 99) -> FALLA CERRADA NO DESTRUCTIVA
  return {
    status: fallbackLocalStatus,
    gatewayStatus: `unknown_${flowSub.status}`,
    hasAccess: false,
    accessUntil: null,
    applyStateMutation: false,
    reason: 'UNSUPPORTED_OR_INVALID_GATEWAY_STATE',
    effectivePeriodStart: rawPeriodStart,
    effectivePeriodEnd: rawPeriodEnd,
    effectiveTrialEnd: rawTrialEnd,
  };
}
