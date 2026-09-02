'use client';

import React from 'react';
import { 
  Play, Calendar, Flame, Award, CheckCircle2, Video, 
  Users, Target, Sparkles, TrendingUp, Clock, BookOpen
} from 'lucide-react';

export default function DashboardPreviewSection() {
  return (
    <section id="plataforma" className="landing-section" style={{ background: '#070709' }}>
      <div className="landing-container">
        
        {/* Header */}
        <div className="nt-section-header">
          <span className="nt-badge">TECNOLOGÍA A TU SERVICIO</span>
          <h2 className="nt-title">
            Mucho más que videos. <br />
            <span className="nt-highlight">Tu plataforma personal de constancia.</span>
          </h2>
          <p className="nt-subtitle">
            Entrena, registra tu progreso, sigue tu semana y mantén el rumbo sin tener que empezar de cero cada vez.
          </p>
        </div>

        {/* Big Dashboard Showcase Mockup */}
        <div className="dashboard-preview-card" style={{ maxWidth: '1080px', margin: '0 auto' }}>
          
          {/* Top Platform Bar */}
          <div className="dash-mock-topbar" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div className="dash-mock-user">
              <div className="dash-mock-avatar">NR</div>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  Portal de Alumna • Team Naty
                </h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--nt-pink)', fontWeight: 600 }}>
                  Membresía Online Activa
                </span>
              </div>
            </div>

            {/* Quick Badges: Racha, Comunidad, Objetivos */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.85rem', background: 'rgba(255, 45, 120, 0.12)', border: '1px solid var(--nt-border-pink)', borderRadius: 'var(--nt-radius-full)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--nt-pink)' }}>
                <Flame size={14} /> 12 Entrenamientos Seguidos
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.85rem', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--nt-border)', borderRadius: 'var(--nt-radius-full)', fontSize: '0.78rem', fontWeight: 600, color: '#FFFFFF' }}>
                <Users size={14} style={{ color: 'var(--nt-pink)' }} /> +150 Alumnas Activas
              </span>
            </div>
          </div>

          {/* Main Dashboard Interactive Grid */}
          <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            
            {/* 1. PRÓXIMA SESIÓN LIVE */}
            <div className="dash-mock-box" style={{ background: 'linear-gradient(135deg, rgba(255, 45, 120, 0.12) 0%, #13131A 100%)', border: '1px solid var(--nt-border-pink)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--nt-pink)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span className="live-pulse-dot" style={{ width: 6, height: 6 }}></span> EN VIVO CON NATALIA
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--nt-text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Calendar size={13} /> Hoy 20:00 hrs
                </span>
              </div>

              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 0.35rem 0' }}>
                Fuerza Funcional & Estabilidad
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--nt-text-secondary)', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                Corrección en tiempo real con Natalia. Duración: 35 min. Implementos: Ninguno o mancuernas ligeras.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="nt-btn nt-btn-primary" style={{ flex: 1, padding: '0.65rem 1rem', fontSize: '0.8rem', justifyContent: 'center' }}>
                  <Play size={15} fill="#FFFFFF" /> ENTRAR A LA SALA
                </button>
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--nt-radius-sm)', border: '1px solid var(--nt-border)', fontSize: '0.75rem', color: 'var(--nt-text-muted)', display: 'flex', alignItems: 'center' }}>
                  En 15 min
                </div>
              </div>
            </div>

            {/* 2. SEMANA ACTUAL & PLANIFICACIÓN */}
            <div className="dash-mock-box" style={{ background: '#121217', border: '1px solid var(--nt-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={15} style={{ color: 'var(--nt-pink)' }} /> Semana en Curso
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--nt-pink)', fontWeight: 700 }}>
                  2 de 3 completados (67%)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem 0.5rem', textAlign: 'center', background: 'rgba(255,45,120,0.12)', border: '1px solid var(--nt-border-pink)', borderRadius: 'var(--nt-radius-sm)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--nt-text-muted)', marginBottom: '0.2rem' }}>LUNES</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#FFFFFF' }}>Grabado ✓</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--nt-pink)', marginTop: '0.2rem' }}>25 min</div>
                </div>
                <div style={{ padding: '0.75rem 0.5rem', textAlign: 'center', background: 'rgba(255,45,120,0.12)', border: '1px solid var(--nt-border-pink)', borderRadius: 'var(--nt-radius-sm)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--nt-text-muted)', marginBottom: '0.2rem' }}>MARTES</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#FFFFFF' }}>LIVE ✓</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--nt-pink)', marginTop: '0.2rem' }}>35 min</div>
                </div>
                <div style={{ padding: '0.75rem 0.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--nt-radius-sm)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--nt-text-muted)', marginBottom: '0.2rem' }}>JUEVES</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--nt-pink)' }}>LIVE (Hoy)</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--nt-text-muted)', marginTop: '0.2rem' }}>20:00 hrs</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--nt-text-secondary)' }}>
                <CheckCircle2 size={13} style={{ color: 'var(--nt-pink)' }} />
                <span>Meta semanal al alcance. ¡Hoy sumas tu 3er entrenamiento!</span>
              </div>
            </div>

            {/* 3. VIDEOTECA ON-DEMAND */}
            <div className="dash-mock-box" style={{ background: '#121217', border: '1px solid var(--nt-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Video size={15} style={{ color: 'var(--nt-pink)' }} /> Videoteca On-Demand
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--nt-text-muted)' }}>Disponible 24/7</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--nt-radius-sm)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>Movilidad Articular & Espalda</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--nt-text-muted)' }}>Ideal post-jornada laboral • 20 min</div>
                  </div>
                  <Play size={16} style={{ color: 'var(--nt-pink)', cursor: 'pointer' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--nt-radius-sm)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>Glúteos & Tren Inferior Fuerte</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--nt-text-muted)' }}>Técnica guiada • 35 min</div>
                  </div>
                  <Play size={16} style={{ color: 'var(--nt-pink)', cursor: 'pointer' }} />
                </div>
              </div>
            </div>

            {/* 4. OBJETIVOS & RECOMPENSAS */}
            <div className="dash-mock-box" style={{ background: '#121217', border: '1px solid var(--nt-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Award size={15} style={{ color: 'var(--nt-pink)' }} /> Logros & Recompensas
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--nt-pink)', fontWeight: 600 }}>Nivel 2</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.65rem 0.75rem', background: 'rgba(255, 45, 120, 0.06)', borderRadius: 'var(--nt-radius-sm)', border: '1px solid rgba(255, 45, 120, 0.2)', marginBottom: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255, 45, 120, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nt-pink)', flexShrink: 0 }}>
                  <Award size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>Insignia: 4 Semanas sin Abandonar</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--nt-text-muted)' }}>Hábito consolidado en tu rutina diaria</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--nt-text-secondary)' }}>
                <span>Próxima meta: 8 Semanas Continuas</span>
                <span style={{ color: 'var(--nt-pink)', fontWeight: 700 }}>75%</span>
              </div>
            </div>

          </div>

          {/* Bottom Note */}
          <div style={{ padding: '0.85rem 1.5rem', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--nt-text-muted)' }}>
              * Vista demostrativa del panel interactivo de alumna exclusivo del Team Naty Entrenadora.
            </span>
          </div>

        </div>

      </div>
    </section>
  );
}
