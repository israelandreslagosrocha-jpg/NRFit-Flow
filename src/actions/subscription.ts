'use server';

import { createClient } from '../lib/supabase/server';
import { createAdminClient } from '../lib/supabase/admin';
import { getPaymentGateway } from '../lib/payments';
import { generateTraceId, logger } from '../lib/logger';
import {
  getCurrentMembershipOffer,
  getMembershipOfferForPrice,
  type MembershipOfferId,
} from '../lib/offers/membership-offer';
import {
  getFlowPlanIdForFirstCycleDiscount,
  getFlowPlanIdForOffer,
} from '../lib/payments/flow/plan';
import {
  createFreeTrialWindow,
  getRenewalSettings,
  isFreeTrialFinished,
  type RenewalChoice,
} from '../lib/memberships/renewal-policy';
import {
  getDiscountedMonthlyPrice,
  isDiscountPercentage,
  type DiscountPercentage,
} from '../lib/memberships/admin-membership';

function normalizeReferralCouponCode(value: string | null | undefined): string | null {
  const normalized = (value || '').trim().toUpperCase();
  if (!normalized) return null;
  return /^[A-Z0-9-]{4,50}$/.test(normalized) ? normalized : null;
}

function isUsableDiscountExpiry(value: string | null | undefined, now: Date = new Date()): boolean {
  return !value || new Date(value).getTime() >= now.getTime();
}

/**
 * Inicia exclusivamente el período gratuito. No llama a Flow ni pide tarjeta:
 * la alumna elige su modalidad al finalizar sus siete días de prueba.
 */
