import React from 'react';
import Link from 'next/link';
import { ShieldAlert, CheckCircle, Sparkles, LogOut, Mail, ArrowRight } from 'lucide-react';
import { AccessEvaluation } from '@/lib/supabase/membership-helpers';

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
    ctaText = 'Reactivar membresía ($25.000 CLP/mes)';
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>

        {/* Title & Diagnostic */}
        <div className="text-center space-y-2">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
            Acceso Requerido · Estado: {status}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>
        </div>

        {/* Benefits Card */}
        <div className="bg-neutral-950/80 rounded-2xl p-5 border border-neutral-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800 pb-2">
            <span>Membresía Naty Entrenadora</span>
            <span className="font-semibold text-rose-400">$25.000 CLP / mes</span>
          </div>
          <ul className="space-y-2 text-xs text-neutral-300">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>7 días de prueba gratuita ($0 hoy)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Rutinas guiadas en video adaptadas a tu nivel</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Clases en vivo y videoteca completa</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Cancela en cualquier momento sin compromisos</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <Link
            href="/checkout"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold py-3.5 px-6 rounded-2xl shadow-lg transition-all text-sm group"
          >
            <span>{ctaText}</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>

          <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 px-1">
            <Link
              href="/auth/login"
              className="hover:text-neutral-300 transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cambiar de cuenta</span>
            </Link>

            <a
              href="mailto:team@natyentrenadora.cl"
              className="hover:text-neutral-300 transition-colors flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Soporte</span>
            </a>
          </div>
        </div>

        {/* User Context Footer */}
        {userEmail && (
          <div className="text-center pt-2 border-t border-neutral-800/60 text-[11px] text-neutral-500">
            Sesión iniciada como: <span className="text-neutral-400">{userEmail}</span>
            {userName && userName !== 'Alumna' ? ` (${userName})` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
