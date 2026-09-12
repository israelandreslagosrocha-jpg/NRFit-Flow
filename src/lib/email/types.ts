export type EmailTemplateId = 
  | 'trial_welcome'
  | 'payment_confirmation'
  | 'payment_failed'
  | 'trial_cancellation'
  | 'active_cancellation';

export interface EmailOutboxRecord {
  id: string;
  dedupe_key: string;
  recipient_email: string;
  subject: string;
  template_id: EmailTemplateId;
  payload: Record<string, any>;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  max_attempts: number;
  last_error?: string | null;
  created_at: string;
  processed_at?: string | null;
}

export interface EmailTemplateContent {
  subject: string;
  html: string;
  text: string;
}

export function renderEmailTemplate(
  templateId: EmailTemplateId,
  payload: Record<string, any>
): EmailTemplateContent {
  const brandName = 'Team Naty Entrenadora';
  const supportEmail = 'team@natyentrenadora.cl';

  switch (templateId) {
    case 'trial_welcome':
      return {
        subject: `¡Bienvenida a ${brandName}! Tus 7 días de prueba han comenzado`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <h1 style="color: #0f172a;">¡Hola, ${payload.studentName || 'Alumna'}!</h1>
            <p>Tu prueba de 7 días corridos ya está activa. Hoy se cobraron <strong>$0 CLP</strong>.</p>
            <p><strong>Detalle de tu suscripción:</strong></p>
            <ul>
              <li><strong>Plan:</strong> Membresía Mensual Team Naty</li>
              <li><strong>Prueba gratuita:</strong> 7 días corridos (hasta el ${payload.trialEndDate || 'día 7'})</li>
              <li><strong>Primer cobro:</strong> ${payload.firstChargeDate || 'en 7 días'} por $25.000 CLP</li>
            </ul>
            <p>Recuerda que puedes cancelar en 1 clic antes de la fecha del primer cobro desde tu perfil si no deseas continuar, evitando cualquier cobro futuro.</p>
            <p>¡Disfruta tus entrenamientos en vivo y la videoteca on-demand!</p>
            <p style="color: #64748b; font-size: 13px;">Equipo Naty Entrenadora • ${supportEmail}</p>
          </div>
        `,
        text: `¡Hola, ${payload.studentName || 'Alumna'}! Tu prueba de 7 días ya está activa ($0 CLP hoy). Tu primer cobro de $25.000 CLP será el ${payload.firstChargeDate || 'en 7 días'}. Puedes cancelar en 1 clic antes de esa fecha.`,
      };

    case 'payment_confirmation':
      return {
        subject: `Comprobante de Pago • ${brandName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <h1 style="color: #0f172a;">Pago Confirmado</h1>
            <p>Hola, ${payload.studentName || 'Alumna'}. Hemos recibido correctamente tu pago de membresía.</p>
            <ul>
              <li><strong>Monto pagado:</strong> $${payload.amount || '25.000'} CLP</li>
              <li><strong>Fecha:</strong> ${payload.paymentDate || 'Hoy'}</li>
              <li><strong>Próxima renovación:</strong> ${payload.nextBillingDate || 'Próximo mes'}</li>
            </ul>
            <p>Tu acceso completo al portal sigue activo sin interrupciones.</p>
            <p style="color: #64748b; font-size: 13px;">Equipo Naty Entrenadora • ${supportEmail}</p>
          </div>
        `,
        text: `Hola, ${payload.studentName || 'Alumna'}. Pago de $${payload.amount || '25.000'} CLP confirmado. Tu acceso continúa activo.`,
      };

    case 'payment_failed':
      return {
        subject: `Aviso Importante: No pudimos procesar tu pago • ${brandName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <h1 style="color: #dc2626;">Problema al renovar tu membresía</h1>
            <p>Hola, ${payload.studentName || 'Alumna'}. Mercado Pago no pudo procesar el cobro recurrente de tu membresía por $25.000 CLP.</p>
            <p>Por favor revisa el estado o los fondos de tu tarjeta para mantener tu acceso activo.</p>
            <p style="color: #64748b; font-size: 13px;">Equipo Naty Entrenadora • ${supportEmail}</p>
          </div>
        `,
        text: `Hola, ${payload.studentName || 'Alumna'}. No pudimos procesar el cobro de tu membresía. Por favor revisa tu tarjeta para mantener tu acceso.`,
      };

    case 'trial_cancellation':
      return {
        subject: `Confirmación de cancelación de prueba • ${brandName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <h1 style="color: #0f172a;">Prueba Cancelada</h1>
            <p>Hola, ${payload.studentName || 'Alumna'}. Tu prueba gratuita de 7 días ha sido cancelada.</p>
            <p><strong>Confirmación financiera:</strong> Al cancelar durante el período de prueba, no se realizará ningún cobro posterior ($0 CLP cobrados en total).</p>
            <p>Esperamos volver a verte pronto en el Team.</p>
            <p style="color: #64748b; font-size: 13px;">Equipo Naty Entrenadora • ${supportEmail}</p>
          </div>
        `,
        text: `Hola, ${payload.studentName || 'Alumna'}. Tu prueba ha sido cancelada sin cobro ($0 CLP cobrados en total).`,
      };

    case 'active_cancellation':
      return {
        subject: `Confirmación de cancelación de suscripción • ${brandName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <h1 style="color: #0f172a;">Suscripción Cancelada</h1>
            <p>Hola, ${payload.studentName || 'Alumna'}. Hemos procesado la cancelación de tu suscripción recurrente para evitar futuras renovaciones automáticas.</p>
            <p>Tu acceso al portal continuará vigente hasta el final del ciclo pagado actual (${payload.periodEnd || 'fecha de término'}).</p>
            <p style="color: #64748b; font-size: 13px;">Equipo Naty Entrenadora • ${supportEmail}</p>
          </div>
        `,
        text: `Hola, ${payload.studentName || 'Alumna'}. Tu suscripción fue cancelada para evitar futuras renovaciones. Mantienes acceso hasta el término de tu período actual.`,
      };
  }
}