export async function createCheckoutSubscriptionAction(expectedOfferId: MembershipOfferId, referralCouponInput?: string) {
  const traceId = generateTraceId();
  const offer = getCurrentMembershipOffer();

  // El monto que vio y aceptó la alumna debe ser el mismo que se contrata.
  // Si dejó el checkout abierto durante el cambio de campaña, no iniciamos
  // una membresía con el nuevo precio sin que vuelva a verlo y aceptarlo.
  if (expectedOfferId !== offer.id) {
    return {
      success: false,
      error: 'La oferta vigente cambió. Actualiza esta página para revisar el nuevo valor antes de continuar.',
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return {
      success: false,
      error: 'Debes iniciar sesión o registrarte para comenzar tu prueba gratuita.',
      redirectUrl: '/auth/login?redirectedFrom=/checkout',
    };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      success: false,
      error: 'El checkout todavía no está configurado en el servidor. Intenta nuevamente más tarde.',
    };
  }

  // 1. Resolver jerarquía de identidad: auth.users.id -> profiles.user_id -> students.profile_id
  const { ensureStudentProfile } = await import('../lib/supabase/profile-helpers');
  const resolution = await ensureStudentProfile(adminClient, user);

  if (!resolution.student) {
    return {
      success: false,
      error: 'No se pudo vincular el perfil de alumna.',
    };
  }

  const studentId = resolution.student.id;
  const studentName = resolution.profile?.full_name || 'Alumna';

  // 2. Una cuenta sólo tiene una primera prueba gratuita. Si ya existe una
  // membresía vigente o pendiente, se conserva su flujo comercial actual.
  const { data: latestMembership } = await adminClient
    .from('memberships')
    .select('id, status, trial_ends_at, current_period_end')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestMembership) {
    const hasCurrentTrial = latestMembership.status === 'TRIAL'
      && !isFreeTrialFinished(latestMembership.trial_ends_at);
    const hasCurrentMembership = latestMembership.status === 'ACTIVE'
      || latestMembership.status === 'PENDING_PAYMENT';

    if (hasCurrentTrial || hasCurrentMembership) {
      return {
        success: true,
        redirectUrl: '/para-ti',
      };
    }

    // La prueba es única por cuenta. Si existe una membresía terminada, el
    // portal le ofrece continuar sin regalar una segunda semana al volver al
    // checkout.
    return {
      success: false,
      error: 'Esta cuenta ya utilizó su prueba gratuita. Desde tu portal puedes elegir cómo continuar tu membresía.',
      redirectUrl: '/para-ti',
    };
  }

  // 3. Resolver el plan interno y fijar el precio vigente en el instante de
  // inscripción. `price_contracted` es la fuente de verdad histórica.
  const { data: plan } = await adminClient
    .from('plans')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const planId = plan?.id || '00000000-0000-0000-0000-000000000001';
  const price = offer.monthlyPrice;

  // Un descuento personal pertenece a la alumna; un cupón de invitación se
  // valida antes de crear la prueba. Ambos se reservan en la membresía y sólo
  // se usan para el primer ciclo pagado, nunca para rebajar renovaciones.
  const now = new Date();
  const { data: personalDiscount } = await adminClient
    .from('membership_discounts')
    .select('id, discount_percent, expires_at')
    .eq('student_id', studentId)
    .eq('source', 'PERSONAL')
    .eq('status', 'AVAILABLE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let referralCoupon: { id: string; code: string; discount_value: number | string; expires_at: string | null; issued_to_student_id: string | null; issued_by_profile_id: string } | null = null;
  const referralCode = normalizeReferralCouponCode(referralCouponInput);
  if (referralCouponInput?.trim() && !referralCode) {
    return { success: false, error: 'El código promocional tiene un formato inválido.' };
  }
  if (referralCode) {
    const { data } = await adminClient
      .from('coupons')
      .select('id, code, discount_value, expires_at, issued_to_student_id, issued_by_profile_id, is_active, scope')
      .eq('code', referralCode)
      .eq('scope', 'REFERRAL')
      .eq('is_active', true)
      .maybeSingle();

    if (!data || data.issued_to_student_id === studentId || !isUsableDiscountExpiry(data.expires_at, now) || !isDiscountPercentage(Number(data.discount_value))) {
      return { success: false, error: 'Este cupón no está disponible. Revisa el código o pide uno vigente a quien te invitó.' };
    }

    const { data: priorClaim, error: claimLookupError } = await adminClient
      .from('membership_discounts')
      .select('id')
      .eq('coupon_id', data.id)
      .limit(1)
      .maybeSingle();
    if (claimLookupError || priorClaim) {
      return { success: false, error: 'Este cupón ya fue reservado o utilizado. Pide un nuevo código a quien te invitó.' };
    }
    referralCoupon = data;
  }

  const selectedDiscountPercent = referralCoupon
    ? Number(referralCoupon.discount_value) as DiscountPercentage
    : personalDiscount && isUsableDiscountExpiry(personalDiscount.expires_at, now) && isDiscountPercentage(Number(personalDiscount.discount_percent))
      ? Number(personalDiscount.discount_percent) as DiscountPercentage
      : null;
  const selectedDiscountExpiry = referralCoupon?.expires_at || personalDiscount?.expires_at || null;

  // 4. Crear una prueba autónoma. No se crea cliente, suscripción ni factura
  // en Flow hasta que la alumna decida continuar al terminar la prueba.
  const trialWindow = createFreeTrialWindow();

  const { data: membership, error: memError } = await adminClient
    .from('memberships')
    .insert({
      student_id: studentId,
      plan_id: planId,
      status: 'TRIAL',
      price_contracted: price,
      start_date: trialWindow.startDate,
      end_date: trialWindow.endDate,
      trial_ends_at: trialWindow.trialEndsAt,
      auto_renew: false,
      renewal_mode: 'EXPIRE_ON_DATE',
      gateway: 'FLOW',
      gateway_status: 'trial_pending_choice',
      trace_id: traceId,
      billing_email: user.email,
      discount_percent: selectedDiscountPercent,
      discount_status: selectedDiscountPercent ? 'RESERVED' : 'NONE',
      discount_code: referralCoupon?.code || null,
      discount_expires_at: selectedDiscountExpiry,
    })
    .select('id')
    .single();

  if (memError || !membership) {
    logger.error('checkout_membership_init_failed', {
      trace_id: traceId,
      student_id: studentId,
    }, memError);
    return {
      success: false,
      error: 'Error al inicializar la membresía interna.',
    };
  }

  if (referralCoupon && selectedDiscountPercent) {
    // Cierre compare-and-set: aunque dos navegadores hayan validado el código
    // a la vez, sólo el primero puede desactivarlo. El segundo no obtiene una
    // prueba sin el descuento prometido.
    const { data: claimedCoupon, error: claimError } = await adminClient
      .from('coupons')
      .update({ is_active: false })
      .eq('id', referralCoupon.id)
      .eq('is_active', true)
      .select('id')
      .maybeSingle();

    if (claimError || !claimedCoupon) {
      await adminClient.from('memberships').delete().eq('id', membership.id).eq('status', 'TRIAL');
      return { success: false, error: 'Este cupón acaba de ser utilizado. Pide un código nuevo e inténtalo nuevamente.' };
    }

    const { error: discountError } = await adminClient.from('membership_discounts').insert({
      student_id: studentId,
      membership_id: membership.id,
      coupon_id: referralCoupon.id,
      source: 'REFERRAL',
      discount_percent: selectedDiscountPercent,
      applies_to: 'FIRST_PAID_CYCLE',
      status: 'RESERVED',
      expires_at: selectedDiscountExpiry,
      assigned_by_profile_id: referralCoupon.issued_by_profile_id,
    });
    if (discountError) {
      logger.error('referral_coupon_reservation_failed', {
        trace_id: traceId,
        membership_id: membership.id,
        coupon_id: referralCoupon.id,
      }, discountError);
      // Conservador: no dejamos una prueba creada con un código consumido pero
      // sin el descuento. La reserva se revierte antes de enviar bienvenida.
      await adminClient.from('coupons').update({ is_active: true }).eq('id', referralCoupon.id).eq('is_active', false);
      await adminClient.from('memberships').delete().eq('id', membership.id).eq('status', 'TRIAL');
      return { success: false, error: 'No fue posible reservar el cupón. No se inició ninguna prueba; inténtalo nuevamente.' };
    }
  } else if (personalDiscount && selectedDiscountPercent) {
    const { error: discountError } = await adminClient
      .from('membership_discounts')
      .update({
        membership_id: membership.id,
        status: 'RESERVED',
        updated_at: now.toISOString(),
      })
      .eq('id', personalDiscount.id)
      .eq('status', 'AVAILABLE');
    if (discountError) {
      logger.warn('personal_discount_reservation_failed', {
        trace_id: traceId,
        membership_id: membership.id,
        discount_id: personalDiscount.id,
      });
    }
  }

  logger.info('free_trial_started', {
    trace_id: traceId,
    membership_id: membership.id,
  });

  // Encolar bienvenida sin hacer contacto con la pasarela de pago.
  await adminClient.from('email_outbox').insert({
    dedupe_key: `flow-trial-start:${membership.id}`,
    recipient_email: user.email,
    subject: '¡Comienza tu prueba de 7 días con Natalia Riquelme!',
    template_id: 'flow_trial_welcome',
    payload: {
      studentName,
      trialEndsAt: trialWindow.trialEndsAt,
      amount: price,
      firstPaidCycleAmount: selectedDiscountPercent
        ? getDiscountedMonthlyPrice(price, selectedDiscountPercent)
        : price,
      firstPaidCycleDiscountPercent: selectedDiscountPercent,
      trace_id: traceId,
    },
  });

  return {
    success: true,
    mode: 'FREE_TRIAL',
    redirectUrl: '/checkout/success',
  };
}

