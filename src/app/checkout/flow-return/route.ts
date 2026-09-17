import { NextRequest, NextResponse } from 'next/server.js';
import { createClient } from '../../../lib/supabase/server.ts';
import { createAdminClient } from '../../../lib/supabase/admin.ts';
import { getPaymentGateway } from '../../../lib/payments/index.ts';

export async function GET(req: NextRequest) {
  return handleFlowReturn(req);
}

export async function POST(req: NextRequest) {
  return handleFlowReturn(req);
}

async function handleFlowReturn(req: NextRequest) {
  const url = new URL(req.url);
  let token = url.searchParams.get('token');

  if (!token && req.method === 'POST') {
    try {
      const formData = await req.formData();
      token = (formData.get('token') as string) || null;
    } catch {
      // Form data parsing fallback
    }
  }

  if (!token) {
    return NextResponse.redirect(new URL('/checkout?error=missing_token', req.url));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login?redirectedFrom=/checkout/success', req.url));
  }

  const gateway = getPaymentGateway();
  const adminClient = createAdminClient();

  try {
    // 1. Verificar registro de tarjeta S2S en Flow
    const regStatus = await gateway.getPaymentMethodStatus(token);

    if (regStatus.status !== 1) {
      return NextResponse.redirect(new URL('/checkout?error=card_declined', req.url));
    }

    // 2. Buscar la membresía en PENDING_PAYMENT de la alumna
    const { getStudentProfileByUserId } = await import('../../../lib/supabase/profile-helpers.ts');
    const { student } = await getStudentProfileByUserId(adminClient, user.id);

    if (!student) {
      return NextResponse.redirect(new URL('/checkout?error=student_not_found', req.url));
    }

    const { data: membership } = await adminClient
      .from('memberships')
      .select('id, plan_id, price_contracted')
      .eq('student_id', student.id)
      .eq('status', 'PENDING_PAYMENT')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!membership) {
      // Si ya fue procesada previamente, ir a success directamente
      return NextResponse.redirect(new URL('/checkout/success', req.url));
    }

    // 3. Crear la suscripción oficial en Flow con 7 días de Trial
    const flowPlanId = process.env.FLOW_PLAN_ID || 'naty-mensual-25k-v1';
    const sub = await gateway.createSubscription({
      planId: flowPlanId,
      customerId: regStatus.customerId,
      trialPeriodDays: 7,
    });

    const trialEndsAt = sub.trialEndsAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 4. Activar estado TRIAL en base de datos
    await adminClient
      .from('memberships')
      .update({
        status: 'TRIAL',
        gateway: 'FLOW',
        gateway_subscription_id: sub.id,
        gateway_status: 'trial',
        trial_ends_at: trialEndsAt,
      })
      .eq('id', membership.id);

    // 5. Encolar email de confirmación en outbox
    await adminClient.from('email_outbox').insert({
      dedupe_key: `flow-trial-card:${membership.id}`,
      recipient_email: user.email,
      subject: '¡Tarjeta vinculada y 7 días de prueba activados!',
      template_id: 'flow_trial_welcome',
      payload: {
        studentName: user.user_metadata?.full_name || 'Alumna',
        trialEndsAt,
        amount: membership.price_contracted || 25000,
        cardLast4: regStatus.last4CardDigits,
      },
    });

    // 6. Redirigir a success limpiamente SIN exponer UUIDs internos
    return NextResponse.redirect(new URL('/checkout/success', req.url));
  } catch (err: any) {
    console.error('Error en flow-return handler:', err);
    return NextResponse.redirect(new URL('/checkout?error=processing_error', req.url));
  }
}
