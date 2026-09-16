import React from 'react';
import type { Metadata } from 'next';
import { AlertTriangle, Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Naty Entrenadora',
  description: 'Política de privacidad y protección de datos personales de Naty Entrenadora conforme a la Ley N° 19.628 de Chile.',
};

export default function PrivacidadPage() {
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
            Este documento constituye un modelo técnico preliminar para la fase de pre-lanzamiento. Debe ser auditado por un especialista en protección de datos personales conforme a la Ley N° 19.628 de la República de Chile y estándares aplicables antes de su versión pública final.
          </div>
        </div>

        {/* Encabezado */}
        <div className="space-y-3 border-b border-neutral-800 pb-6">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold tracking-wider uppercase">
            <Lock className="w-4 h-4" />
            <span>Seguridad y Privacidad</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Política de Privacidad y Protección de Datos
          </h1>
          <p className="text-sm text-neutral-400">
            Naty Entrenadora (www.natyentrenadora.cl) · Canal oficial: team@natyentrenadora.cl
          </p>
        </div>

        {/* Contenido */}
        <div className="space-y-8 text-sm text-neutral-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Responsable del Tratamiento</h2>
            <p>
              La plataforma <strong>www.natyentrenadora.cl</strong> es operada por Natalia Riquelme y su equipo técnico. El contacto directo para cualquier asunto vinculado con datos personales es <strong>team@natyentrenadora.cl</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">2. Datos Recolectados y Principio de Minimización</h2>
            <p>
              En cumplimiento del principio de minimización de datos, únicamente solicitamos la información estrictamente necesaria para la prestación del servicio:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-neutral-300">
              <li><strong>Datos de Identificación y Contacto:</strong> Nombre completo, correo electrónico, número de teléfono (opcional) y preferencias generales de entrenamiento (nivel, equipamiento).</li>
              <li><strong>Datos de Autenticación:</strong> Contraseña cifrada en reposo mediante infraestructura Supabase Auth.</li>
              <li><strong>Información Técnica:</strong> Dirección IP, registros de acceso y eventos técnicos estrictamente necesarios para la seguridad perimetral y prevención de fraude.</li>
            </ul>
            <p className="text-rose-300/90 font-medium">
              Importante: No solicitamos ni almacenamos datos de salud sensibles, diagnósticos clínicos ni historias médicas en la base de datos de la plataforma.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">3. Tratamiento de Información Financiera y Pagos</h2>
            <p>
              Naty Entrenadora no recopila, almacena ni procesa números de tarjetas de crédito o débito, códigos de seguridad (CVV) ni credenciales bancarias. Todo el flujo transaccional se delega directamente a <strong>Mercado Pago Chile</strong> bajo sus estándares de seguridad y certificación PCI-DSS.
            </p>
            <p>
              Únicamente almacenamos los identificadores técnicos de transacción y suscripción provistos por la pasarela con fines de control de membresía y facturación contable.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">4. Finalidad del Tratamiento</h2>
            <p>Los datos personales recolectados se destinan exclusivamente a:</p>
            <ul className="list-disc pl-5 space-y-1 text-neutral-300">
              <li>Gestionar la creación y mantención de la cuenta de alumna en el portal.</li>
              <li>Validar la vigencia del período de prueba y membresía activa.</li>
              <li>Enviar comunicaciones operativas críticas (confirmaciones de suscripción, avisos de cobro, restablecimiento de contraseña).</li>
              <li>Garantizar la seguridad técnica y prevenir accesos no autorizados mediante Row Level Security (RLS).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">5. Derechos ARCO de la Usuaria</h2>
            <p>
              Conforme a la Ley N° 19.628 sobre Protección de la Vida Privada de Chile, la usuaria tiene derecho en todo momento a acceder, rectificar, cancelar o solicitar el bloqueo de sus datos personales. Para ejercer estos derechos, basta con enviar un correo formal a <strong>team@natyentrenadora.cl</strong> indicando la solicitud.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
