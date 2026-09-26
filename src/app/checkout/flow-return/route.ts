import { NextRequest, NextResponse } from 'next/server.js';
import { createClient } from '../../../lib/supabase/server.ts';
import { createAdminClient } from '../../../lib/supabase/admin.ts';
import { getPaymentGateway } from '../../../lib/payments/index.ts';
import { checkRateLimit, resolveRateLimitKey } from '../../../lib/rate-limit/index.ts';
import { RATE_LIMIT_CONFIG } from '../../../lib/rate-limit/config.ts';
import { createRateLimitExceededResponse } from '../../../lib/rate-limit/headers.ts';
import { logger } from '../../../lib/logger.ts';

export async function GET(req: NextRequest) {
  return handleFlowReturn(req);
}

export async function POST(req: NextRequest) {
  return handleFlowReturn(req);
}

/**
 * FASE M-09.3E: RETORNO DE NAVEGADOR FLOW CHILE (ANTI-ABUSO Y NO-AUTORITATIVO)
 * 
 * Regla Fundamental:
 * El retorno del navegador jamás es la autoridad financiera final.
 * La autoridad financiera reside exclusivamente en el callback S2S con token,
 * la verificación de pasarela y la sincronización del reconciliador.
 * 
 * Rate Limiting:
 * Suave y exclusivamente anti-abuso para prevenir ataques de denegación de servicio.
 */
async function handleFlowReturn(req: NextRequest) {
  // 1. Rate limiting suave anti-abuso
  const clientKey = resolveRateLimitKey(req.headers);
  const returnConfig = RATE_LIMIT_CONFIG.checkoutReturn;
  const rateLimitResult = await checkRateLimit({
    namespace: 'checkout-return',
    key: clientKey,
    limit: returnConfig.limit,
    windowSeconds: returnConfig.windowSeconds,
    policyId: returnConfig.policyId,
  });

  if (rateLimitResult.status === 'LIMITED') {
    logger.warn('Checkout flow-return rate limit exceeded', { key_hash: clientKey });
    return createRateLimitExceededResponse(
      rateLimitResult,
      'Demasiadas solicitudes. Por favor aguarda un momento.',
      { policyId: returnConfig.policyId, windowSeconds: returnConfig.windowSeconds }
    );
  }

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
    // 2. Verificar registro de tarjeta S2S en Flow (No confía en el navegador)
    const regStatus = await gateway.getPaymentMethodStatus(token);

    if (regStatus.status !== 1) {
      return NextResponse.redirect(new URL('/checkout?error=card_declined', req.url));
    }

    // 3. Buscar la membresía en PENDING_PAYMENT de la alumna
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
      // Si ya fue procesada previamente por el callback oficial, ir a success directamente
      return NextResponse.redirect(new URL('/checkout/success', req.url));
    }

    // 4. Crear la suscripción oficial en Flow con 7 días de Trial
    const flowPlanId = process.env.FLOW_PLAN_ID || 'naty-mensual-25k-v1';
    const sub = await gateway.createSubscription({
      planId: flowPlanId,
      customerId: regStatus.customerId,
      trialPeriodDays: 7,
    });

    const trialEndsAt = sub.trialEndsAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 5. Activar estado TRIAL en base de datos
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

    // 6. Encolar email de confirmación en outbox
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

    // 7. Redirigir a success limpiamente SIN exponer UUIDs internos
    return NextResponse.redirect(new URL('/checkout/success', req.url));
  } catch (err: any) {
    logger.error('Error en flow-return handler:', {}, err);
    return NextResponse.redirect(new URL('/checkout?error=processing_error', req.url));
  }
}
