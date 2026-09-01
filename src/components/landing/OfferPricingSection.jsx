'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

export default function OfferPricingSection() {
  const benefits = [
    "3 Entrenamientos semanales adaptados a tu vida cotidiana.",
    "Clases en vivo los Martes y Jueves a las 20:00 hrs con corrección técnica.",
    "Contenido grabado semanal disponible para entrenar cuando tú puedas.",
    "Acceso total a la videoteca con todas las rutinas grabadas anteriores.",
    "Dashboard personal de alumna con seguimiento de constancia y racha.",
    "Comunidad exclusiva del Team Naty para mantener la motivación.",
    "Desafíos mensuales y sistema de reconocimientos por constancia.",
    "Soporte directo para resolver dudas de técnica y progresión."
  ];

  return (
    <section id="oferta" className="landing-section" style={{ background: '#09090C' }}>
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
              PRIMERA GENERACIÓN • PRECIO FUNDADOR
            </div>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--nt-text-secondary)', fontWeight: 600 }}>
                Membresía Mensual Continua
              </span>
              
              <div className="pricing-val-box">
                <span className="pricing-old">$29.000</span>
                <span className="pricing-num">$25.000</span>
                <span className="pricing-period">CLP / mes</span>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--nt-pink)', fontWeight: 700, margin: '0.5rem 0 0 0' }}>
                ⭐ Conservas este precio de $25.000 mientras mantengas activa tu membresía.
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
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>
                7 Días de Prueba Gratis
              </span>
              <p style={{ fontSize: '0.8rem', color: 'var(--nt-text-secondary)', margin: '0.2rem 0 0 0' }}>
                No se cobrará nada durante tus primeros 7 días. Si no es lo que esperabas, cancelas con un clic antes del día 7 y tu cobro será $0.
              </p>
            </div>

            {/* Primary Funnel CTA */}
            <Link href="/auth/register?trial=true" className="nt-btn nt-btn-primary nt-btn-full" style={{ padding: '1.15rem 2rem', fontSize: '1rem' }}>
              QUIERO PROBAR 7 DÍAS <ArrowRight size={20} />
            </Link>

            {/* PCI-DSS Security Guarantee */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--nt-text-muted)' }}>
              <ShieldCheck size={16} style={{ color: 'var(--nt-pink)' }} />
              <span>Pago 100% cifrado y seguro. Cero contratos forzados.</span>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
