import { SupabaseClient } from '@supabase/supabase-js';

export type MembershipStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'PAST_DUE'
  | 'PENDING_PAYMENT'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'NO_MEMBERSHIP';

export interface MembershipRecord {
  id: string;
  student_id: string;
  status: string;
  start_date: string;
  end_date?: string | null;
  trial_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  price_contracted?: number;
  gateway_subscription_id?: string | null;
  gateway_status?: string | null;
  created_at: string;
}

export interface AccessEvaluation {
  hasAccess: boolean;
  status: MembershipStatus;
  reason?: string;
  membership?: MembershipRecord | null;
}

/**
 * Valida la vigencia y acceso de una membresía con separación estricta de ramas y política de falla cerrada (fail-closed).
 * 
 * Reglas de Acceso:
 * 1. TRIAL:
 *    - Requiere inicio válido (start_date <= now) y trial_ends_at en el futuro.
 *    - NO exige current_period_end.
 * 2. ACTIVE:
 *    - Requiere inicio válido (start_date <= now) y (current_period_end ?? end_date) en el futuro.
 *    - NO exige trial_ends_at.
 *    - FALLA CERRADO: Si faltan ambas fechas de fin, se deniega acceso.
 * 3. PAUSED, PAST_DUE, PENDING_PAYMENT, CANCELLED, EXPIRED, NO_MEMBERSHIP:
 *    - Denegación estricta de acceso sin excepciones.
 */
export function validateMembershipDates(
  membership: MembershipRecord,
  now: Date = new Date()
): AccessEvaluation {
  const statusUpper = (membership.status || '').toUpperCase() as MembershipStatus;

  // 1. Rama TRIAL
  if (statusUpper === 'TRIAL') {
    const isStarted = membership.start_date != null && new Date(membership.start_date) <= now;
    const isTrialActive =
      membership.trial_ends_at != null && new Date(membership.trial_ends_at) >= now;

    if (isStarted && isTrialActive) {
      return {
        hasAccess: true,
        status: 'TRIAL',
        membership,
      };
    }

    return {
      hasAccess: false,
      status: 'EXPIRED',
      reason: 'Período de prueba finalizado o sin fecha de término válida',
      membership,
    };
  }

  // 2. Rama ACTIVE (Fail-closed)
  if (statusUpper === 'ACTIVE') {
    const isStarted = membership.start_date != null && new Date(membership.start_date) <= now;
    const periodEnd = membership.current_period_end ?? membership.end_date;
    const isPeriodActive = periodEnd != null && new Date(periodEnd) >= now;

    if (isStarted && isPeriodActive) {
      return {
        hasAccess: true,
        status: 'ACTIVE',
        membership,
      };
    }

    return {
      hasAccess: false,
      status: 'EXPIRED',
      reason: 'Ciclo de facturación vencido o sin fecha de término válida',
      membership,
    };
  }

  // 3. Estado PAUSED explícito
  if (statusUpper === 'PAUSED') {
    return {
      hasAccess: false,
      status: 'PAUSED',
      reason: 'La membresía se encuentra pausada',
      membership,
    };
  }

  // 4. Estado PAST_DUE (Sin gracia comercial asumida hasta confirmación explícita)
  if (statusUpper === 'PAST_DUE') {
    return {
      hasAccess: false,
      status: 'PAST_DUE',
      reason: 'Pago pendiente o atrasado en la suscripción',
      membership,
    };
  }

  // 5. Otros estados bloqueados: PENDING_PAYMENT, CANCELLED, EXPIRED
  return {
    hasAccess: false,
    status: statusUpper,
    reason: `Membresía no vigente (estado: ${statusUpper})`,
    membership,
  };
}

/**
 * Consulta la membresía más reciente de una alumna y evalúa su acceso server-side.
 */
export async function checkStudentMembershipAccess(
  supabase: SupabaseClient,
  studentId: string,
  now: Date = new Date()
): Promise<AccessEvaluation> {
  if (!studentId) {
    return {
      hasAccess: false,
      status: 'NO_MEMBERSHIP',
      reason: 'Identificador de alumna no proporcionado',
    };
  }

  const { data: memberships, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    return {
      hasAccess: false,
      status: 'NO_MEMBERSHIP',
      reason: `Error al consultar membresía: ${error.message}`,
    };
  }

  if (!memberships || memberships.length === 0) {
    return {
      hasAccess: false,
      status: 'NO_MEMBERSHIP',
      reason: 'No existe ninguna membresía asociada a esta cuenta',
    };
  }

  // Buscar primero si hay alguna membresía TRIAL o ACTIVE vigente
  for (const m of memberships) {
    const evalResult = validateMembershipDates(m as MembershipRecord, now);
    if (evalResult.hasAccess) {
      return evalResult;
    }
  }

  // Si ninguna concede acceso, evaluar la más reciente para reportar el motivo exacto
  return validateMembershipDates(memberships[0] as MembershipRecord, now);
}
