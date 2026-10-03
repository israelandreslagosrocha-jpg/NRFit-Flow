"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, CheckCircle, Mail, ArrowRight, CreditCard, CalendarClock, Loader2 } from 'lucide-react';
import { AccessEvaluation } from '@/lib/supabase/membership-helpers';
import { AuthSignOutButton } from '../auth/AuthSignOutButton';
import styles from './MembershipGate.module.css';
import { getCurrentMembershipOffer } from '@/lib/offers/membership-offer';
import {
  beginMembershipRenewalAction,
  getManualPaymentLinkAction,
} from '@/actions/subscription';

interface MembershipGateProps {
  evaluation: AccessEvaluation;
  userEmail?: string;
  userName?: string;
}

export function MembershipGate({ evaluation, userEmail, userName }: MembershipGateProps) {
  const { status, reason } = evaluation;
  const offer = getCurrentMembershipOffer();
  const membership = evaluation.membership;
  const contractedPrice = Number(membership?.price_contracted) || offer.monthlyPrice;
  const isFinishedFreeTrial = status === 'EXPIRED' && membership?.status === 'TRIAL';
  const isManualPaymentPending = membership?.status === 'PENDING_PAYMENT'
    && membership?.renewal_mode === 'MANUAL_RENEWAL';
  const [renewalLoading, setRenewalLoading] = useState<'AUTO_CHARGE' | 'MANUAL_RENEWAL' | 'PAYMENT_LINK' | null>(null);
  const [renewalMessage, setRenewalMessage] = useState<string | null>(null);
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  let title = 'Activa tu membresía para comenzar';
  let description =
    'Para acceder a la plataforma de entrenamiento, clases y seguimiento, necesitas una membresía activa.';
  let ctaText = 'Comenzar 7 días de prueba gratis';

  if (status === 'PAUSED') {
    title = 'Tu membresía se encuentra en pausa';
    description =
      'Pausaste tu suscripción. Puedes reactivarla en cualquier momento para retomar tu rutina y clases.';
    ctaText = 'Reactivar mi membresía';
  } else if (status === 'PAST_DUE' || status === 'PENDING_PAYMENT') {
    title = 'Pago pendiente en tu suscripción';
    description =
      'Hubo un problema al procesar el cobro de tu ciclo. Regulariza tu medio de pago para reanudar el acceso inmediato.';
    ctaText = 'Regularizar mi suscripción';
  } else if (isFinishedFreeTrial) {
    title = '¿Quieres continuar con Team Naty?';
    description =
      'Tu prueba de 7 días terminó. Si deseas seguir, elige ahora cómo prefieres pagar cada mes. No se aplicará ningún cargo sin tu elección.';
    ctaText = '';
  } else if (isManualPaymentPending) {
    title = 'Tu pago mensual está pendiente';
    description =
      'Elegiste recibir un enlace de pago mensual. Puedes abrir el enlace seguro de Flow desde esta misma pantalla.';
    ctaText = '';
  } else if (status === 'EXPIRED' || reason?.includes('prueba')) {
    title = 'Tu período de prueba o suscripción ha finalizado';
    description =
      'Esperamos que hayas disfrutado tus entrenamientos. Activa tu plan mensual para mantener tu constancia.';
    ctaText = `Reactivar membresía ($${contractedPrice.toLocaleString('es-CL')} CLP/mes)`;
  }

  const handleRenewalChoice = async (choice: 'AUTO_CHARGE' | 'MANUAL_RENEWAL') => {
    setRenewalLoading(choice);
    setRenewalError(null);
    setRenewalMessage(null);

    const result = await beginMembershipRenewalAction(choice);
    if (!result.success || 'error' in result) {
      setRenewalError(('error' in result && result.error) || 'No fue posible iniciar esta modalidad.');
      setRenewalLoading(null);
      return;
    }

    if (result.mode === 'AUTO_CHARGE' && 'redirectUrl' in result && result.redirectUrl) {
      window.location.assign(result.redirectUrl);
      return;
    }

    if (result.mode === 'MANUAL_RENEWAL') {
      setPaymentUrl(result.paymentUrl || null);
      setRenewalMessage(result.message || 'Tu solicitud fue creada correctamente.');
    }
    setRenewalLoading(null);
  };

  const handleGetPaymentLink = async () => {
    setRenewalLoading('PAYMENT_LINK');
    setRenewalError(null);
    setRenewalMessage(null);

    const result = await getManualPaymentLinkAction();
    if (!result.success || 'error' in result) {
      setRenewalError(('error' in result && result.error) || 'No fue posible obtener el enlace de pago.');
    } else {
      setPaymentUrl(result.paymentUrl || null);
      setRenewalMessage(result.message || null);
    }
    setRenewalLoading(null);
  };

  return (
    <main className={styles.gate}>
      <section className={styles.card} aria-labelledby="membership-gate-title">
        <div className={styles.iconWrap} aria-hidden="true">
          <ShieldAlert size={28} strokeWidth={2.2} />
        </div>

        <header className={styles.header}>
          <span className={styles.status}>
            Acceso a entrenamiento · {status === 'NO_MEMBERSHIP' ? 'sin membresía activa' : status}
          </span>
          <h1 id="membership-gate-title">{title}</h1>
          <p>{description}</p>
        </header>

        <div className={styles.benefits}>
          <div className={styles.planRow}>
            <span>Membresía Naty Entrenadora</span>
            <strong>${contractedPrice.toLocaleString('es-CL')} CLP / mes</strong>
          </div>
          <ul>
            {!isFinishedFreeTrial && !isManualPaymentPending && (
              <li>
                <CheckCircle size={17} aria-hidden="true" />
                <span>7 días de prueba gratuita ($0 hoy)</span>
              </li>
            )}
            <li>
              <CheckCircle size={17} aria-hidden="true" />
              <span>Rutinas guiadas de entre 10 y 40 minutos</span>
            </li>
            <li>
              <CheckCircle size={17} aria-hidden="true" />
              <span>Dos sesiones en vivo semanales + biblioteca flexible a tu ritmo</span>
            </li>
            <li>
              <CheckCircle size={17} aria-hidden="true" />
              <span>Cancela en cualquier momento sin compromisos</span>
            </li>
          </ul>
        </div>

        <div className={styles.actions}>
          {isFinishedFreeTrial && (
            <div className={styles.renewalChoices}>
              <button
                type="button"
                className={styles.renewalChoice}
                onClick={() => handleRenewalChoice('MANUAL_RENEWAL')}
                disabled={renewalLoading !== null}
              >
                <CalendarClock size={22} aria-hidden="true" />
                <span>
                  <strong>Recordatorio y enlace mensual</strong>
                  <small>Flow te mostrará un enlace seguro cada mes. Tú decides cuándo pagarlo.</small>
                </span>
                {renewalLoading === 'MANUAL_RENEWAL' ? <Loader2 className={styles.spinner} size={19} /> : <ArrowRight size={19} />}
              </button>

              <button
                type="button"
                className={`${styles.renewalChoice} ${styles.autoChoice}`}
                onClick={() => handleRenewalChoice('AUTO_CHARGE')}
                disabled={renewalLoading !== null}
              >
                <CreditCard size={22} aria-hidden="true" />
                <span>
                  <strong>Pago automático mensual</strong>
                  <small>Registrarás tu tarjeta directamente en Flow y autorizarás los cargos mensuales.</small>
                </span>
                {renewalLoading === 'AUTO_CHARGE' ? <Loader2 className={styles.spinner} size={19} /> : <ArrowRight size={19} />}
              </button>
            </div>
          )}

          {isManualPaymentPending && !paymentUrl && (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={handleGetPaymentLink}
              disabled={renewalLoading !== null}
            >
              {renewalLoading === 'PAYMENT_LINK' ? <Loader2 className={styles.spinner} size={18} /> : <CreditCard size={18} />}
              <span>VER MI ENLACE DE PAGO</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          )}

          {paymentUrl && (
            <a
              href={paymentUrl}
              className={styles.primaryAction}
              target="_blank"
              rel="noreferrer"
            >
              <CreditCard size={18} aria-hidden="true" />
              <span>IR A PAGAR CON FLOW</span>
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          )}

          {!isFinishedFreeTrial && !isManualPaymentPending && ctaText && (
            <Link href="/checkout" className={styles.primaryAction}>
              <span>{ctaText}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          )}

          {renewalError && <p className={styles.renewalError} role="alert">{renewalError}</p>}
          {renewalMessage && <p className={styles.renewalMessage} role="status">{renewalMessage}</p>}

          <div className={styles.secondaryActions}>
            <AuthSignOutButton className={styles.signOut} />

            <a
              href="mailto:team@natyentrenadora.com"
              className={styles.support}
            >
              <Mail size={16} aria-hidden="true" />
              <span>Soporte</span>
            </a>
          </div>
        </div>

        {userEmail && (
          <footer className={styles.session}>
            Sesión actual: <span>{userEmail}</span>
            {userName && userName !== 'Alumna' ? ` (${userName})` : ''}
          </footer>
        )}
      </section>
    </main>
  );
}
