'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

export default function OfferPricingSection({ offer }) {
  const benefits = [
    "2 clases en vivo semanales para dar estructura a tu proceso.",
    "Entrenamientos LIVE los Lunes y Miércoles a las 20:00 hrs con corrección técnica directa de Natalia.",
    "Biblioteca de entrenamientos asíncronos disponible para entrenar cuando tú puedas.",
    "Acceso total a la videoteca con todas las rutinas grabadas anteriores.",
    "Portal personal de alumna con agenda, contenido y avisos.",
    "Comunidad exclusiva del Team Naty para mantener la motivación.",
    "Avisos dentro de tu portal cuando Natalia publique contenido o programe una sesión.",
    "Soporte directo para resolver dudas de técnica y progresión."
  ];

  return (
    <section id="oferta" className="landing-section" style={{ background: '#FBE7EE' }}>
      <div className="landing-container">
        
        {/* Header */}
        <div className="nt-section-header">
          <span className="nt-badge">MEMBRESÍA OFICIAL</span>
          <h2 className="nt-title">
            Empieza tu prueba de <span className="nt-highlight">7 días gratis.</span>
          </h2>
          <p className="nt-subtitle">
            Ingresa a la plataforma, prueba las clases, vive la experiencia en vivo y decide con total tranquilidad si Naty Entrenadora es para ti.
          </p>
        </div>

        {/* Pricing Card Featured */}
        <div className="pricing-wrapper">
          <div className="pricing-card-featured">
            
            {/* Top Badge */}
            <div className="pricing-badge-top">
              {offer.label}
            </div>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--nt-text-secondary)', fontWeight: 600 }}>
                Membresía Mensual Continua
              </span>
              
              <div className="pricing-val-box">
                {offer.isPresale && <span className="pricing-old">$25.000</span>}
                <span className="pricing-num">${offer.monthlyPrice.toLocaleString('es-CL')}</span>
                <span className="pricing-period">CLP / mes</span>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--nt-pink)', fontWeight: 700, margin: '0.5rem 0 0 0' }}>
                {offer.detail}
              </p>
            </div>

            {/* Benefit Checkmarks */}
            <ul className="pricing-features-list">
              {benefits.map((feat, idx) => (
                <li key={idx} className="pricing-feature-item">
                  <CheckCircle2 size={18} />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            {/* Trial Guarantee Strip */}
            <div style={{ padding: '1rem', background: 'rgba(255, 45, 120, 0.08)', borderRadius: 'var(--nt-radius-sm)', border: '1px solid var(--nt-border-pink)', textAlign: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--nt-text-primary)' }}>
                7 Días de Prueba Gratis
              </span>
              <p style={{ fontSize: '0.8rem', color: 'var(--nt-text-secondary)', margin: '0.2rem 0 0 0' }}>
                Antes de confirmar, verás el método de cobro, la fecha aplicable y las instrucciones de cancelación de tu membresía.
              </p>
            </div>

            {/* Primary Funnel CTA */}
            <Link href="/auth/register?trial=true" className="nt-btn nt-btn-primary nt-btn-full" data-conversion-event="enrollment_start" data-conversion-placement="pricing" style={{ padding: '1.15rem 2rem', fontSize: '1rem' }}>
              QUIERO PROBAR 7 DÍAS <ArrowRight size={20} />
            </Link>

            {/* PCI-DSS Security Guarantee */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--nt-text-muted)' }}>
              <ShieldCheck size={16} style={{ color: 'var(--nt-pink)' }} />
              <span>La pasarela y las condiciones de pago se confirman antes de finalizar tu inscripción.</span>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
