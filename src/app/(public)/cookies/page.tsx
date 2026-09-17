import React from 'react';
import type { Metadata } from 'next';
import { AlertTriangle, Cookie } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Cookies | Naty Entrenadora',
  description: 'Información sobre el uso de cookies técnicas y de sesión en la plataforma Naty Entrenadora.',
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Banner de descargo de responsabilidad */}
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 sm:p-6 flex items-start gap-4 text-amber-200">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm leading-relaxed">
            <span className="font-semibold block text-amber-300 uppercase tracking-wide mb-1">
              Borrador Preliminar para Revisión Legal Profesional
            </span>
            Este documento describe la arquitectura técnica del uso de cookies para el portal. Requiere revisión legal profesional previa al lanzamiento comercial.
          </div>
        </div>

        {/* Encabezado */}
        <div className="space-y-3 border-b border-neutral-800 pb-6">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold tracking-wider uppercase">
            <Cookie className="w-4 h-4" />
            <span>Transparencia Técnica</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Política de Cookies
          </h1>
          <p className="text-sm text-neutral-400">
            Naty Entrenadora (natyentrenadora.com) · Soporte: team@natyentrenadora.com
          </p>
        </div>

        {/* Contenido */}
        <div className="space-y-8 text-sm text-neutral-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. ¿Qué son las Cookies?</h2>
            <p>
              Una cookie es un pequeño archivo de texto que un sitio web almacena en el navegador del usuario al visitarlo. Permite al sitio recordar información sobre la visita para facilitar la navegación y asegurar funciones críticas como el inicio de sesión.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">2. Tipos de Cookies Utilizadas</h2>
            <p>
              La plataforma de Naty Entrenadora emplea una política restrictiva y transparente en el uso de cookies:
            </p>
            <div className="space-y-4 pt-2">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                <h3 className="font-semibold text-white text-base">A. Cookies Técnicas y Estrictamente Necesarias</h3>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                  Son indispensables para el funcionamiento del portal. Incluyen los tokens de sesión HTTP-only seguros gestionados por Supabase Auth para autenticar a la alumna, verificar roles y proteger las rutas privadas. No pueden desactivarse en los sistemas del sitio.
                </p>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                <h3 className="font-semibold text-white text-base">B. Cookies de Rendimiento y Preferencias</h3>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                  Permiten recordar parámetros de interfaz y preferencias del reproductor de video o rutinas durante la navegación para una experiencia fluida.
                </p>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                <h3 className="font-semibold text-white text-base">C. Cookies de Terceros</h3>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                  Durante el proceso de pago seguro, Mercado Pago puede utilizar cookies técnicas propias para la prevención de fraudes y validación de seguridad de la transacción según sus respectivas políticas de privacidad.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">3. Gestión y Desactivación de Cookies</h2>
            <p>
              La usuaria puede configurar su navegador para bloquear o ser notificada sobre la instalación de cookies. No obstante, si se bloquean las cookies técnicas de sesión, el acceso al portal privado de alumna y a los entrenamientos no podrá funcionar adecuadamente.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
