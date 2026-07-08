import React, { useState } from 'react';
import { Play, Check, HelpCircle, ArrowRight, ShieldAlert, Gift, MessageCircle } from 'lucide-react';
import './Metodo403.css';

export default function Metodo403() {
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.email) {
      setIsSubmitted(true);
    }
  };

  const toggleFaq = (idx) => {
    setActiveFaq(activeFaq === idx ? null : idx);
  };

  const benefits = [
    { title: '40 Minutos de Sesión', desc: 'Rutinas eficientes diseñadas científicamente para acelerar el metabolismo en poco tiempo.', icon: '⚡' },
    { title: '3 Veces por Semana', desc: 'No necesitas matarte entrenando todos los días. 3 estímulos semanales bastan para tonificar.', icon: '📅' },
    { title: 'Desde Casa o Viaje', desc: 'Sin traslados ni pérdidas de tiempo. Solo enciende tu celular, tablet o laptop y entrena.', icon: '🏠' },
    { title: 'Plan Sostenible', desc: 'Variedad de ejercicios que evitan el aburrimiento y se adaptan a tu nivel físico inicial.', icon: '🌱' }
  ];

  const painPoints = [
    { title: 'Falta crónica de tiempo', desc: 'Trabajas, cuidas a tu familia y el día se va volando sin un espacio para ti.' },
    { title: 'Estrés y fatiga mental', desc: 'El cansancio diario drena tu energía y tu cuerpo resiente la falta de movimiento.' },
    { title: 'El ciclo de "empezar y abandonar"', desc: 'Has comprado membresías que no usas porque las rutinas son aburridas o extremas.' },
    { title: 'Desorientación técnica', desc: 'No sabes qué ejercicios hacer ni cómo hacerlos sin lesionarte.' }
  ];

  const faqs = [
    { q: '¿Necesito experiencia previa en el gimnasio?', a: 'Para nada. Cada ejercicio se explica con progresiones (versiones más sencillas) y regresiones (versiones más complejas) para que puedas avanzar a tu propio ritmo.' },
    { q: '¿Qué equipamiento básico requiero?', a: 'Puedes iniciar 100% con peso corporal. A medida que ganes fuerza, te sugerimos comprar un par de mancuernas ajustables y un set de mini-bandas elásticas.' },
    { q: '¿Qué pasa si me pierdo una clase en vivo?', a: 'Todas nuestras transmisiones en vivo se graban en HD y se suben a tu Dashboard Alumna antes de 2 horas. Podrás repetirlas cuando quieras.' },
    { q: '¿Hay contratos a largo plazo?', a: 'No. El plan se cobra mensualmente. Puedes cancelar o congelar tu membresía de forma autónoma desde tu panel de usuario sin penalizaciones.' }
  ];

  return (
    <div className="metodo-page">
      {/* Hero Section */}
      <section className="metodo-hero">
        <div className="container grid-2 align-center">
          <div className="metodo-hero-text">
            <span className="badge">MÉTODO 40/3 — ENTRENAMIENTO ONLINE</span>
            <h1 className="metodo-title">Tonifica tu cuerpo en 40 minutos desde casa.</h1>
            <p className="metodo-subtitle">
              El sistema de entrenamiento diseñado para mujeres ocupadas. Entrena solo 3 veces por semana con clases guiadas que sí puedes sostener a largo plazo.
            </p>
            <ul className="metodo-hero-bullets">
              <li><Check size={16} className="bullet-icon" /> 2 Clases en vivo por Zoom + 1 Clase grabada semanal.</li>
              <li><Check size={16} className="bullet-icon" /> Acceso inmediato a la biblioteca privada VOD.</li>
              <li><Check size={16} className="bullet-icon" /> Soporte personalizado por WhatsApp directo con Naty.</li>
            </ul>
          </div>

          <div className="metodo-hero-form">
            {!isSubmitted ? (
              <div className="checkout-card glass-card">
                <div className="card-header-pink">
                  <h3>PRECIO LANZAMIENTO</h3>
                  <p className="urgency-tag">Solo 10 cupos disponibles</p>
                </div>
                <div className="price-strip">
                  <span className="price-old">$30.000</span>
                  <span className="price-new">$22.000<span className="period">/mes</span></span>
                </div>
                <form onSubmit={handleSubmit} className="signup-form">
                  <div className="form-group">
                    <label className="form-label">Nombre Completo</label>
                    <input 
                      type="text" 
                      name="name" 
                      className="form-control" 
                      placeholder="Ej. Camila Rodríguez" 
                      required 
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Correo Electrónico</label>
                    <input 
                      type="email" 
                      name="email" 
                      className="form-control" 
                      placeholder="Ej. camila@email.com" 
                      required 
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-full">
                    RESERVAR MI CUPO <ArrowRight size={18} />
                  </button>
                </form>
                <p className="form-footer-text">
                  🔒 Pago seguro. Cancela en cualquier momento con un clic.
                </p>
              </div>
            ) : (
              <div className="checkout-success-card glass-card text-center">
                <div className="success-icon">✓</div>
                <h3>¡Cupo Reservado, {formData.name}!</h3>
                <p style={{ margin: '15px 0' }}>
                  Hemos enviado las credenciales de acceso a tu correo <strong>{formData.email}</strong> para ingresar a tu Dashboard Alumna.
                </p>
                <div className="success-next-steps">
                  <h4>Siguientes pasos:</h4>
                  <ul>
                    <li>1. Revisa tu bandeja de entrada (y spam).</li>
                    <li>2. Descarga la Guía de Bienvenida adjunta.</li>
                    <li>3. Conéctate a tu primera sesión.</li>
                  </ul>
                </div>
                <a href="https://wa.me/56957144823" target="_blank" rel="noreferrer" className="btn btn-secondary btn-full">
                  <MessageCircle size={18} /> Escríbeme por WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pain Point Analysis */}
      <section className="section-padding bg-dark-secondary">
        <div className="container">
          <div className="text-center section-header">
            <span className="badge">¿TE SIENTES IDENTIFICADA?</span>
            <h2 className="section-title">Sabemos por qué has abandonado antes</h2>
            <p className="section-subtitle">
              El fitness tradicional está diseñado para personas con horas libres. El Método 40/3 está pensado para la vida real.
            </p>
          </div>

          <div className="grid-2">
            {painPoints.map((point, idx) => (
              <div key={idx} className="pain-card glass-card">
                <div className="pain-icon-wrapper">
                  <ShieldAlert size={20} className="pain-icon" />
                </div>
                <div>
                  <h3 className="pain-card-title">{point.title}</h3>
                  <p className="pain-card-desc">{point.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* System Pillars */}
      <section className="section-padding">
        <div className="container">
          <div className="text-center section-header">
            <span className="badge">CÓMO FUNCIONA EL MÉTODO</span>
            <h2 className="section-title">Entrenamiento Realista. Resultados Reales.</h2>
            <p className="section-subtitle">
              Dividido en pilares enfocados para optimizar tu tiempo al máximo.
            </p>
          </div>

          <div className="grid-4">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="pillar-card glass-card text-center">
                <span className="pillar-emoji">{benefit.icon}</span>
                <h3 className="pillar-title">{benefit.title}</h3>
                <p className="pillar-desc">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bonus / Lead Magnet Section */}
      <section className="section-padding bg-dark-secondary bonus-section">
        <div className="container">
          <div className="bonus-box glass-card">
            <div className="bonus-content-layout">
              <div className="bonus-text">
                <span className="bonus-label"><Gift size={16} /> ¡REGALO EXCLUSIVO INCLUIDO!</span>
                <h2 className="bonus-title">Guía rápida: Cómo entrenar desde casa y no abandonar</h2>
                <p className="bonus-desc">
                  Al inscribirte hoy, recibirás de forma gratuita nuestra guía interactiva en PDF con técnicas de mentalidad y checklists de hábitos para sostener tu constancia en las primeras 4 semanas.
                </p>
              </div>
              <div className="bonus-mockup">
                <div className="pdf-mockup">
                  <span className="pdf-tag">PDF</span>
                  <div className="pdf-title">Guía de Constancia</div>
                  <div className="pdf-bar"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section-padding">
        <div className="container" style={{ maxWidth: '800px' }}>
          <div className="text-center section-header">
            <span className="badge">PREGUNTAS DEL SISTEMA</span>
            <h2 className="section-title">Preguntas Frecuentes</h2>
          </div>

          <div className="faq-accordion">
            {faqs.map((faq, idx) => (
              <div key={idx} className={`faq-item-react ${activeFaq === idx ? 'active' : ''}`}>
                <button className="faq-question-btn" onClick={() => toggleFaq(idx)}>
                  <span>{faq.q}</span>
                  <span className="faq-icon-arrow">{activeFaq === idx ? '−' : '+'}</span>
                </button>
                <div className="faq-answer-container">
                  <div className="faq-answer-content">
                    <p>{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
