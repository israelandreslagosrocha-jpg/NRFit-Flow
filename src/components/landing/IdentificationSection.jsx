'use client';

import React from 'react';
import { Briefcase, Baby, Home, BatteryCharging, RotateCcw, Clock } from 'lucide-react';

export default function IdentificationSection() {
  const painPoints = [
    {
      icon: <Briefcase size={22} />,
      title: "Trabajo y Estudios",
      desc: "Terminas tu jornada con la mente saturada y cero ganas de perder 40 minutos en traslados a un gimnasio."
    },
    {
      icon: <Baby size={22} />,
      title: "Hijos y Familia",
      desc: "Tu agenda gira en torno a las necesidades de los demás. El tiempo para ti siempre queda al final de la lista."
    },
    {
      icon: <Home size={22} />,
      title: "Labores del Hogar",
      desc: "Las responsabilidades de la casa nunca se acaban y sientes que para entrenar tendrías que descuidar todo lo demás."
    },
    {
      icon: <BatteryCharging size={22} />,
      title: "Cansancio al Final del Día",
      desc: "Llegas a la noche sin energía y piensas que entrenar te va a agotar más, en lugar de recargarte."
    },
    {
      icon: <RotateCcw size={22} />,
      title: "Intentos Anteriores Frustrados",
      desc: "Has probado videos en YouTube o planes extremos que exigían 1 hora diaria y que terminaste abandonando por falta de tiempo."
    },
    {
      icon: <Clock size={22} />,
      title: "Sin Saber Qué Hacer ni Cómo Progresar",
      desc: "Entrenar sin guía te genera dudas: ¿estoy haciendo bien el ejercicio? ¿este peso es el correcto? ¿realmente estoy avanzando?"
    }
  ];

  return (
    <section className="landing-section" style={{ background: '#0B0B0E' }}>
      <div className="landing-container">
        
        {/* Header */}
        <div className="nt-section-header">
          <span className="nt-badge">VIDA REAL</span>
          <h2 className="nt-title">
            ¿Quieres entrenar, pero <span className="nt-highlight">nunca encuentras el momento?</span>
          </h2>
          <p className="nt-subtitle">
            El problema no eres tú ni tu fuerza de voluntad. El problema es intentar encajar un modelo de entrenamiento que no fue pensado para la vida que tienes.
          </p>
        </div>

        {/* Grid of Real Life Scenarios */}
        <div className="ident-grid">
          {painPoints.map((item, index) => (
            <div key={index} className="nt-card ident-card">
              <div className="ident-icon-wrap">
                {item.icon}
              </div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Anchor Conclusion */}
        <div className="ident-conclusion-banner">
          <h3>No necesitas una vida perfecta para empezar a entrenar.</h3>
          <p>
            Necesitas un sistema flexible que entienda tu realidad, que empiece desde tu nivel actual 
            y que puedas sostener semana a semana sin sacrificar tu tranquilidad.
          </p>
        </div>

      </div>
    </section>
  );
}
