import React from 'react';
import type { Metadata } from 'next';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Términos del Servicio | Naty Entrenadora',
  description: 'Términos y condiciones del servicio de entrenamiento online continuo Naty Entrenadora.',
};

export default function TerminosPage() {
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
            Este texto es un modelo técnico preliminar para pre-lanzamiento y no constituye asesoría legal definitiva ni certificación de cumplimiento normativo. Debe ser validado formalmente por un abogado habilitado en la República de Chile antes de la apertura pública masiva.
          </div>
        </div>

        {/* Encabezado */}
        <div className="space-y-3 border-b border-neutral-800 pb-6">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold tracking-wider uppercase">
            <ShieldCheck className="w-4 h-4" />
            <span>Condiciones Contractuales</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Términos del Servicio
          </h1>
          <p className="text-sm text-neutral-400">
            Última actualización preliminar: Septiembre 2026 · Naty Entrenadora (www.natyentrenadora.cl)
          </p>
        </div>

        {/* Contenido Legal Estructurado */}
        <div className="space-y-8 text-sm text-neutral-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Identificación y Alcance del Servicio</h2>
            <p>
              El presente contrato regula los términos y condiciones de uso de la plataforma digital disponible en <strong>www.natyentrenadora.cl</strong>, operada por Natalia Riquelme y su equipo técnico (en adelante, “Naty Entrenadora”).
            </p>
            <p>
              Naty Entrenadora ofrece un servicio de entrenamiento físico 100% online continuo para mujeres, consistente en acceso a rutinas guiadas, clases en vivo, material audiovisual formativo y seguimiento general de hábitos saludables.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">2. Naturaleza del Servicio y Exención Médica</h2>
            <p>
              El contenido, planes y entrenamientos puestos a disposición en la plataforma tienen fines exclusivamente educativos, recreativos y de acondicionamiento físico general. <strong>Naty Entrenadora no presta servicios médicos, diagnósticos, kinesiológicos ni tratamientos terapéuticos.</strong>
            </p>
            <p>
              Toda usuaria debe consultar con un médico o profesional de la salud antes de comenzar cualquier programa de ejercicios, especialmente en caso de embarazo, post-parto, antecedentes cardiovasculares, lesiones musculoesqueléticas o condiciones crónicas. La práctica de los ejercicios se realiza bajo la exclusiva responsabilidad de la usuaria.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">3. Membresía, Período de Prueba y Cobros Recurrentes</h2>
            <p>
              <strong>Prueba Gratuita de 7 Días:</strong> Toda nueva alumna tiene derecho a un período de prueba de 7 días continuos sin costo (\$0 CLP hoy). Al registrarse, se autoriza la suscripción recurrente a través de la pasarela autorizada (Mercado Pago Subscriptions Chile).
            </p>
            <p>
              <strong>Membresía Mensual Oficial:</strong> Concluidos los 7 días de prueba sin que medie cancelación previa, la membresía se renovará automáticamente de forma mensual con un valor oficial de <strong>\$25.000 CLP</strong> (veinticinco mil pesos chilenos) por cada período mensual de 30 días.
            </p>
            <p>
              <strong>Idempotencia y Facturación:</strong> Todos los cobros se procesan de forma electrónica y segura mediante Mercado Pago. No se almacenan datos sensibles de tarjetas ni números de cuenta en los servidores de Naty Entrenadora.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">4. Cancelación y No Compromiso</h2>
            <p>
              La alumna puede cancelar su suscripción en cualquier momento y de forma autónoma desde su perfil en la plataforma o mediante comunicación escrita a <strong>team@natyentrenadora.cl</strong>.
            </p>
            <p>
              La cancelación detiene futuros cobros automáticos de manera inmediata. Si la cancelación se produce durante los 7 días de prueba, el cobro será de \$0 CLP. Si se produce durante un período activo ya facturado, el acceso se mantendrá hasta el término del ciclo en curso sin reembolsos proporcionales, salvo las garantías legales imperativas aplicables.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">5. Propiedad Intelectual</h2>
            <p>
              Todo el material audiovisual, planes, metodologías, rutinas, textos, marcas, logotipos y software presentes en la plataforma son propiedad exclusiva de Naty Entrenadora y están protegidos por las leyes de propiedad intelectual de la República de Chile y tratados internacionales. Queda terminantemente prohibida su copia, distribución, reproducción, venta o retransmisión sin autorización previa por escrito.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">6. Legislación Aplicable y Jurisdicción</h2>
            <p>
              Estos términos se rigen por las leyes de la República de Chile, en particular la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores. Cualquier controversia será sometida a los tribunales ordinarios de justicia competentes en la ciudad de Santiago de Chile.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
