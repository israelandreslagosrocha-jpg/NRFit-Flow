"use client";

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, CheckCircle, Mail, ArrowRight } from 'lucide-react';
import { AccessEvaluation } from '@/lib/supabase/membership-helpers';
import { AuthSignOutButton } from '../auth/AuthSignOutButton';
import styles from './MembershipGate.module.css';

interface MembershipGateProps {
  evaluation: AccessEvaluation;
  userEmail?: string;
  userName?: string;
}

export function MembershipGate({ evaluation, userEmail, userName }: MembershipGateProps) {
  const { status, reason } = evaluation;

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
  } else if (status === 'EXPIRED' || reason?.includes('prueba')) {
    title = 'Tu período de prueba o suscripción ha finalizado';
    description =
      'Esperamos que hayas disfrutado tus entrenamientos. Activa tu plan mensual para mantener tu constancia.';
    ctaText = 'Reactivar membresía ($21.000 CLP/mes)';
  }

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
            <strong>$21.000 CLP / mes</strong>
          </div>
          <ul>
            <li>
              <CheckCircle size={17} aria-hidden="true" />
              <span>7 días de prueba gratuita ($0 hoy)</span>
            </li>
            <li>
              <CheckCircle size={17} aria-hidden="true" />
              <span>Rutinas guiadas de entre 10 y 40 minutos</span>
            </li>
            <li>
              <CheckCircle size={17} aria-hidden="true" />
              <span>Sesiones en vivo lunes y miércoles + 3 grabadas por semana</span>
            </li>
            <li>
              <CheckCircle size={17} aria-hidden="true" />
              <span>Cancela en cualquier momento sin compromisos</span>
            </li>
          </ul>
        </div>

        <div className={styles.actions}>
          <Link
            href="/checkout"
            className={styles.primaryAction}
          >
            <span>{ctaText}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>

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