/**
 * Inicia el método elegido por la alumna después de su prueba gratuita o,
 * si ella lo solicita expresamente, un pago manual anticipado. En este último
 * caso se informa antes de salir a Flow que el ciclo pagado comienza hoy.
 * La elección se determina en servidor y queda persistida antes de llamar a
 * Flow; el navegador jamás puede imponer una modalidad de pago por sí solo.
 */
export async function beginMembershipRenewalAction(
  choice: RenewalChoice,
  timing: 'AFTER_TRIAL' | 'PAY_NOW' = 'AFTER_TRIAL'
) {
  if (choice !== 'AUTO_CHARGE' && choice !== 'MANUAL_RENEWAL') {
    return { success: false, error: 'La modalidad de pago seleccionada no es válida.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { success: false, error: 'Tu sesión expiró. Ingresa nuevamente para continuar.' };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return { success: false, error: 'La gestión de pagos no está configurada en el servidor.' };
  }

  const { getStudentProfileByUserId } = await import('../lib/supabase/profile-helpers');
  const { profile, student } = await getStudentProfileByUserId(adminClient, user.id);
  if (!student) {
    return { success: false, error: 'No encontramos tu perfil de alumna.' };
  }

  const { data: membership } = await adminClient
    .from('memberships')
    .select('id, status, trial_ends_at, current_period_end, end_date, price_contracted, gateway_customer_id, gateway_subscription_id, gateway_status, auto_renew, renewal_mode, membership_source, is_complimentary, discount_percent, discount_status, discount_expires_at, discount_code')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { success: false, error: 'No encontramos una prueba asociada a tu cuenta.' };
  }

  if (membership.status === 'PENDING_PAYMENT') {
    if (membership.renewal_mode === 'MANUAL_RENEWAL' && membership.gateway_subscription_id) {
      return getManualPaymentLinkForMembership(membership.id, membership.gateway_subscription_id);
    }
    return {
      success: false,
      error: 'Ya hay una activación de pago en curso. Termina ese proceso antes de elegir otra modalidad.',
    };
  }

  const isActiveTrial = membership.status === 'TRIAL' && !isFreeTrialFinished(membership.trial_ends_at);
  const canPayNow = timing === 'PAY_NOW' && choice === 'MANUAL_RENEWAL' && isActiveTrial;
  const canRenewAfterTrial = membership.status === 'TRIAL' && isFreeTrialFinished(membership.trial_ends_at);
  const periodEnd = membership.current_period_end || membership.end_date;
  const periodHasFinished = Boolean(periodEnd) && new Date(periodEnd!).getTime() <= Date.now();
  const isExternallyManaged = membership.membership_source === 'EXTERNAL_PAYMENT' || membership.is_complimentary;
  // Una mensualidad pagada que terminó (incluido un primer ciclo con cupón de
  // un solo período) puede continuar sin volver a crear una prueba gratis.
  // Aceptamos ACTIVE sólo cuando su fecha contractual ya venció: el helper de
  // acceso la trata como EXPIRADA antes de que el reconciliador la normalice.
  const canRenewExpiredPaidCycle = timing === 'AFTER_TRIAL'
    && !isExternallyManaged
    && (
      membership.status === 'EXPIRED'
      || (membership.status === 'CANCELLED' && periodHasFinished)
      || (membership.status === 'ACTIVE' && periodHasFinished)
    );

  if (isExternallyManaged) {
    return {
      success: false,
      error: 'Esta membresía es gestionada directamente por Natalia. Escríbenos para revisar su renovación.',
    };
  }

  if (!canPayNow && !canRenewAfterTrial && !canRenewExpiredPaidCycle) {
    return {
      success: false,
      error: 'Esta modalidad estará disponible al finalizar tu período vigente. El pago anticipado sólo puede hacerse mediante enlace manual de Flow.',
    };
  }

  const offer = getMembershipOfferForPrice(membership.price_contracted);
  if (!offer) {
    return { success: false, error: 'No fue posible recuperar el precio fijado de tu inscripción.' };
  }

  const firstCycleDiscount = membership.discount_status === 'RESERVED'
    && isDiscountPercentage(Number(membership.discount_percent))
    && isUsableDiscountExpiry(membership.discount_expires_at);
  const discountPercent = firstCycleDiscount ? Number(membership.discount_percent) as DiscountPercentage : null;

  // Un cupón de primer mes se procesa mediante un enlace manual de un solo
  // ciclo. Así Flow no puede reutilizar la rebaja en meses posteriores y la
  // alumna vuelve a decidir su modalidad normal al terminar ese ciclo.
  if (discountPercent && choice === 'AUTO_CHARGE') {
    return {
      success: false,
      error: `Tu descuento de ${discountPercent}% se aplica mediante un enlace seguro de Flow sólo para el primer mes. Después podrás elegir pago automático o recordatorio mensual al valor normal.`,
    };
  }

  const renewal = getRenewalSettings(choice);
  const { data: lockedMembership, error: lockError } = await adminClient
    .from('memberships')
    .update({
      status: 'PENDING_PAYMENT',
      auto_renew: renewal.autoRenew,
      renewal_mode: renewal.renewalMode,
      gateway: 'FLOW',
      gateway_status: canPayNow
        ? discountPercent
          ? 'discount_first_cycle_payment_pending'
          : 'early_manual_payment_pending'
        : choice === 'AUTO_CHARGE'
          ? 'card_registration_pending'
          : discountPercent
            ? 'discount_first_cycle_payment_pending'
            : 'payment_link_pending',
      billing_email: user.email,
    })
    .eq('id', membership.id)
    .eq('status', membership.status)
    .select('id, gateway_customer_id')
    .maybeSingle();

  if (lockError || !lockedMembership) {
    return {
      success: false,
      error: 'Tu membresía cambió de estado. Actualiza la página antes de continuar.',
    };
  }

  const gateway = getPaymentGateway();
  let subscriptionCreated = false;

  try {
    let customerId = lockedMembership.gateway_customer_id || membership.gateway_customer_id;
    if (!customerId) {
      const customer = await gateway.createCustomer({
        email: user.email,
        name: profile?.full_name || user.user_metadata?.full_name || 'Alumna Team Naty',
        externalId: student.id,
      });
      customerId = customer.id;
      await adminClient
        .from('memberships')
        .update({ gateway_customer_id: customerId })
        .eq('id', membership.id);
    }

    if (choice === 'AUTO_CHARGE') {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://natyentrenadora.com';
      const registerRes = await gateway.registerPaymentMethod({
        customerId,
        returnUrl: `${appUrl}/checkout/flow-return`,
      });

      return {
        success: true,
        mode: 'AUTO_CHARGE' as const,
        redirectUrl: registerRes.redirectUrl,
      };
    }

    const flowPlanId = discountPercent
      ? getFlowPlanIdForFirstCycleDiscount(offer, discountPercent)
      : getFlowPlanIdForOffer(offer);
    const subscription = await gateway.createSubscription({
      planId: flowPlanId,
      customerId,
      trialPeriodDays: renewal.flowTrialPeriodDays,
      periodsNumber: discountPercent ? 1 : undefined,
    });
    subscriptionCreated = true;

    await adminClient
      .from('memberships')
      .update({
        gateway_subscription_id: subscription.id,
        gateway_plan_id: flowPlanId,
        gateway_status: 'awaiting_manual_payment',
      })
      .eq('id', membership.id);

    return {
      success: true,
      mode: 'MANUAL_RENEWAL' as const,
      paymentUrl: subscription.pendingPaymentUrl || null,
      message: subscription.pendingPaymentUrl
        ? discountPercent
          ? `Tu enlace de pago con ${discountPercent}% de descuento para el primer mes ya está disponible.`
          : 'Tu enlace de pago ya está disponible.'
        : 'Flow está preparando tu enlace de pago. Vuelve a esta pantalla en unos momentos.',
    };
  } catch (err: any) {
    // Si no se alcanzó a crear una suscripción en Flow, se libera el estado para
    // que la alumna pueda volver a elegir. Nunca se revierte una suscripción
    // remota cuya creación no podamos demostrar como inexistente.
    if (!subscriptionCreated) {
      await adminClient
        .from('memberships')
        .update({
          status: membership.status,
          auto_renew: membership.auto_renew,
          renewal_mode: membership.renewal_mode,
          gateway_status: membership.gateway_status || 'renewal_choice_error',
        })
        .eq('id', membership.id)
        .eq('status', 'PENDING_PAYMENT');
    }

    logger.error('membership_renewal_start_failed', {
      membership_id: membership.id,
      renewal_mode: choice,
    }, err);
    return {
      success: false,
      error: 'No fue posible iniciar tu modalidad de pago. Inténtalo nuevamente en unos minutos.',
    };
  }
}

