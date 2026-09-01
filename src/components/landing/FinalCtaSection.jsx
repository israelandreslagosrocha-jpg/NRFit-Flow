'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export default function FinalCtaSection() {
  return (
    <section className="final-cta-section">
      <div className="landing-container">
        <div className="final-cta-box">
          
          <span className="nt-badge nt-badge-pulse">
            TU NUEVO COMIENZO
          </span>

          <h2 className="nt-title" style={{ fontSize: 'clamp(2.25rem, 5vw, 3.75rem)' }}>
            EMPIEZA DESDE <br />
            <span className="nt-highlight">DONDE ESTÁS.</span>
          </h2>

          <p className="nt-subtitle" style={{ maxWidth: 600 }}>
            No esperes a que tu semana sea perfecta ni a tener horas libres de sobra. 
            Prueba 7 días gratis y descubre cómo se siente entrenar con un sistema que realmente se adapta a tu vida.
          </p>

          <Link href="/auth/register?trial=true" className="nt-btn nt-btn-primary" style={{ padding: '1.25rem 2.5rem', fontSize: '1.05rem', marginTop: '0.75rem' }}>
            QUIERO SER PARTE DEL TEAM <ArrowRight size={20} />
          </Link>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--nt-text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={16} style={{ color: 'var(--nt-pink)' }} /> 7 días de prueba sin riesgo
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={16} style={{ color: 'var(--nt-pink)' }} /> $25.000 CLP/mes Precio Fundador
            </span>
            <span>✓ Cancela cuando quieras</span>
          </div>

        </div>
      </div>
    </section>
  );
}
