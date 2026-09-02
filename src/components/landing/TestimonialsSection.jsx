'use client';

import React from 'react';
import { ShieldCheck, Heart, Sparkles, Target } from 'lucide-react';

export default function TestimonialsSection() {
  return (
    <section className="landing-section" style={{ background: '#09090C' }}>
      <div className="landing-container">
        
        {/* Header */}
        <div className="nt-section-header">
          <span className="nt-badge">TRANSPARENCIA & ÉTICA</span>
          <h2 className="nt-title">
            Historias de constancia, <span className="nt-highlight">no de milagros.</span>
          </h2>
          <p className="nt-subtitle">
            En el Team Naty no inventamos testimonios ni prometemos transformaciones irreales en 15 días. 
            Creemos en la constancia real, la progresión respetuosa y los hábitos sostenibles en el tiempo.
          </p>
        </div>

        {/* Authentic Community Statement Card */}
        <div style={{ maxWidth: '840px', margin: '0 auto', background: '#111116', border: '1px solid var(--nt-border)', borderRadius: 'var(--nt-radius-lg)', padding: '2.5rem 2rem', position: 'relative', overflow: 'hidden' }}>
          
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, var(--nt-pink), transparent)' }} />

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span className="nt-badge nt-badge-pulse" style={{ marginBottom: '1rem' }}>
              PRIMERA GENERACIÓN ONLINE
            </span>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.25rem, 3vw, 1.65rem)', fontWeight: 800, color: '#FFFFFF', margin: '0.75rem 0 0.5rem 0' }}>
              Estamos recopilando las primeras historias de esta nueva etapa
            </h3>
            <p style={{ color: 'var(--nt-text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '640px', margin: '0 auto' }}>
              Cada mujer que entra al Team Naty inicia un camino propio: recuperar energía para su rutina diaria, sentirse más ágil y mantener el hábito semana a semana sin castigos ni culpas.
            </p>
          </div>

          {/* 3 Authentic Value Pillars */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
            
            <div style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--nt-border-subtle)', borderRadius: 'var(--nt-radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--nt-pink)', fontWeight: 700, fontSize: '0.85rem' }}>
                <Target size={16} /> FUERZA COTIDIANA
              </div>
              <p style={{ margin: 0, color: 'var(--nt-text-secondary)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                Subir escaleras, cargar las bolsas o jugar con tus hijos sin terminar agotada ni con dolores al final del día.
              </p>
            </div>

            <div style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--nt-border-subtle)', borderRadius: 'var(--nt-radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--nt-pink)', fontWeight: 700, fontSize: '0.85rem' }}>
                <Heart size={16} /> CERO CULPA
              </div>
              <p style={{ margin: 0, color: 'var(--nt-text-secondary)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                Si una semana se te complica por trabajo o familia, no tienes que empezar de cero: tu sistema sigue esperándote.
              </p>
            </div>

            <div style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--nt-border-subtle)', borderRadius: 'var(--nt-radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--nt-pink)', fontWeight: 700, fontSize: '0.85rem' }}>
                <ShieldCheck size={16} /> CRITERIO PROFESIONAL
              </div>
              <p style={{ margin: 0, color: 'var(--nt-text-secondary)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                +15 años de experiencia de Natalia para cuidar tus articulaciones y guiarte de forma segura paso a paso.
              </p>
            </div>

          </div>

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--nt-text-muted)' }}>
              Pronto publicaremos testimonios y experiencias con nombre, fotografía y autorización expresa de nuestras alumnas reales.
            </span>
          </div>

        </div>

      </div>
    </section>
  );
}
