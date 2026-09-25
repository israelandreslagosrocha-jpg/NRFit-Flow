'use server';

import { createClient } from '../lib/supabase/server';
import { createAdminClient } from '../lib/supabase/admin';
import { getPaymentGateway } from '../lib/payments';
import { generateTraceId, logger } from '../lib/logger';

/**
 * Server Action para iniciar el checkout de suscripción con Flow Chile (Fase M-09R / M-09.3B)
 * Arquitectura desacoplada: Consume PaymentGateway (soporta AUTOMATIC_RECURRING y SUBSCRIPTION_PAYMENT_LINK).
 * Jerarquía de identidad: auth.users.id -> profiles.user_id -> students.profile_id -> Flow Customer (externalId = student.id)
 * Trazabilidad E2E: Genera trace_id en backend y lo ancla en memberships y email_outbox.
 */
export async function createCheckoutSubscriptionAction() {
  const traceId = generateTraceId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return {
      success: false,
      error: 'Debes iniciar sesión o registrarte para comenzar tu prueba gratuita.',
      redirectUrl: '/auth/login?redirectedFrom=/checkout',
    };
  }

  const adminClient = createAdminClient();

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

  // 2. Obtener plan mensual ($25.000 CLP)
  const { data: plan } = await adminClient
    .from('plans')
    .select('id, price')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const planId = plan?.id || '00000000-0000-0000-0000-000000000001';
  const price = plan?.price || 25000;

  // 3. Crear registro de membresía en PENDING_PAYMENT con trace_id (Anclaje Inequívoco, $0 hoy)
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 7 trial + 30 ciclo

  const { data: membership, error: memError } = await adminClient
    .from('memberships')
    .insert({
      student_id: studentId,
      plan_id: planId,
      status: 'PENDING_PAYMENT', // REGLA: pending NUNCA otorga acceso
      price_contracted: price,
      start_date: startDate,
      end_date: endDate,
      auto_renew: true,
      renewal_mode: 'AUTO_CHARGE',
      gateway: 'FLOW',
      trace_id: traceId,
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

  logger.info('checkout_subscription_initiated', {
    trace_id: traceId,
    gateway: 'FLOW',
    membership_id: membership.id,
  });

  // 4. Invocar pasarela neutra (PaymentGateway / Flow)
  const gateway = getPaymentGateway();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://natyentrenadora.com';

  try {
    // 4.1 Asegurar cliente en Flow vinculado a student.id (1:1 estable)
    const customer = await gateway.createCustomer({
      email: user.email,
      name: studentName,
      externalId: studentId, // Corrección 1: externalId = student.id
    });

    // Guardar referencia del cliente
    await adminClient
      .from('memberships')
      .update({
        gateway_customer_id: customer.id,
      })
      .eq('id', membership.id);

    // 4.2 Si la capacidad de Cargo Automático está activa, enrolar tarjeta
    if (gateway.mode === 'AUTOMATIC_RECURRING') {
      const returnUrl = `${appUrl}/checkout/flow-return?mem_ref=${membership.id}`;
      const registerRes = await gateway.registerPaymentMethod({
        customerId: customer.id,
        returnUrl,
      });

      return {
        success: true,
        mode: 'AUTOMATIC_RECURRING',
        redirectUrl: registerRes.redirectUrl,
      };
    }

    // 4.3 Modo SUBSCRIPTION_PAYMENT_LINK (Suscripción sin tarjeta forzada)
    // Se crea la suscripción con 7 días de trial. Al vencer, Flow emite factura con paymentLink
    const flowPlanId = process.env.FLOW_PLAN_ID || 'naty-mensual-25k-v1';
    const sub = await gateway.createSubscription({
      planId: flowPlanId,
      customerId: customer.id,
      trialPeriodDays: 7,
    });

    const trialEndsAt = sub.trialEndsAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Activar membresía en estado TRIAL por 7 días exactos
    await adminClient
      .from('memberships')
      .update({
        status: 'TRIAL',
        gateway_subscription_id: sub.id,
        gateway_status: 'trial',
        trial_ends_at: trialEndsAt,
      })
      .eq('id', membership.id);

    // Encolar email de bienvenida a prueba gratuita con trace_id vinculado
    await adminClient.from('email_outbox').insert({
      dedupe_key: `flow-trial-start:${membership.id}`,
      recipient_email: user.email,
      subject: '¡Comienza tu prueba de 7 días con Natalia Riquelme!',
      template_id: 'flow_trial_welcome',
      payload: {
        studentName,
        trialEndsAt,
        amount: price,
        trace_id: traceId,
      },
    });

    return {
      success: true,
      mode: 'SUBSCRIPTION_PAYMENT_LINK',
      redirectUrl: '/checkout/success',
    };
  } catch (err: any) {
    console.error('Error al iniciar suscripción con Flow:', err);
    return {
      success: false,
      error: `Error al conectar con la pasarela Flow: ${err.message}`,
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

  const adminClient = createAdminClient();

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
    recipient_email: user.email || 'alumna@natyentrenadora.com',
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
