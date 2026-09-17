import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, AlertCircle, ArrowRight, Dumbbell } from 'lucide-react';
import { createClient } from '../../../lib/supabase/server';
import { getStudentProfileByUserId } from '../../../lib/supabase/profile-helpers';
import '../checkout.css';

export default async function CheckoutSuccessPage() {
  const supabase = await createClient();

  // 1. Autorización server-side estricta: La sesión del usuario autenticado es la única autoridad
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectedFrom=/checkout/success');
  }

  // 2. Consulta en base de datos sin confiar en ningún parámetro de URL
  const { student } = await getStudentProfileByUserId(supabase, user.id);

  let membership: any = null;
  if (student) {
    const { data } = await supabase
      .from('memberships')
      .select('id, status, trial_ends_at, current_period_end, price_contracted, auto_renew')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    membership = data;
  }

  const isTrial = membership?.status === 'TRIAL';
  const isActive = membership?.status === 'ACTIVE';
  const isPending = membership?.status === 'PENDING_PAYMENT';

  const trialEndFormatted = membership?.trial_ends_at
    ? new Date(membership.trial_ends_at).toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '7 días corridos';

  const periodEndFormatted = membership?.current_period_end
    ? new Date(membership.current_period_end).toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '30 días';

  return (
    <div className="checkout-page-container">
      <div className="checkout-card" style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: isTrial || isActive ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
            color: isTrial || isActive ? '#34d399' : '#fbbf24',
            marginBottom: '20px',
          }}
        >
          {isTrial || isActive ? <CheckCircle2 size={36} /> : <AlertCircle size={36} />}
        </div>

        <h1 className="checkout-title">
          {isTrial || isActive ? '¡Bienvenida al Team Naty!' : 'Suscripción en Verificación'}
        </h1>

        <p className="checkout-subtitle" style={{ fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          {isTrial && (
            <>
              Tu medio de pago ha sido verificado por Flow / Webpay y tu período de prueba de{' '}
              <strong>7 días gratuitos ($0 CLP)</strong> ha comenzado.
            </>
          )}
          {isActive && (
            <>
              Tu pago ha sido procesado exitosamente por Flow y tu membresía se encuentra activa.
            </>
          )}
          {isPending && (
            <>
              Tu solicitud está siendo procesada por la pasarela de pagos. Tu acceso se activará en cuanto se confirme la transacción.
            </>
          )}
          {!membership && (
            <>
              No se encontró una membresía registrada. Si acabas de suscribirte, por favor espera unos segundos o contacta a soporte.
            </>
          )}
        </p>

        {membership && (
          <div className="checkout-summary-box" style={{ textAlign: 'left', marginBottom: '28px' }}>
            <div className="summary-row">
              <span className="summary-label">Estado de la membresía</span>
              <span className="summary-value highlight">
                {isTrial ? 'Prueba Gratuita Activa' : isActive ? 'Membresía Activa' : 'Pendiente de Pago'}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Cobrado hoy</span>
              <span className="summary-value">{isTrial ? '$0 CLP' : `$${(membership.price_contracted || 25000).toLocaleString('es-CL')} CLP`}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Vigencia del ciclo</span>
              <span className="summary-value">{isTrial ? `Hasta el ${trialEndFormatted}` : `Hasta el ${periodEndFormatted}`}</span>
            </div>
          </div>
        )}

        <Link
          href="/para-ti"
          className="checkout-btn"
          style={{ textDecoration: 'none' }}
        >
          <Dumbbell size={18} />
          <span>IR A MI PORTAL DE ALUMNA</span>
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
