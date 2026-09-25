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
  last_gateway_event_at?: string | null;
  trace_id?: string | null;
}

export interface DerivedMembershipState {
  status: CanonicalMembershipStatus;
  gatewayStatus: string;
  hasAccess: boolean;
  reason: string;
  effectivePeriodStart?: string | null;
  effectivePeriodEnd?: string | null;
  effectiveTrialEnd?: string | null;
}

/**
 * Función pura de derivación de estado multivariable.
 * Evalúa conjuntamente:
 * - flowSub.status (0, 1, 2, 4)
 * - flowSub.morose (0=al día, 1=overdue, 2=pending unexpired)
 * - Fechas contractuales (trial_end, period_end, now)
 * - Indicador cancel_at_period_end
 * - Estado local previo (para subsanación o transición)
 *
 * Cumple exhaustivamente con la Matriz Canónica M-09.3D.
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

  // 1. CASO FLOW STATUS = 2 (TRIAL / PERÍODO DE PRUEBA)
  if (flowSub.status === 2) {
    // Si la fecha de fin de trial es inválida o faltante -> Fail-closed
    if (trialEndMs === null) {
      return {
        status: 'EXPIRED',
        gatewayStatus: 'trial',
        hasAccess: false,
        reason: 'Flow reports trial status but trial end date is missing or invalid',
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
        reason: 'Trial period has expired without paid activation',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // Si el trial está dentro de la ventana de tiempo:
    // Si morose = 1 (factura vencida en trial) -> PAST_DUE
    if (flowSub.morose === 1) {
      return {
        status: 'PAST_DUE',
        gatewayStatus: 'past_due',
        hasAccess: false,
        reason: 'Flow reports overdue invoice during trial (morose=1)',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // morose = 0 o morose = 2 dentro del trial vigente -> TRIAL legítimo (CONTRATO: JAMÁS ACTIVE)
    return {
      status: 'TRIAL',
      gatewayStatus: 'trial',
      hasAccess: true,
      reason: 'Active trial period within contractual trial window',
      effectivePeriodStart: rawPeriodStart,
      effectivePeriodEnd: rawPeriodEnd,
      effectiveTrialEnd: rawTrialEnd,
    };
  }

  // 2. CASO FLOW STATUS = 1 (SUSCRIPCIÓN ACTIVA EN FLOW)
  if (flowSub.status === 1) {
    // Morosidad crítica: morose = 1 (al menos una factura vencida) -> PAST_DUE inmediato
    if (flowSub.morose === 1) {
      return {
        status: 'PAST_DUE',
        gatewayStatus: 'past_due',
        hasAccess: false,
        reason: 'Flow reports overdue invoice (morose=1)',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // Si morose = 0 o morose = 2: Validar ventana de período pagado
    if (periodEndMs === null) {
      // Falta de fecha en período activo -> Fail-closed
      return {
        status: 'PAST_DUE',
        gatewayStatus: 'active_incomplete_dates',
        hasAccess: false,
        reason: 'Flow reports active subscription but period end date is missing or invalid',
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
      reason: reasonText,
      effectivePeriodStart: rawPeriodStart,
      effectivePeriodEnd: rawPeriodEnd,
      effectiveTrialEnd: rawTrialEnd,
    };
  }

  // 3. CASO FLOW STATUS = 4 (SUSCRIPCIÓN CANCELADA EN FLOW)
  if (flowSub.status === 4) {
    // Si fue cancelada al final del período (cancel_at_period_end = 1) y el período aún está vigente
    if (isCancelAtPeriodEnd && periodEndMs !== null && nowMs <= periodEndMs) {
      return {
        status: 'ACTIVE',
        gatewayStatus: 'cancelled_pending_period_end',
        hasAccess: true,
        reason: 'Subscription cancelled with contractual access retained until current_period_end',
        effectivePeriodStart: rawPeriodStart,
        effectivePeriodEnd: rawPeriodEnd,
        effectiveTrialEnd: rawTrialEnd,
      };
    }

    // Cancelación inmediata o período concluido -> CANCELLED (cero días artificiales)
    return {
      status: 'CANCELLED',
      gatewayStatus: 'cancelled',
      hasAccess: false,
      reason: 'Subscription cancelled without active contractual period',
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
      reason: 'Flow reports subscription status 0 (inactive)',
      effectivePeriodStart: rawPeriodStart,
      effectivePeriodEnd: rawPeriodEnd,
      effectiveTrialEnd: rawTrialEnd,
    };
  }

  // 5. ESTADO DESCONOCIDO O ANÓMALO -> FAIL-CLOSED
  return {
    status: 'EXPIRED',
    gatewayStatus: `unknown_${flowSub.status}`,
    hasAccess: false,
    reason: `Unrecognized Flow subscription status: ${flowSub.status}`,
    effectivePeriodStart: rawPeriodStart,
    effectivePeriodEnd: rawPeriodEnd,
    effectiveTrialEnd: rawTrialEnd,
  };
}
