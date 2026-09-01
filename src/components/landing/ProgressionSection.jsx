'use client';

import React from 'react';
import { TrendingUp, Sparkles, Activity, Flame } from 'lucide-react';

export default function ProgressionSection() {
  const steps = [
    {
      step: "FASE 1",
      duration: "20 – 30 MIN",
      title: "Empieza",
      icon: <Sparkles size={20} style={{ color: 'var(--nt-pink)' }} />,
      desc: "Creas el hábito. Aprendes la técnica correcta de cada movimiento, despiertas tu musculatura y ganas confianza sin terminar agotada para el resto del día."
    },
    {
      step: "FASE 2",
      duration: "30 – 45 MIN",
      title: "Avanza",
      icon: <Activity size={20} style={{ color: 'var(--nt-pink)' }} />,
      desc: "Ganas fuerza y resistencia cardiovascular. Tu cuerpo ya se adaptó a la rutina y notas cómo subes escaleras con más agilidad y cargas pesos sin molestias."
    },
    {
      step: "FASE 3",
      duration: "45 – 60 MIN",
      title: "Crece",
      icon: <Flame size={20} style={{ color: 'var(--nt-pink)' }} />,
      desc: "Consolidación y sobrecarga progresiva dirigida. Mayor tonificación, postura firme, masa muscular protegida y un nivel de energía constante durante toda tu semana."
    }
  ];

  return (
    <section className="landing-section" style={{ background: '#0B0B0E' }}>
      <div className="landing-container">
        
        {/* Header */}
        <div className="nt-section-header">
          <span className="nt-badge">PROGRESIÓN REAL</span>
          <h2 className="nt-title">
            Tu entrenamiento <span className="nt-highlight">evoluciona contigo.</span>
          </h2>
          <p className="nt-subtitle">
            No pretendemos que el día uno entrenes una hora entera. El secreto de la constancia 
            es respetar tu punto de partida e ir construyendo capacidad paso a paso.
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
        <p style={{ textAlign: 'center', marginTop: '2.5rem', color: 'var(--nt-text-muted)', fontSize: '0.88rem' }}>
          * No todas las alumnas necesitan llegar a 60 minutos. Lo importante no es la cantidad de tiempo, sino la calidad del estímulo y que puedas sostenerlo en tu vida real.
        </p>

      </div>
    </section>
  );
}
