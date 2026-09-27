import React from 'react';
import type { Metadata } from 'next';
import { AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

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
            Naty Entrenadora · Las condiciones, el precio y la modalidad de pago vigentes se mostrarán antes de confirmar la inscripción.
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
              El canal de cancelación aplicable estará informado antes de confirmar el pago y en el correo oficial de soporte.
            </p>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Prueba Segura</span>
            </div>
            <p className="text-xs text-neutral-400">
              Si una oferta incluye prueba gratuita, sus condiciones se informarán de manera visible antes de la confirmación.
            </p>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Soporte Directo</span>
            </div>
            <p className="text-xs text-neutral-400">
              Si tienes dudas o prefieres ayuda, escríbenos directamente a team@natyentrenadora.com.
            </p>
          </div>
        </div>

        {/* Detalle Normativo */}
        <div className="space-y-8 text-sm text-neutral-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Cancelación durante una Prueba Gratuita</h2>
            <p>
              Cuando una inscripción incluya una prueba gratuita, su duración, el acceso disponible y el procedimiento para cancelar estarán visibles antes de confirmar el pago. Si decides que el programa no se adapta a tus necesidades actuales, podrás usar el canal indicado en esas condiciones.
            </p>
            <p className="text-emerald-400 font-medium">
              Efecto: La confirmación de cancelación indicará de forma clara el acceso restante y cualquier efecto sobre cobros futuros.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">2. Cancelación de una Membresía Mensual</h2>
            <p>
              La modalidad de renovación, si corresponde, se informará antes de confirmar la inscripción. Podrás solicitar la cancelación conforme a ese procedimiento y a la legislación aplicable.
            </p>
            <p>
              Al cancelar una suscripción activa:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-neutral-300">
              <li>Recibirás una confirmación del estado de la solicitud.</li>
              <li>Se informará la fecha de término de acceso que corresponda a tu modalidad de pago.</li>
              <li>Se aplicarán las garantías legales imperativas correspondientes.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">3. Política de Reembolsos y Retracto</h2>
            <p>
              Las condiciones de reembolso, si corresponden, se informarán antes de confirmar una operación y se aplicarán sin perjuicio de los derechos irrenunciables de las consumidoras conforme a la legislación chilena.
            </p>
            <p>
              Ante cualquier incidencia de cobro, el equipo de soporte revisará el caso tras recibir la notificación en <strong>team@natyentrenadora.com</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">4. Procedimiento para Cancelar</h2>
            <ol className="list-decimal pl-5 space-y-2 text-neutral-300">
              <li>Revisa las instrucciones de cancelación mostradas en el checkout o en tu portal de alumna.</li>
              <li>Si el autoservicio está habilitado para tu modalidad, confirma la solicitud desde tu cuenta.</li>
              <li>Como alternativa, escribe a <strong>team@natyentrenadora.com</strong> desde el correo asociado a tu inscripción.</li>
              <li>Recibirás una confirmación por el canal correspondiente.</li>
            </ol>
            <p className="pt-2 text-neutral-400 text-xs">
              Esta política es un borrador pre-lanzamiento y debe contar con validación legal antes de su vigencia definitiva.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
