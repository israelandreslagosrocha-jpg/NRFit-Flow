'use client';

import React from 'react';
import { Sparkles, Activity, Flame } from 'lucide-react';

export default function ProgressionSection() {
  const steps = [
    {
      step: "DESDE TU NIVEL",
      duration: "Técnica primero",
      title: "Empieza con confianza",
      icon: <Sparkles size={20} style={{ color: 'var(--nt-pink)' }} />,
      desc: "Cada movimiento se explica con opciones para que puedas comenzar desde donde estás hoy, sin compararte ni exigirte de más."
    },
    {
      step: "A TU RITMO",
      duration: "Opciones reales",
      title: "Adapta cada sesión",
      icon: <Activity size={20} style={{ color: 'var(--nt-pink)' }} />,
      desc: "Elige una versión que se ajuste a tu energía, experiencia y día. El objetivo es entrenar de forma segura y volver a hacerlo mañana."
    },
    {
      step: "CON CONSTANCIA",
      duration: "Progreso sostenible",
      title: "Hazlo parte de tu vida",
      icon: <Flame size={20} style={{ color: 'var(--nt-pink)' }} />,
      desc: "La fuerza, la movilidad y la seguridad se construyen semana a semana. Tu avance no depende de entrenar más tiempo, sino de poder sostenerlo."
    }
  ];

  return (
    <section className="landing-section" style={{ background: '#FFF7F3' }}>
      <div className="landing-container">
        
        {/* Header */}
        <div className="nt-section-header">
          <span className="nt-badge">ENTRENAMIENTO A TU RITMO</span>
          <h2 className="nt-title">
            Tu entrenamiento <span className="nt-highlight">se adapta a tu vida.</span>
          </h2>
          <p className="nt-subtitle">
            Todas las rutinas duran entre 10 y 40 minutos. Progresas con técnica, adaptaciones y constancia; no sumando minutos porque sí.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="progression-grid">
          {steps.map((item, idx) => (
            <div key={idx} className="nt-card progression-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="progression-step-num">{item.step}</span>
                {item.icon}
              </div>
              <div className="progression-duration">{item.duration}</div>
              <h4>{item.title}</h4>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Micro Clarification */}
        <div style={{ maxWidth: '780px', margin: '2.5rem auto 0 auto', padding: '1.25rem 1.5rem', background: '#FBE7EE', border: '1px solid var(--nt-border-subtle)', borderRadius: 'var(--nt-radius-md)', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--nt-text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            💡 <strong style={{ color: 'var(--nt-text-primary)' }}>Todas las rutinas se mantienen entre 10 y 40 minutos:</strong> tu progreso viene de la técnica, las adaptaciones y la constancia que construyes semana a semana.
          </p>
        </div>

      </div>
    </section>
  );
}
