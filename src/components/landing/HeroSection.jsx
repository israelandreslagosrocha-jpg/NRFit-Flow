'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Sparkles, Radio, Flame, Users } from 'lucide-react';

export default function HeroSection({ offer }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncVideoMotion = () => {
      const video = videoRef.current;
      if (!video) return;

      if (mediaQuery.matches) {
        video.pause();
      } else {
        video.play().catch(() => undefined);
      }
    };

    syncVideoMotion();
    mediaQuery.addEventListener('change', syncVideoMotion);
    return () => mediaQuery.removeEventListener('change', syncVideoMotion);
  }, []);

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
                <span className="hero-price-val">${offer.monthlyPrice.toLocaleString('es-CL')}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--nt-text-secondary)' }}> CLP / mes</span>
              </div>
              {offer.isPresale && <span className="hero-price-old">$25.000</span>}
              <span className="hero-price-badge">{offer.isPresale ? 'PREVENTA HASTA 4 OCT' : 'VALOR OFICIAL'}</span>
            </div>

            {/* CTAs */}
            <div className="hero-actions">
              <Link href="/auth/register?trial=true" className="nt-btn nt-btn-primary" data-conversion-event="enrollment_start" data-conversion-placement="hero">
                QUIERO SER PARTE DEL TEAM <ArrowRight size={18} />
              </Link>
              <a href="#como-funciona" className="nt-btn nt-btn-secondary">
                CONOCE CÓMO FUNCIONA
              </a>
            </div>

            {/* Trust Micro-Indicators */}
            <div className="hero-guarantee-note">
              <ShieldCheck size={16} style={{ color: 'var(--nt-pink)' }} />
              <span>Sin contrato de permanencia. Verás las condiciones de tu membresía antes de confirmar.</span>
            </div>

          </div>

          {/* Right Column: Editorial Online Platform & Live Session Mockup */}
          <div className="hero-media-wrap">
            <div className="hero-online-card">
              
              {/* Card Top Bar */}
              <div className="hero-online-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="live-pulse-dot"></span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--nt-pink)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    SESIÓN LIVE CON NATALIA
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--nt-text-muted)', fontWeight: 600 }}>
                  20:00 HRS
                </span>
              </div>

              {/* Video Player Frame with Native Ambient Overlay */}
              <div className="hero-video-frame">
                <video 
                  ref={videoRef}
                  src="https://res.cloudinary.com/dhgifjpkh/video/upload/v1774498942/gap_1_m9t9xn.mp4" 
                  autoPlay 
                  muted 
                  loop 
                  playsInline 
                  preload="metadata"
                  className="hero-video-element"
                />
                <div className="hero-video-overlay-gradient"></div>

                {/* Floating Live Badge Top Left */}
                <div className="hero-float-live-badge">
                  <Radio size={14} style={{ color: '#FFFFFF' }} />
                  <span>TRANSMISIÓN EN VIVO</span>
                </div>

                {/* Floating Streak Badge Top Right */}
                <div className="hero-float-streak-badge">
                  <Flame size={14} style={{ color: 'var(--nt-pink)' }} />
                  <span>Ritmo a tu medida</span>
                </div>

                {/* Bottom Overlay Info */}
                <div className="hero-video-bottom-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                    <Sparkles size={13} style={{ color: 'var(--nt-pink)' }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--nt-pink)', textTransform: 'uppercase' }}>
                      Entrenamiento de Hoy
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                    Fuerza Funcional & Estabilidad de Core
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--nt-text-secondary)', margin: '0.2rem 0 0 0' }}>
                    35 Minutos • Nivel Inicial a Intermedio • Desde Casa
                  </p>
                </div>
              </div>

              {/* Card Footer Strip */}
              <div className="hero-online-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--nt-text-secondary)' }}>
                  <Users size={15} style={{ color: 'var(--nt-pink)' }} />
                  <span>Alumnas entrenando en vivo en el Team Naty</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }}></span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#22C55E' }}>ACCESO DESDE TU PORTAL</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
