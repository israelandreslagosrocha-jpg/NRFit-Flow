import React, { useState } from 'react';
import { Heart, Activity, Check, ArrowRight, UserCheck, ShieldCheck, HeartCrack, HelpCircle } from 'lucide-react';
import './PostParto.css';

export default function PostParto() {
  const [formData, setFormData] = useState({ name: '', weeks: '', type: 'cesarea' });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.weeks) {
      setIsSubmitted(true);
    }
  };

  const toggleFaq = (idx) => {
    setActiveFaq(activeFaq === idx ? null : idx);
  };

  const pillars = [
    { title: 'Reeducación del Transverso Abdominal', desc: 'Activación profunda del core profundo para recuperar el tono muscular de la faja abdominal sin aumentar la presión.', icon: <Activity className="pillar-icon-pink" /> },
    { title: 'Fortalecimiento de Suelo Pélvico', desc: 'Ejercicios específicos para tonificar la musculatura perineal, previniendo incontinencias y disfunciones.', icon: <Heart className="pillar-icon-pink" /> },
    { title: 'Control de la Diástasis Abdominal', desc: 'Rutinas orientadas al cierre fisiológico de la separación de los rectos abdominales post-embarazo.', icon: <ShieldCheck className="pillar-icon-pink" /> },
    { title: 'Progresión Segura Sin Impacto', desc: 'Cero saltos ni crunchs abdominales en las primeras fases. Ejercicios controlados de bajo impacto.', icon: <UserCheck className="pillar-icon-pink" /> }
  ];

  const faqs = [
    { q: '¿Cuándo puedo comenzar a entrenar después de dar a luz?', a: 'Por seguridad, debes contar con la autorización de tu ginecólogo o matrona. Por lo general, se sugiere esperar 6 semanas si fue parto vaginal, y entre 8 a 10 semanas si fue cesárea.' },
    { q: '¿El programa sirve si tuve cesárea?', a: 'Absolutamente. El programa cuenta con una fase especial de movilización de la cicatriz de la cesárea y ejercicios específicos para reconectar la faja abdominal que fue seccionada.' },
    { q: '¿Cómo son los entrenamientos?', a: 'Son clases grabadas en video de 20 a 30 minutos de duración. Están explicadas paso a paso por Naty para asegurar la postura y técnica correctas.' },
    { q: '¿Las rutinas afectan la lactancia?', a: 'En absoluto. Son entrenamientos progresivos de intensidad moderada que no interfieren en la producción ni calidad de la leche materna.' }
  ];

  return (
    <div className="postparto-page">
      {/* Hero Section */}
      <section className="postparto-hero">
        <div className="container grid-2 align-center">
          <div className="postparto-hero-text animate-fade-in">
            <span className="badge">PROGRAMA POST PARTO SEGURO</span>
            <h1 className="postparto-title">Recupera tu fuerza a tu propio ritmo.</h1>
            <p className="postparto-subtitle">
              Un programa seguro y progresivo diseñado para la recuperación del suelo pélvico, diástasis y tono abdominal tras el parto. Clases grabadas de corta duración para entrenar en casa.
            </p>
            <div className="warning-card-pink">
              <span className="warning-badge-pink">IMPORTANTE</span>
              <p>Clases 100% progresivas sin rebotes, saltos ni abdominales tradicionales de alto impacto.</p>
            </div>
          </div>

          <div className="postparto-hero-form animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {!isSubmitted ? (
              <div className="intake-card glass-card">
                <div className="intake-header">
                  <h3>Cuestionario de Ingreso</h3>
                  <p>Evalúa tu estado para recibir tu plan seguro</p>
                </div>
                <form onSubmit={handleSubmit} className="intake-form">
                  <div className="form-group">
                    <label className="form-label">Nombre Completo</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Tu nombre" 
                      required 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">¿Cuántas semanas post-parto tienes?</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder="Ej. 12" 
                      required 
                      value={formData.weeks}
                      onChange={(e) => setFormData({ ...formData, weeks: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo de Parto</label>
                    <select 
                      className="form-control"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="cesarea">Cesárea</option>
                      <option value="vaginal">Vaginal (Normal)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary btn-full">
                    ANALIZAR Y AGENDAR <ArrowRight size={18} />
                  </button>
                </form>
              </div>
            ) : (
              <div className="intake-success-card glass-card text-center">
                <div className="success-icon">✓</div>
                <h3>¡Evaluación Completada!</h3>
                <p style={{ margin: '15px 0', fontSize: '0.95rem' }}>
                  Hola <strong>{formData.name}</strong>, el sistema ha clasificado tu caso de <strong>{formData.weeks} semanas post-parto ({formData.type === 'cesarea' ? 'Cesárea' : 'Parto Normal'})</strong> como apto para la <strong>Fase 1 de Reactivación Core</strong>.
                </p>
                <div className="recommendation-strip">
                  <strong>Plan Recomendado:</strong> Post Parto Seguro ($22.000/mes)
                </div>
                <a href={`https://wa.me/56957144823?text=Hola,%20soy%20${formData.name}.%20Tengo%20${formData.weeks}%20semanas%20post-parto%20con%20${formData.type === 'cesarea' ? 'cesárea' : 'parto vaginal'}.%20Quiero%20comenzar%20el%20programa.`} target="_blank" rel="noreferrer" className="btn btn-primary btn-full">
                  ACTIVAR EN WHATSAPP
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pillars of Recovery */}
      <section className="section-padding bg-dark-secondary">
        <div className="container">
          <div className="text-center section-header">
            <span className="badge">REHABILITACIÓN Y FUERZA</span>
            <h2 className="section-title">Pilares de tu Recuperación</h2>
            <p className="section-subtitle">
              Cada fase está estructurada para rehabilitar la musculatura del core antes de entrenar con cargas.
            </p>
          </div>

          <div className="grid-2">
            {pillars.map((pillar, idx) => (
              <div key={idx} className="pillar-detail-card glass-card">
                <div className="pillar-header-row">
                  {pillar.icon}
                  <h3>{pillar.title}</h3>
                </div>
                <p>{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / CTA Section */}
      <section className="section-padding text-center">
        <div className="container" style={{ maxWidth: '600px' }}>
          <span className="badge">PRECIO ACCESIBLE</span>
          <h2 className="section-title" style={{ marginTop: '10px' }}>Inicia tu Recuperación Segura</h2>
          <div className="postparto-price-card glass-card" style={{ marginTop: '30px' }}>
            <h3>Membresía Mensual Post Parto</h3>
            <div className="price-number-pink">$22.000 <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ mes</span></div>
            <ul className="bullet-list-center" style={{ listStyle: 'none', margin: '20px 0', padding: 0 }}>
              <li>✓ Videoteca de clases grabadas (20-30 min)</li>
              <li>✓ Asesoría clínica de diástasis inicial</li>
              <li>✓ Guía de alimentación post parto en PDF</li>
              <li>✓ Canal exclusivo con matronas</li>
            </ul>
            <a href="https://wa.me/56957144823?text=Hola,%20quiero%20suscribirme%20a%20Post%20Parto%20Seguro" target="_blank" rel="noreferrer" className="btn btn-primary btn-full">
              SUSCRIBIRSE AL PROGRAMA
            </a>
          </div>
        </div>
      </section>

      {/* System specific FAQs */}
      <section className="section-padding bg-dark-secondary">
        <div className="container" style={{ maxWidth: '800px' }}>
          <div className="text-center section-header">
            <span className="badge">FAQ POST PARTO</span>
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
