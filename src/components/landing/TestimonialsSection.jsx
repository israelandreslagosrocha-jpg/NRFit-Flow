'use client';

import React from 'react';
import { Star } from 'lucide-react';

export default function TestimonialsSection() {
  const reviews = [
    {
      name: "Andrea S.",
      meta: "34 años • Mamá y Profesora",
      quote: "Siempre empezaba y lo dejaba a las 3 semanas porque terminaba muerta de cansancio. Con Naty entendí que menos tiempo pero bien hecho funciona mucho mejor. Llevo 5 meses sin parar y tengo energía para jugar con mis hijos por la tarde.",
      initial: "A"
    },
    {
      name: "Daniela V.",
      meta: "29 años • Ingeniera en turnos",
      quote: "Pensé que los LIVE a las 20:00 se me iban a complicar, pero se convirtieron en mi momento sagrado para desconectar del trabajo. Si un día no alcanzo, la clase grabada está lista al día siguiente. No hay culpa, solo ganas de seguir.",
      initial: "D"
    },
    {
      name: "Marcela P.",
      meta: "42 años • Emprendedora",
      quote: "Me daba vergüenza ir a un gimnasio tradicional. La calidez de Natalia y la forma en que explica cada movimiento te hace sentir acompañada desde el primer minuto. Mis dolores lumbares desaparecieron por completo.",
      initial: "M"
    }
  ];

  return (
    <section className="landing-section" style={{ background: '#070709' }}>
      <div className="landing-container">
        
        {/* Header */}
        <div className="nt-section-header">
          <span className="nt-badge">EXPERIENCIAS REALES</span>
          <h2 className="nt-title">
            Historias de constancia, <span className="nt-highlight">no de milagros.</span>
          </h2>
          <p className="nt-subtitle">
            Mujeres que no tenían tiempo, que venían cansadas y que hoy tienen un entrenamiento 
            sostenible integrado con naturalidad en sus vidas.
          </p>
        </div>

        {/* Testimonials 3-Card Grid */}
        <div className="testimonials-grid">
          {reviews.map((rev, idx) => (
            <div key={idx} className="nt-card test-card">
              <div>
                <div className="test-stars">★★★★★</div>
                <p className="test-quote" style={{ marginTop: '1rem' }}>
                  "{rev.quote}"
                </p>
              </div>

              <div className="test-author">
                <div className="test-avatar">{rev.initial}</div>
                <div>
                  <h4 className="test-name">{rev.name}</h4>
                  <p className="test-meta">{rev.meta}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
