'use client';

import React from 'react';
import { Award, HeartHandshake, BookOpen, Dumbbell, ShieldCheck } from 'lucide-react';

export default function NataliaAuthoritySection() {
  const credentials = [
    {
      icon: <Award size={20} />,
      title: "Preparadora Física",
      desc: "+15 años guiando a mujeres en fuerza, salud articular y hábitos sostenibles."
    },
    {
      icon: <Dumbbell size={20} />,
      title: "Especialización en Fuerza Femenina",
      desc: "Ciencia aplicada a la densidad ósea, masa muscular, metabolismo y energía."
    },
    {
      icon: <BookOpen size={20} />,
      title: "Formación y Actualización Continua",
      desc: "Seminarios, webinars y actualización permanente en fisiología del ejercicio."
    },
    {
      icon: <HeartHandshake size={20} />,
      title: "Enfoque Humano y Sin Postureo",
      desc: "Sin poses de redes sociales. Una entrenadora cercana que entiende tu rutina."
    }
  ];

  return (
    <section id="natalia" className="landing-section" style={{ background: '#0D0D10' }}>
      <div className="landing-container">
        
        <div className="natalia-grid">
          
          {/* Left Column: Official Profile Image of Natalia */}
          <div className="natalia-photo-box">
            <div className="natalia-photo-frame" style={{ background: 'radial-gradient(circle at center, rgba(255, 45, 120, 0.15) 0%, #111116 80%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <img 
                src="https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/Copia_de_NR_logo_image_efdt04.png" 
                alt="Natalia Riquelme - Fundadora & Entrenadora Principal" 
                loading="lazy"
                style={{ width: '80%', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.7))' }}
              />
            </div>
            <div className="natalia-exp-badge">
              <span className="natalia-exp-num">+15</span>
              <span className="natalia-exp-text">Años de<br />Experiencia</span>
            </div>
          </div>

          {/* Right Column: Authority, Philosophy & Personal Quote */}
          <div>
            <span className="nt-badge">CONOCE A TU ENTRENADORA</span>
            <h2 className="nt-title" style={{ marginTop: '0.75rem' }}>
              No necesitas otra influencer fitness. <br />
              <span className="nt-highlight">Necesitas una entrenadora real.</span>
            </h2>
            
            <p className="nt-subtitle" style={{ margin: '1rem 0' }}>
              El internet está lleno de rutinas extremas diseñadas para llamar la atención en redes sociales. 
              Mi trabajo con el Team Naty es exactamente lo contrario: ayudarte a construir un hábito 
              saludable, seguro y constante que te acompañe por años.
            </p>

            {/* Central Personal Quote */}
            <div className="natalia-quote-box">
              <p className="natalia-quote-text">
                “Tranquila. Te puedo ayudar a que te sientas un poco más cómoda. Hay que adaptar un entrenamiento que puedas sostener y luego ir de a poco creciendo para que recuperes tu energía y te sientas mejor contigo misma.”
              </p>
              <span className="natalia-quote-author">
                — Natalia Riquelme • Preparadora Física & Fundadora
              </span>
            </div>

            {/* Credentials Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '2rem' }}>
              {credentials.map((cred, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <div style={{ color: 'var(--nt-pink)', flexShrink: 0, marginTop: '2px' }}>
                    {cred.icon}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 0.2rem 0' }}>
                      {cred.title}
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--nt-text-muted)', margin: 0, lineHeight: 1.45 }}>
                      {cred.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
