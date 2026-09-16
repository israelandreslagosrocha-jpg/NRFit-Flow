import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Cancelación y Reembolsos | Naty Entrenadora',
  description: 'Condiciones claras y transparentes de cancelación y reembolsos para la membresía de Naty Entrenadora.',
};

export default function CancelacionPage() {
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
            Este documento define la política técnica y comercial de cancelación previa a la apertura pública. Debe ser validado por asesoría legal conforme a la Ley N° 19.496 del Consumidor en Chile antes de su puesta en vigencia definitiva.
          </div>
        </div>

        {/* Encabezado */}
        <div className="space-y-3 border-b border-neutral-800 pb-6">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold tracking-wider uppercase">
            <RefreshCw className="w-4 h-4" />
            <span>Cancelación Clara y Sin Fricción</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Política de Cancelación y Reembolsos
          </h1>
          <p className="text-sm text-neutral-400">
            Naty Entrenadora · Precio oficial: $25.000 CLP/mes con 7 días de prueba iniciales ($0 hoy).
          </p>
        </div>

        {/* Resumen de Principios */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Sin Ataduras</span>
            </div>
            <p className="text-xs text-neutral-400">
              Puedes cancelar en cualquier momento de manera 100% autónoma desde tu portal de alumna.
            </p>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Prueba Segura</span>
            </div>
            <p className="text-xs text-neutral-400">
              Si cancelas dentro de los primeros 7 días de prueba gratuita, el cobro total es de $0 CLP.
            </p>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Soporte Directo</span>
            </div>
            <p className="text-xs text-neutral-400">
              Si tienes dudas o prefieres ayuda, te atendemos directamente en team@natyentrenadora.cl.
            </p>
          </div>
        </div>

        {/* Detalle Normativo */}
        <div className="space-y-8 text-sm text-neutral-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Cancelación durante la Prueba Gratuita (7 Días)</h2>
            <p>
              Durante el período de prueba de 7 días, la alumna disfruta de acceso completo a todos los beneficios de la plataforma sin costo. Si decides que el programa no se adapta a tus necesidades actuales, puedes cancelar tu suscripción antes del término del séptimo día.
            </p>
            <p className="text-emerald-400 font-medium">
              Efecto: Se cancela la autorización de cobro en Mercado Pago de forma inmediata y automática, sin ningún cargo a tu tarjeta (\$0 CLP facturados).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">2. Cancelación de la Membresía Mensual (\$25.000 CLP)</h2>
            <p>
              Una vez iniciado el período pagado, la suscripción se renueva mes a mes. Puedes cancelar la renovación automática en cualquier instante antes de la siguiente fecha de cobro.
            </p>
            <p>
              Al cancelar una suscripción activa:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-neutral-300">
              <li>Se suspenden de forma definitiva e inmediata los cargos en los ciclos siguientes.</li>
              <li>Mantienes el acceso completo a los entrenamientos y al portal hasta el último día del ciclo mensual ya pagado.</li>
              <li>No se aplican cargos por penalización o cargos de desvinculación.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">3. Política de Reembolsos y Retracto</h2>
            <p>
              Dado que se otorga un período de prueba completo de 7 días sin costo (\$0 hoy) para evaluar el servicio antes de cualquier cargo, una vez ejecutado el cobro mensual regular de \$25.000 CLP no se efectúan reembolsos proporcionales por fracciones de mes no utilizadas, conforme a los términos aceptados y a la naturaleza de entrega inmediata de contenidos digitales.
            </p>
            <p>
              En caso de eventuales cobros duplicados por incidencia técnica, el equipo de soporte gestionará el reintegro íntegro a través de Mercado Pago en un plazo máximo de 5 días hábiles tras recibir la notificación en <strong>team@natyentrenadora.cl</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">4. Procedimiento para Cancelar</h2>
            <ol className="list-decimal pl-5 space-y-2 text-neutral-300">
              <li>Inicia sesión con tu cuenta en <Link href="/auth/login" className="text-rose-400 underline">natyentrenadora.cl</Link>.</li>
              <li>Dirígete a tu menú de perfil o membresía y haz clic en <strong>“Cancelar suscripción”</strong>.</li>
              <li>Confirma la cancelación en la ventana de verificación.</li>
              <li>Recibirás un correo electrónico de confirmación con el comprobante de cancelación.</li>
            </ol>
            <p className="pt-2 text-neutral-400 text-xs">
              Alternativamente, puedes solicitar la cancelación enviando un correo a <strong>team@natyentrenadora.cl</strong> con al menos 24 horas hábiles de anticipación a tu fecha de renovación.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