/** Recupera de Flow el enlace vigente sin almacenar tokens de pago en la base de datos. */
export async function getManualPaymentLinkAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Tu sesión expiró. Ingresa nuevamente.' };

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return { success: false, error: 'La gestión de pagos no está configurada en el servidor.' };
  }

  const { getStudentProfileByUserId } = await import('../lib/supabase/profile-helpers');
  const { student } = await getStudentProfileByUserId(adminClient, user.id);
  if (!student) return { success: false, error: 'No encontramos tu perfil de alumna.' };

  const { data: membership } = await adminClient
    .from('memberships')
    .select('id, status, renewal_mode, gateway_subscription_id')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    !membership
    || membership.status !== 'PENDING_PAYMENT'
    || membership.renewal_mode !== 'MANUAL_RENEWAL'
    || !membership.gateway_subscription_id
  ) {
    return { success: false, error: 'No hay un enlace mensual pendiente para esta cuenta.' };
  }

  return getManualPaymentLinkForMembership(membership.id, membership.gateway_subscription_id);
}

async function getManualPaymentLinkForMembership(membershipId: string, subscriptionId: string) {
  try {
    const gateway = getPaymentGateway();
    const subscription = await gateway.getSubscription(subscriptionId);
    return {
      success: true,
      mode: 'MANUAL_RENEWAL' as const,
      paymentUrl: subscription.pendingPaymentUrl || null,
      message: subscription.pendingPaymentUrl
        ? 'Tu enlace de pago está listo.'
        : 'Flow todavía está preparando el enlace. Vuelve a intentarlo en unos minutos.',
    };
  } catch (err: any) {
    logger.error('manual_payment_link_lookup_failed', { membership_id: membershipId }, err);
    return {
      success: false,
      error: 'No fue posible obtener tu enlace de pago ahora. Inténtalo nuevamente en unos minutos.',
    };
  }
}

