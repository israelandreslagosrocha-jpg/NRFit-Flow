'use client';

import React from 'react';
import { Video, Radio, Sparkles, Clock, Dumbbell, Calendar, CheckCircle2 } from 'lucide-react';

export default function HowItWorksSection() {
  const schedule = [
    {
      badge: "INICIO DE SEMANA",
      day: "Lunes",
      title: "Entrenamiento Grabado VOD",
      time: "Disponible desde la mañana",
      icon: <Video size={24} style={{ color: 'var(--nt-pink)' }} />,
      desc: "1 a 2 entrenamientos grabados publicados antes de iniciar la semana. Puedes hacerlos en el horario que mejor te acomode desde la comodidad de tu hogar."
    },
    {
      badge: "EN VIVO CON NATALIA",
      day: "Martes",
      title: "Clase LIVE Guiada",
      time: "20:00 – 20:30 hrs (Chile)",
      icon: <Radio size={24} style={{ color: 'var(--nt-pink)' }} />,
      desc: "Entrenamiento grupal en vivo con correcciones técnicas en tiempo real, motivación colectiva y respuesta de dudas directamente con Natalia."
    },
    {
      badge: "EN VIVO CON NATALIA",
      day: "Jueves",
      title: "Clase LIVE Guiada",
      time: "20:00 – 20:30 hrs (Chile)",
      icon: <Radio size={24} style={{ color: 'var(--nt-pink)' }} />,
      desc: "Segunda sesión LIVE de la semana. Cerramos la planificación con ejercicios de fuerza funcional, resistencia y movilidad corporal completa."
    }
  ];

  return (
    <section id="como-funciona" className="landing-section" style={{ background: '#09090C' }}>
      <div className="landing-container">
        
        {/* Header */}
        <div className="nt-section-header">
          <span className="nt-badge">ESTRUCTURA CLARA</span>
          <h2 className="nt-title">
            3 Entrenamientos por semana. <br />
            <span className="nt-highlight">Claridad absoluta antes de empezar.</span>
          </h2>
          <p className="nt-subtitle">
            Sin improvisaciones ni rutinas confusas. Una estructura semanal que te permite organizarte, 
            asistir a clases en vivo y recuperar cualquier sesión que no alcances a realizar.
          </p>
        </div>

        {/* 3 Days Grid */}
        <div className="schedule-grid">
          {schedule.map((item, idx) => (
            <div key={idx} className="nt-card schedule-card">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span className="schedule-day-badge">{item.badge}</span>
                  {item.icon}
                </div>
                <h3>{item.day}</h3>
                <div className="schedule-card-time">
                  <Clock size={15} />
                  <span>{item.time}</span>
                </div>
                <p className="schedule-card-desc">{item.desc}</p>
              </div>
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--nt-border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--nt-text-muted)' }}>
                <CheckCircle2 size={15} style={{ color: 'var(--nt-pink)' }} />
                <span>Queda guardada en tu videoteca si no puedes asistir</span>
              </div>
            </div>
          ))}
        </div>

        {/* Clarity Pre-Workout Sample Card */}
        <div className="schedule-sample-workout">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--nt-radius-sm)', background: 'var(--nt-pink-soft)', color: 'var(--nt-pink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dumbbell size={22} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--nt-pink)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Claridad antes de presionar play
              </span>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF', margin: '0.15rem 0 0 0' }}>
                Fuerza Funcional & Core • 35 Minutos
              </h4>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ padding: '0.35rem 0.85rem', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--nt-radius-full)', fontSize: '0.8rem', color: 'var(--nt-text-secondary)' }}>
              Nivel: Inicial / Intermedio
            </span>
            <span style={{ padding: '0.35rem 0.85rem', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--nt-radius-full)', fontSize: '0.8rem', color: 'var(--nt-text-secondary)' }}>
              Implementos: Peso corporal o mancuernas ligeras
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
