'use client';

import React from 'react';
import { Play, Calendar, Flame, Award, CheckCircle2, ChevronRight } from 'lucide-react';

export default function DashboardPreviewSection() {
  return (
    <section className="landing-section" style={{ background: '#08080B' }}>
      <div className="landing-container">
        
        {/* Header */}
        <div className="nt-section-header">
          <span className="nt-badge">TECNOLOGÍA A TU SERVICIO</span>
          <h2 className="nt-title">
            Mucho más que videos. <br />
            <span className="nt-highlight">Tu plataforma personal de constancia.</span>
          </h2>
          <p className="nt-subtitle">
            Diseñada con el estándar visual de las mejores aplicaciones de fitness del mundo, 
            pero enfocada 100% en ayudarte a mantener tu racha y no abandonar.
          </p>
        </div>

        {/* Interactive / Editorial Mockup */}
        <div className="dashboard-preview-card">
          
          {/* Mock Topbar */}
          <div className="dash-mock-topbar">
            <div className="dash-mock-user">
              <div className="dash-mock-avatar">C</div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  ¡Hola, Camila!
                </h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--nt-pink)', fontWeight: 600 }}>
                  Team Naty • Alumna Activa
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.85rem', background: 'rgba(255, 45, 120, 0.12)', border: '1px solid var(--nt-border-pink)', borderRadius: 'var(--nt-radius-full)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--nt-pink)' }}>
                <Flame size={14} /> 12 Entrenamientos Seguidos
              </span>
            </div>
          </div>

          {/* Mock Content Grid */}
          <div className="dash-mock-grid">
            
            {/* Box 1: Next LIVE class card */}
            <div className="dash-mock-box" style={{ background: 'linear-gradient(135deg, rgba(255, 45, 120, 0.1) 0%, #15151C 100%)', border: '1px solid var(--nt-border-pink)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--nt-pink)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  PRÓXIMA CLASE EN VIVO
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--nt-text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Calendar size={13} /> Hoy 20:00 hrs
                </span>
              </div>

              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 0.5rem 0' }}>
                Fuerza & Estabilidad de Core
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--nt-text-secondary)', margin: '0 0 1.25rem 0' }}>
                Con Natalia Riquelme en vivo. 35 minutos de trabajo guiado adaptado a tu nivel.
              </p>

              <button className="nt-btn nt-btn-primary nt-btn-full" style={{ padding: '0.75rem 1.5rem', fontSize: '0.85rem' }}>
                <Play size={16} fill="#FFFFFF" /> ENTRAR A LA SALA EN VIVO
              </button>
            </div>

            {/* Box 2: Weekly Tracker & Achievements */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Weekly Streak Box */}
              <div className="dash-mock-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>Semana Actual</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--nt-pink)', fontWeight: 600 }}>2 de 3 completados</span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div style={{ flex: 1, padding: '0.6rem', textAlign: 'center', background: 'rgba(255,45,120,0.15)', border: '1px solid var(--nt-border-pink)', borderRadius: 'var(--nt-radius-sm)', color: '#FFFFFF', fontSize: '0.8rem', fontWeight: 700 }}>
                    Lun ✓
                  </div>
                  <div style={{ flex: 1, padding: '0.6rem', textAlign: 'center', background: 'rgba(255,45,120,0.15)', border: '1px solid var(--nt-border-pink)', borderRadius: 'var(--nt-radius-sm)', color: '#FFFFFF', fontSize: '0.8rem', fontWeight: 700 }}>
                    Mar ✓
                  </div>
                  <div style={{ flex: 1, padding: '0.6rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 'var(--nt-radius-sm)', color: 'var(--nt-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    Jue (Hoy)
                  </div>
                </div>
              </div>

              {/* Reward Badge Box */}
              <div className="dash-mock-box" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255, 45, 120, 0.15)', color: 'var(--nt-pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Award size={22} />
                </div>
                <div>
                  <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 0.15rem 0' }}>
                    Logro: Constancia Nivel 2
                  </h5>
                  <p style={{ fontSize: '0.78rem', color: 'var(--nt-text-muted)', margin: 0 }}>
                    Completaste 4 semanas continuas sin abandonar.
                  </p>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
