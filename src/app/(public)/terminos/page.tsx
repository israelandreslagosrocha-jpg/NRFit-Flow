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
            Última actualización preliminar: Septiembre 2026 · Naty Entrenadora (natyentrenadora.com)
          </p>
        </div>

        {/* Contenido Legal Estructurado */}
        <div className="space-y-8 text-sm text-neutral-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Identificación y Alcance del Servicio</h2>
            <p>
              El presente contrato regula los términos y condiciones de uso de la plataforma digital disponible en <strong>natyentrenadora.com</strong>, operada por Natalia Riquelme y su equipo técnico (en adelante, “Naty Entrenadora”).
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
            <h2 className="text-xl font-bold text-white">3. Membresía, Período de Prueba y Pagos</h2>
            <p>
              <strong>Oferta y período de prueba:</strong> Si una inscripción incluye una prueba gratuita de 7 días, su duración, precio posterior y requisitos se mostrarán de forma visible antes de la confirmación. La disponibilidad de una prueba depende de la oferta vigente informada en el checkout.
            </p>
            <p>
              <strong>Membresía mensual:</strong> El monto aplicable, la frecuencia, el medio de pago y la modalidad de renovación se informarán antes de que la alumna confirme su inscripción. Ninguna condición de renovación se aplicará de manera distinta a la mostrada en ese momento.
            </p>
            <p>
              <strong>Facturación:</strong> Los cobros, cuando estén habilitados, se procesarán mediante la pasarela de pago indicada en el checkout. Naty Entrenadora no almacena datos sensibles de tarjetas ni números de cuenta en sus servidores.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">4. Cancelación y No Compromiso</h2>
            <p>
              La alumna podrá solicitar la cancelación por el canal indicado en el checkout y mediante comunicación escrita a <strong>team@natyentrenadora.com</strong>. Las instrucciones específicas estarán disponibles antes de la confirmación de pago.
            </p>
            <p>
              Los efectos de una cancelación —incluida la vigencia de acceso y eventuales cobros futuros— se informarán de acuerdo con la modalidad de pago habilitada y sin afectar las garantías legales imperativas aplicables.
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
