'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="hero-wrapper">
      <div className="landing-container">
        <div className="hero-grid">
          
          {/* Left Column: Copy & Funnel CTAs */}
          <div className="hero-content">
            
            {/* Top Pill Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              <span className="nt-badge nt-badge-pulse">
                PRUEBA 7 DÍAS SIN RIESGO
              </span>
              <span className="nt-badge nt-badge-white">
                MEMBRESÍA MENSUAL ONLINE
              </span>
            </div>

            {/* Headline Principal */}
            <h1 className="hero-h1">
              ENTRENA PARA LA <span className="nt-highlight">VIDA QUE TIENES.</span>
            </h1>

            {/* Subheadline Realista */}
            <p className="hero-lead">
              Entrenamiento online continuo para mujeres que quieren recuperar fuerza, energía, 
              movilidad y constancia, sin tener que reorganizar toda su vida para poder entrenar.
            </p>

            {/* Price Tag & Founder Offer */}
            <div className="hero-price-tag">
              <div>
                <span className="hero-price-val">$25.000</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--nt-text-secondary)' }}> CLP / mes</span>
              </div>
              <span className="hero-price-old">$29.000</span>
              <span className="hero-price-badge">PRECIO FUNDADOR</span>
            </div>

            {/* CTAs */}
            <div className="hero-actions">
              <a href="#oferta" className="nt-btn nt-btn-primary">
                QUIERO SER PARTE DEL TEAM <ArrowRight size={18} />
              </a>
              <a href="#como-funciona" className="nt-btn nt-btn-secondary">
                CONOCE CÓMO FUNCIONA
              </a>
            </div>

            {/* Trust Micro-Indicators */}
            <div className="hero-guarantee-note">
              <ShieldCheck size={16} style={{ color: 'var(--nt-pink)' }} />
              <span>Sin compromisos de permanencia. Cancela cuando quieras con 1 clic.</span>
            </div>

          </div>

          {/* Right Column: Editorial Hero Media (Natalia) */}
          <div className="hero-media-wrap">
            <div className="hero-image-frame">
              <img 
                src="/images/natalia/natalia-hero.jpg" 
                alt="Natalia Riquelme - Entrenadora y Preparadora Física" 
                loading="eager"
                decoding="async"
              />
              <div className="hero-image-overlay" />
              
              <div className="hero-coach-caption">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                  <Sparkles size={14} style={{ color: 'var(--nt-pink)' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--nt-pink)', textTransform: 'uppercase' }}>
                    Acompañamiento Real
                  </span>
                </div>
                <h4>Natalia Riquelme</h4>
                <p>+15 años de experiencia • Preparadora Física</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
