'use client';

import React from 'react';
import { XCircle, CheckCircle2 } from 'lucide-react';

export default function ParadigmShiftSection() {
  const beforePoints = [
    "Pensar que necesitas 60 a 90 minutos libres para que valga la pena.",
    "Esperar a que tu semana sea perfecta y tranquila para recién empezar.",
    "Sentir culpa los días que no alcanzas a entrenar por cansancio o urgencias familiares.",
    "Seguir rutinas genéricas de redes sociales sin progresión ni corrección técnica.",
    "Ver el entrenamiento como un castigo o una tarea agotadora más en tu día."
  ];

  const afterPoints = [
    "Sesiones de 20 a 45 minutos que caben en cualquier hueco de tu rutina.",
    "Empezar desde donde estás hoy, con el equipamiento que tengas a mano.",
    "Un sistema continuo sin fechas de vencimiento: si fallas un día, la semana sigue.",
    "Clases estructuradas con foco en fuerza, postura, movilidad y energía duradera.",
    "Sentir que el entrenamiento te devuelve energía para jugar con tus hijos y vivir tu día."
  ];

  return (
    <section className="landing-section" style={{ background: '#08080A' }}>
      <div className="landing-container">
        
        {/* Header */}
        <div className="nt-section-header">
          <span className="nt-badge">CAMBIO DE ENFOQUE</span>
          <h2 className="nt-title">
            De la frustración a un <span className="nt-highlight">entrenamiento sostenible</span>
          </h2>
          <p className="nt-subtitle">
            No necesitas más motivación. Necesitas un sistema que puedas sostener y que se adapte a la vida que realmente tienes.
          </p>
        </div>

        {/* 2-Column Comparison */}
        <div className="paradigm-grid">
          
          {/* Col 1: ANTES */}
          <div className="paradigm-col paradigm-before">
            <div className="paradigm-header">
              <span className="paradigm-label">EL MODELO TRADICIONAL QUE FALLA</span>
              <h3>“Tengo que encontrar tiempo”</h3>
            </div>
            <ul className="paradigm-list">
              {beforePoints.map((point, idx) => (
                <li key={idx} className="paradigm-item">
                  <XCircle size={18} color="#EF4444" className="paradigm-item-icon" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 2: DESPUÉS */}
          <div className="paradigm-col paradigm-after">
            <div className="paradigm-header">
              <span className="paradigm-label">TEAM NATY ENTRENADORA</span>
              <h3>“Tengo un sistema que se adapta a mi vida”</h3>
            </div>
            <ul className="paradigm-list">
              {afterPoints.map((point, idx) => (
                <li key={idx} className="paradigm-item">
                  <CheckCircle2 size={18} color="var(--nt-pink)" className="paradigm-item-icon" />
                  <span style={{ color: '#FFFFFF' }}>{point}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

      </div>
    </section>
  );
}