/**
 * Server Action para cancelar la suscripción (Política Oficial Naty)
 * - Durante TRIAL: Conserva acceso hasta trial_ends_at -> cero cobros ($0 CLP total).
 * - Durante ACTIVE: Conserva acceso hasta current_period_end -> cero renovaciones futuras.
 * - Invoca Flow cancelSubscription con at_period_end = 1.
 */
export async function cancelSubscriptionAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'No autorizado' };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return { success: false, error: 'La gestión de suscripciones no está configurada en el servidor.' };
  }

  // Buscar ficha de alumna
  const { getStudentProfileByUserId } = await import('../lib/supabase/profile-helpers');
  const resolution = await getStudentProfileByUserId(adminClient, user.id);
  const student = resolution.student;

  if (!student) {
    return { success: false, error: 'Perfil de alumna no encontrado' };
  }

  const { data: membership } = await adminClient
    .from('memberships')
    .select('id, status, gateway_subscription_id, trial_ends_at, current_period_end, auto_renew')
    .eq('student_id', student.id)
    .in('status', ['TRIAL', 'ACTIVE', 'PAST_DUE'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!membership) {
    return { success: false, error: 'No tienes una membresía activa para cancelar.' };
  }

  const gateway = getPaymentGateway();

  if (membership.gateway_subscription_id) {
    try {
      // Flow cancelSubscription con at_period_end = 1 (mantiene vigencia pagada)
      await gateway.cancelSubscription(membership.gateway_subscription_id, true);
    } catch (err: any) {
      console.warn('Aviso: cancelación en pasarela falló o ya estaba programada:', err.message);
    }
  }

  const isTrial = membership.status === 'TRIAL';
  const periodEndFormatted = isTrial
    ? (membership.trial_ends_at ? new Date(membership.trial_ends_at).toLocaleDateString('es-CL') : 'el fin de tus 7 días')
    : (membership.current_period_end ? new Date(membership.current_period_end).toLocaleDateString('es-CL') : 'el fin del período pagado');

  // Política Naty: Desactivar auto_renew pero preservar el acceso durante los días restantes
  await adminClient
    .from('memberships')
    .update({
      auto_renew: false,
      cancelled_at: new Date().toISOString(),
      cancel_reason: isTrial
        ? 'Cancelación voluntaria de renovación en período de prueba'
        : 'Cancelación voluntaria de renovación de membresía activa',
    })
    .eq('id', membership.id);

  // Encolar email de confirmación
  const templateId = isTrial ? 'trial_cancellation' : 'active_cancellation';
  await adminClient.from('email_outbox').insert({
    dedupe_key: `cancel-user:${membership.id}:${Date.now()}`,
    recipient_email: user.email,
    subject: isTrial ? 'Confirmación de cancelación de renovación de prueba' : 'Confirmación de cancelación de suscripción',
    template_id: templateId,
    payload: {
      studentName: user.user_metadata?.full_name || 'Alumna',
      accessUntil: periodEndFormatted,
      isTrial,
    },
  });

  return {
    success: true,
    isTrial,
    accessUntil: periodEndFormatted,
    message: isTrial
      ? `Tu renovación ha sido cancelada. Mantendrás acceso gratuito hasta ${periodEndFormatted} y no se realizará ningún cobro ($0 CLP cobrados en total).`
      : `Tu renovación automática ha sido cancelada. Mantendrás acceso completo hasta ${periodEndFormatted} y no se realizarán futuros cargos.`,
  };
}
