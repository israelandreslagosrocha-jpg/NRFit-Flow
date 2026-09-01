'use client';

import React from 'react';
import { Users, Heart, MessageCircle, Sparkles } from 'lucide-react';

export default function CommunitySection() {
  const stats = [
    { val: "100%", lbl: "Mujeres Reales" },
    { val: "+15", lbl: "Años Guiando" },
    { val: "3x", lbl: "Más Constancia" },
    { val: "0", lbl: "Juicios o Poses" }
  ];

  return (
    <section id="comunidad" className="landing-section" style={{ background: '#09090C' }}>
      <div className="landing-container">
        
        <div className="community-box">
          <span className="nt-badge" style={{ margin: '0 auto 1rem auto' }}>
            ESPACIO SEGURO
          </span>

          <h2 className="nt-title">
            Bienvenida al <span className="nt-highlight">Team Naty Entrenadora.</span>
          </h2>

          <p className="nt-subtitle" style={{ maxWidth: 680, margin: '1rem auto 0 auto' }}>
            Entrenar sola frente a una pantalla puede ser solitario. Entrenar sabiendo que al otro lado 
            hay un grupo de mujeres con las mismas dudas, los mismos horarios difíciles y las mismas 
            ganas de sentirse mejor, lo cambia todo.
          </p>

          {/* Key Stat Badges */}
          <div className="community-grid-stats">
            {stats.map((item, idx) => (
              <div key={idx} className="community-stat-item">
                <div className="community-stat-val">{item.val}</div>
                <div className="community-stat-lbl">{item.lbl}</div>
              </div>
            ))}
          </div>

          <p style={{ marginTop: '2rem', fontSize: '0.92rem', color: 'var(--nt-text-secondary)', fontStyle: 'italic' }}>
            “Aquí no competimos por quién tiene el cuerpo más delgado. Celebramos que hoy encontraste 35 minutos para ti.”
          </p>

        </div>

      </div>
    </section>
  );
}
