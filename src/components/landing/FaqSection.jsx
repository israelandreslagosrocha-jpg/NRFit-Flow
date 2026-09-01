'use client';

import React, { useState } from 'react';

export default function FaqSection() {
  const [openIdx, setOpenIdx] = useState(null);

  const toggle = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  const faqs = [
    {
      q: "¿Necesito experiencia previa o haber entrenado antes?",
      a: "No. El sistema está pensado precisamente para mujeres que llevan tiempo sin entrenar o que nunca han tenido constancia. Cada movimiento se explica con progresiones desde nivel cero para que te sientas cómoda y segura desde tu primera clase."
    },
    {
      q: "¿Cuánto dura una clase?",
      a: "Las clases duran entre 20 y 60 minutos, dependiendo de la planificación semanal y tu nivel actual. Siempre verás la duración exacta y el nivel antes de presionar play para que puedas organizar tu tiempo con certeza."
    },
    {
      q: "¿Qué implementos necesito para comenzar?",
      a: "Puedes comenzar 100% con tu peso corporal y una botella de agua. Conforme vayas ganando fuerza, Natalia te sugerirá implementos sencillos y económicos como bandas elásticas o mancuernas ligeras para seguir progresando."
    },
    {
      q: "¿Qué ocurre si no puedo asistir al LIVE de los martes o jueves a las 20:00?",
      a: "No pasa nada. Todas las clases en vivo quedan grabadas y subidas a tu videoteca personal en la plataforma dentro de las 24 horas siguientes. Puedes hacerla al día siguiente en el horario que mejor se adapte a tu rutina."
    },
    {
      q: "¿Puedo hacer únicamente las clases grabadas a mi propio ritmo?",
      a: "¡Totalmente! Si tus horarios de trabajo o familia no coinciden con las sesiones en vivo, puedes realizar los entrenamientos grabados cuando quieras. El sistema registrará tu asistencia y constancia exactamente igual."
    },
    {
      q: "¿Desde qué nivel de condición física puedo comenzar?",
      a: "Desde el nivel en el que estés hoy. No necesitas ponerte en forma para empezar a entrenar con Naty; entrenas con Naty para ponerte en forma. Adaptamos las repeticiones, descansos y posturas a tu capacidad real."
    },
    {
      q: "¿Puedo entrenar desde cualquier ciudad o país?",
      a: "Sí. Nuestra plataforma es 100% online y accesible desde cualquier teléfono, tablet o computador con conexión a internet, en cualquier parte de Chile o el mundo."
    },
    {
      q: "¿Qué ocurre durante y después de los 7 días de prueba?",
      a: "Durante los 7 días tienes acceso completo a la plataforma, clases en vivo, grabadas y comunidad. Al terminar el período de prueba, si decides quedarte, se activa tu membresía con tu precio fundador de $25.000 CLP. Si cancelas antes de que terminen los 7 días, tu costo es $0."
    },
    {
      q: "¿Cuánto cuesta la membresía y qué incluye?",
      a: "El precio regular es de $29.000 CLP/mes, pero durante esta etapa de Primera Generación accedes al precio fundador de $25.000 CLP/mes. Incluye 3 entrenamientos semanales, videoteca completa, portal personal de alumna, comunidad Team Naty y soporte directo con Natalia."
    },
    {
      q: "¿Qué ocurre con mi precio fundador de $25.000 CLP si continúo?",
      a: "Lo mantienes de por vida mientras conserves tu membresía activa mes a mes. Nunca te subiremos el precio aunque el plan suba para nuevas alumnas."
    },
    {
      q: "¿Cómo funciona el sistema de recompensas y constancia?",
      a: "Premiamos tu adherencia, no tu peso en la báscula. Al sumar entrenamientos completados y mantener tus rachas semanales, desbloqueas insignias, cupones especiales y reconocimientos en el Team Naty."
    },
    {
      q: "¿Puedo cancelar mi membresía cuando quiera?",
      a: "Sí. Cero contratos forzados ni llamadas incómodas. Puedes pausar o cancelar tu suscripción con un solo clic directamente desde tu perfil en la plataforma en cualquier momento."
    }
  ];

  return (
    <section id="faq" className="landing-section" style={{ background: '#08080B' }}>
      <div className="landing-container">
        
        {/* Header */}
        <div className="nt-section-header">
          <span className="nt-badge">TRANSPARENCIA TOTAL</span>
          <h2 className="nt-title">
            Preguntas <span className="nt-highlight">Frecuentes</span>
          </h2>
          <p className="nt-subtitle">
            Resolvemos todas tus dudas antes de que des tu primer paso con nosotras.
          </p>
        </div>

        {/* 12 FAQs List */}
        <div className="faq-list">
          {faqs.map((faq, idx) => (
            <div key={idx} className={`faq-item ${openIdx === idx ? 'active' : ''}`}>
              <button 
                className="faq-trigger" 
                onClick={() => toggle(idx)}
                aria-expanded={openIdx === idx}
              >
                <span>{faq.q}</span>
                <span className="faq-icon-arrow">+</span>
              </button>
              {openIdx === idx && (
                <div className="faq-content">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
