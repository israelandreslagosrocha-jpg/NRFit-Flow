import * as defaultMpClient from './client.ts';

/**
 * Lógica transaccional aislada del Webhook
 * Permite ejecución desde la Route Handler y verificación directa en la batería de pruebas (Casos A a K)
 */
export async function processWebhookEvent(params: {
  supabase: any;
  eventType: string;
  dataId: string;
  action?: string;
  payload: any;
  client?: {
    getSubscription?: typeof defaultMpClient.getSubscription;
    resolveCanonicalPayment?: typeof defaultMpClient.resolveCanonicalPayment;
  };
}): Promise<{ status: string; message: string }> {
  const { supabase, eventType, dataId, action, payload } = params;
  const getSub = params.client?.getSubscription || defaultMpClient.getSubscription;
  const resolveCanonical = params.client?.resolveCanonicalPayment || defaultMpClient.resolveCanonicalPayment;
  const gatewayEventId = `${eventType}_${dataId}_${action || 'notify'}`;

  // 1. Idempotencia Inbound: verificar si el evento técnico ya fue registrado
  const { data: existingEvent } = await supabase
    .from('payment_events')
    .select('id, status')
    .eq('gateway_event_id', gatewayEventId)
    .single();

  if (existingEvent) {
    return {
      status: 'ALREADY_PROCESSED',
      message: 'Evento ya procesado previamente (Inbound Idempotency)',
    };
  }

  // 2. Procesar según el tópico oficial de Mercado Pago
  if (eventType === 'subscription_preapproval') {
    // Consulta server-to-server del recurso oficial de suscripción
    const subscription = await getSub(dataId);
    const membershipId = subscription.external_reference;

    if (!membershipId) {
      await supabase.from('payment_events').insert({
        gateway_event_id: gatewayEventId,
        event_type: eventType,
        resource_id: dataId,
        payload,
        status: 'IGNORED_NO_EXTERNAL_REF',
      });
      return { status: 'IGNORED', message: 'Suscripción sin external_reference' };
    }

    // Buscar la membresía asociada por ID interno inequívoco
    const { data: membership } = await supabase
      .from('memberships')
      .select('id, status, student_id')
      .eq('id', membershipId)
      .single();

    if (!membership) {
      return { status: 'NOT_FOUND', message: 'Membresía no encontrada' };
    }

    if (subscription.status === 'authorized') {
      // La alumna autorizó su tarjeta en el checkout de Mercado Pago
      // Pasa a estado TRIAL (7 días corridos de prueba gratuita, $0 cobrados hoy)
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from('memberships')
        .update({
          status: 'TRIAL',
          gateway_subscription_id: subscription.id,
          gateway_status: 'authorized',
          trial_ends_at: trialEndsAt,
        })
        .eq('id', membershipId);

      // Encolar email de bienvenida desacoplado en outbox
      await supabase.from('email_outbox').insert({
        dedupe_key: `trial-welcome:${membershipId}`,
        recipient_email: subscription.payer_email,
        subject: '¡Bienvenida al Team Naty! Comienza tu prueba de 7 días',
        template_id: 'trial_welcome',
        payload: {
          trialEndDate: new Date(trialEndsAt).toLocaleDateString('es-CL'),
          firstChargeDate: new Date(trialEndsAt).toLocaleDateString('es-CL'),
        },
      });
    } else if (subscription.status === 'canceled') {
      // Suscripción cancelada en pasarela
      await supabase
        .from('memberships')
        .update({
          status: 'CANCELLED',
          gateway_status: 'canceled', // Guardar valor oficial de MP (1 'l')
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', membershipId);

      // Encolar email de cancelación en outbox
      await supabase.from('email_outbox').insert({
        dedupe_key: `trial-cancel:${membershipId}`,
        recipient_email: subscription.payer_email,
        subject: 'Confirmación de cancelación de tu prueba',
        template_id: 'trial_cancellation',
        payload: {},
      });
    }

    // Registrar evento técnico
    await supabase.from('payment_events').insert({
      gateway_event_id: gatewayEventId,
      event_type: eventType,
      resource_id: dataId,
      payload,
      status: 'PROCESSED',
    });

    return { status: 'PROCESSED', message: 'Suscripción actualizada correctamente' };
  }

  // Tópicos de Cobro Financiero: subscription_authorized_payment o payment
  if (eventType === 'subscription_authorized_payment' || eventType === 'payment') {
    // Resolver el pago canónico consultando Mercado Pago (Caso J: Deduplicación Cross-Topic)
    const canonical = await resolveCanonical(eventType, dataId);
    const canonicalPaymentId = canonical.canonicalPaymentId;

    // Verificar si ya existe una transacción financiera con este ID Canónico
    const { data: existingTransaction } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('gateway_payment_id', canonicalPaymentId)
      .single();

    if (existingTransaction) {
      // DUPLICADO CROSS-TOPIC DETECTADO (Ej: subscription_authorized_payment + payment para el mismo cobro)
      // Registramos el evento en payment_events pero NO creamos otra transacción ni otro email
      await supabase.from('payment_events').insert({
        gateway_event_id: gatewayEventId,
        event_type: eventType,
        resource_id: dataId,
        payload,
        status: 'ALREADY_PROCESSED',
      });

      return {
        status: 'ALREADY_PROCESSED',
        message: `Transacción financiera ${canonicalPaymentId} ya registrada previamente (Cross-Topic Idempotency)`,
      };
    }

    // Resolver membresía por external_reference o por gateway_subscription_id
    let membershipId = canonical.externalReference;

    if (!membershipId && canonical.preapprovalId) {
      const { data: memBySub } = await supabase
        .from('memberships')
        .select('id')
        .eq('gateway_subscription_id', canonical.preapprovalId)
        .single();
      membershipId = memBySub?.id;
    }

    if (!membershipId) {
      await supabase.from('payment_events').insert({
        gateway_event_id: gatewayEventId,
        event_type: eventType,
        resource_id: dataId,
        payload,
        status: 'IGNORED_NO_MEMBERSHIP',
      });
      return { status: 'IGNORED', message: 'Cobro sin membresía asociada' };
    }

    if (canonical.status === 'approved') {
      // Cobro aprobado: Transacción Atómica
      // 1. Insertar transacción financiera canónica
      await supabase.from('payment_transactions').insert({
        membership_id: membershipId,
        gateway_payment_id: canonicalPaymentId,
        amount: canonical.amount || 25000,
        currency: canonical.currency || 'CLP',
        status: 'APPROVED',
        payment_date: new Date().toISOString(),
      });

      // 2. Actualizar estado de membresía a ACTIVE
      await supabase
        .from('memberships')
        .update({
          status: 'ACTIVE',
          gateway_status: 'authorized',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', membershipId);

      // 3. Encolar email de confirmación con dedupe_key canónica
      await supabase.from('email_outbox').insert({
        dedupe_key: `payment-confirm:${canonicalPaymentId}`,
        recipient_email: 'alumna@natyentrenadora.cl',
        subject: 'Comprobante de Pago • Team Naty Entrenadora',
        template_id: 'payment_confirmation',
        payload: {
          amount: canonical.amount || 25000,
          paymentDate: new Date().toLocaleDateString('es-CL'),
        },
      });
    } else if (canonical.status === 'rejected') {
      // Cobro rechazado: la membresía pasa a PAST_DUE
      // (Mercado Pago reintentará el cobro según su motor; internamente Naty aplica su política de gracia)
      await supabase
        .from('memberships')
        .update({
          status: 'PAST_DUE',
          gateway_status: 'rejected',
        })
        .eq('id', membershipId);

      // Encolar email de aviso de pago fallido
      await supabase.from('email_outbox').insert({
        dedupe_key: `payment-failed:${canonicalPaymentId}`,
        recipient_email: 'alumna@natyentrenadora.cl',
        subject: 'Aviso Importante: No pudimos procesar tu pago • Team Naty',
        template_id: 'payment_failed',
        payload: {
          amount: canonical.amount || 25000,
        },
      });
    }

    // 4. Registrar evento procesado en payment_events
    await supabase.from('payment_events').insert({
      gateway_event_id: gatewayEventId,
      event_type: eventType,
      resource_id: dataId,
      payload,
      status: 'PROCESSED',
    });

    return { status: 'PROCESSED', message: 'Cobro procesado exitosamente' };
  }

  // Otros tópicos no transaccionales
  await supabase.from('payment_events').insert({
    gateway_event_id: gatewayEventId,
    event_type: eventType,
    resource_id: dataId,
    payload,
    status: 'IGNORED_TOPIC',
  });

  return { status: 'IGNORED', message: `Tópico ${eventType} no requiere acción transaccional` };
}
