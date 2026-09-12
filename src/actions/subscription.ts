'use server';

import { createClient } from '../lib/supabase/server';
import { createAdminClient } from '../lib/supabase/admin';
import { createSubscription, cancelSubscription } from '../lib/mercadopago/client';

/**
 * Server Action para iniciar el checkout de suscripción con Mercado Pago
 * Ciclo de vida: La membresía se crea en estado 'PENDING_PAYMENT'.
 * NO otorga acceso hasta que Mercado Pago confirme 'authorized' vía webhook.
 */
export async function createCheckoutSubscriptionAction() {
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

  // 1. Obtener o crear el perfil de alumna en students
  const { data: student } = await adminClient
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single();

  let studentId = student?.id;

  if (!studentId) {
    const { data: newStudent, error: studentError } = await adminClient
      .from('students')
      .insert({ profile_id: user.id })
      .select('id')
      .single();

    if (studentError || !newStudent) {
      return {
        success: false,
        error: 'No se pudo vincular el perfil de alumna.',
      };
    }
    studentId = newStudent.id;
  }

  // 2. Obtener el plan de Membresía Mensual ($25.000 CLP)
  const { data: plan } = await adminClient
    .from('plans')
    .select('id, price')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const planId = plan?.id || '00000000-0000-0000-0000-000000000001';
  const price = plan?.price || 25000;

  // 3. Crear registro de membresía en PENDING_PAYMENT (Anclaje Inequívoco)
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
    })
    .select('id')
    .single();

  if (memError || !membership) {
    return {
      success: false,
      error: 'Error al inicializar la membresía interna.',
    };
  }

  // 4. Invocar API de Mercado Pago con external_reference = membership.id
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const returnUrl = `${appUrl}/checkout/success?membership_id=${membership.id}`;

  try {
    const mpResponse = await createSubscription({
      email: user.email,
      membershipId: membership.id,
      returnUrl,
    });

    // Guardar el gateway_subscription_id generado
    await adminClient
      .from('memberships')
      .update({
        gateway_subscription_id: mpResponse.id,
        gateway_status: mpResponse.status || 'pending',
      })
      .eq('id', membership.id);

    return {
      success: true,
      initPoint: mpResponse.init_point,
    };
  } catch (err: any) {
    console.error('Error al invocar Mercado Pago:', err);
    return {
      success: false,
      error: `No se pudo conectar con Mercado Pago: ${err.message}`,
    };
  }
}

/**
 * Server Action para cancelar la suscripción
 * - Invoca PUT /preapproval/{id} con { status: "canceled" }
 * - Traduce a estado interno 'CANCELLED'
 * - Diferencia entre cancelación durante Trial vs cancelación de Membresía Activa
 */
export async function cancelSubscriptionAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'No autorizado' };
  }

  const adminClient = createAdminClient();

  // Buscar la membresía activa o en trial de la alumna
  const { data: student } = await adminClient
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single();

  if (!student) {
    return { success: false, error: 'Perfil no encontrado' };
  }

  const { data: membership } = await adminClient
    .from('memberships')
    .select('id, status, gateway_subscription_id, trial_ends_at, current_period_end')
    .eq('student_id', student.id)
    .in('status', ['TRIAL', 'ACTIVE', 'PAST_DUE'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!membership) {
    return { success: false, error: 'No tienes una membresía activa para cancelar.' };
  }

  if (membership.gateway_subscription_id) {
    try {
      // Llamada oficial a Mercado Pago con { status: "canceled" }
      await cancelSubscription(membership.gateway_subscription_id);
    } catch (err: any) {
      console.warn('Aviso: cancelación en pasarela falló o ya estaba cancelada:', err.message);
    }
  }

  const isTrial = membership.status === 'TRIAL';

  // Actualizar estado interno a CANCELLED
  await adminClient
    .from('memberships')
    .update({
      status: 'CANCELLED',
      gateway_status: 'canceled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: isTrial ? 'Cancelación voluntaria en período de prueba' : 'Cancelación voluntaria de membresía activa',
    })
    .eq('id', membership.id);

  // Encolar email según corresponda
  const templateId = isTrial ? 'trial_cancellation' : 'active_cancellation';
  await adminClient.from('email_outbox').insert({
    dedupe_key: `cancel-user:${membership.id}`,
    recipient_email: user.email || 'alumna@natyentrenadora.cl',
    subject: isTrial ? 'Confirmación de cancelación de tu prueba' : 'Confirmación de cancelación de tu membresía',
    template_id: templateId,
    payload: {
      studentName: user.user_metadata?.full_name || 'Alumna',
      periodEnd: membership.current_period_end ? new Date(membership.current_period_end).toLocaleDateString('es-CL') : undefined,
    },
  });

  return {
    success: true,
    isTrial,
    message: isTrial
      ? 'Tu prueba ha sido cancelada sin ningún cobro ($0 CLP cobrados en total).'
      : 'Tu suscripción ha sido cancelada. No se realizarán futuras renovaciones automáticas.',
  };
}
