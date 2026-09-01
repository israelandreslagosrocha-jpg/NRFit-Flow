'use client';

import React from 'react';
import { Gift, HeartHandshake, Sparkles } from 'lucide-react';

export default function ReferralSection() {
  return (
    <section className="landing-section" style={{ background: '#0B0B0F' }}>
      <div className="landing-container">
        
        <div className="referral-card">
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--nt-pink-soft)', color: 'var(--nt-pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
            <Gift size={26} />
          </div>

          <span className="nt-badge" style={{ margin: '0 auto 1rem auto' }}>
            PROGRAMA DE COMPAÑERAS
          </span>

          <h2 className="nt-title" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', margin: '0.5rem 0' }}>
            ¿Conoces a una amiga que también <br />
            <span className="nt-highlight">necesita volver a entrenar?</span>
          </h2>

          <p className="nt-subtitle" style={{ maxWidth: 620, margin: '1rem auto 1.75rem auto' }}>
            Al convertirte en alumna activa del Team Naty, recibes un cupón exclusivo para invitar a quien tú quieras. 
            Tu invitada accederá también al precio fundador de <strong style={{ color: '#FFFFFF' }}>$25.000 CLP</strong> (en lugar de $29.000) 
            y ambas suman puntos de constancia para recompensas en la plataforma.
          </p>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.25rem', background: 'rgba(255, 45, 120, 0.08)', border: '1px solid var(--nt-border-pink)', borderRadius: 'var(--nt-radius-full)', fontSize: '0.85rem', color: '#FFFFFF' }}>
            <HeartHandshake size={18} style={{ color: 'var(--nt-pink)' }} />
            <span>Entrenar con una amiga multiplica tu adherencia y compromiso semanal</span>
          </div>

        </div>

      </div>
    </section>
  );
}
