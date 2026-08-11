'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, CheckCircle, Shield, Users, Smartphone, BarChart3, Award } from 'lucide-react';
import './Home.css';

export default function Home() {
  const [activeFaq, setActiveFaq] = useState(null);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const systems = [
    {
      title: 'Método 40/3',
      tag: '100% ONLINE',
      desc: 'El sistema más realista y sostenible. Entrena 40 minutos, 3 veces por semana desde casa con clases en vivo y biblioteca grabada.',
      price: '$22.000',
      period: 'mes',
      link: '/metodo-40-3',
      features: ['2 Clases en vivo por Zoom semanales', 'Biblioteca VOD con 100+ rutinas', 'Planificador de hábitos y nutrición', 'Comunidad de apoyo integrada'],
      icon: <Smartphone className="system-card-icon" />
    },
    {
      title: 'Entrenamiento Presencial',
      tag: 'LOCAL - TEODORO SCHMIDT',
      desc: 'Entrenamiento personalizado y de fuerza grupal en nuestro Box Central. Monitoreo de sobrecarga progresiva y aforo limitado.',
      price: '$120.000',
      period: 'trimestre',
      link: '/presencial',
      features: ['Bloques horarios a elección', 'Evaluación antropométrica presencial', 'Monitoreo de marcas (RM/PR)', 'Seguimiento VIP por Naty'],
      icon: <Users className="system-card-icon" />
    },
    {
      title: 'Post Parto Seguro',
      tag: 'ESPECIALIZADO - ONLINE',
      desc: 'Recupera tu cuerpo de forma progresiva después del embarazo. Enfocado en la reeducación del abdomen y suelo pélvico sin riesgos.',
      price: '$22.000',
      period: 'mes',
      link: '/post-parto',
      features: ['Rutinas guiadas de 20-30 min', 'Especialistas en suelo pélvico', 'Acceso ilimitado a videoteca', 'Acompañamiento personalizado'],
      icon: <Shield className="system-card-icon" />
    }
  ];

  const faqs = [
    {
      q: '¿Cómo sé qué sistema de entrenamiento es el adecuado para mí?',
      a: 'Si buscas flexibilidad horaria y entrenar desde la comodidad de tu hogar, el Método 40/3 es ideal. Si vives en Teodoro Schmidt y buscas entrenar con cargas reales y asesoría presencial, te sugerimos Entrenamiento Presencial. Si fuiste madre recientemente (y tienes el alta médica), Post Parto Seguro es tu mejor punto de partida.'
    },
    {
      q: '¿Necesito comprar equipamiento deportivo antes de empezar?',
      a: 'Para el Método 40/3 y Post Parto Seguro puedes empezar con peso corporal. Más adelante, Naty te guiará para incorporar implementos ligeros como bandas elásticas o mancuernas. Para las clases presenciales, todo el equipamiento está incluido en nuestro Box Central.'
    },
    {
      q: '¿Cómo se maneja la renovación de los planes?',
      a: 'Nuestros sistemas funcionan con suscripciones mensuales o trimestrales recurrentes. Puedes gestionarlas, pausarlas o cancelarlas cuando quieras desde el perfil de tu cuenta en la plataforma de manera autónoma.'
    },
    {
      q: '¿Puedo cambiar de sistema de entrenamiento en el camino?',
      a: '¡Por supuesto! Toda tu información de progreso y cuenta se unifica en la base de datos de la plataforma (NR Fit & Flow), permitiendo la transición entre programas sin perder tus métricas.'
    }
  ];

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        {/* Background Video Overlay */}
        <div className="hero-video-container">
          <video 
            src="https://res.cloudinary.com/dhgifjpkh/video/upload/v1774498942/gap_1_m9t9xn.mp4" 
            autoPlay 
            muted 
            loop 
            playsInline 
            className="hero-video-bg"
          />
          <div className="hero-video-overlay" />
        </div>

        <div className="container hero-layout">
          <div className="hero-text-col animate-fade-in">
            <span className="badge">Ecosistema NR Fit & Flow</span>
            <h1 className="hero-title">
              Tu cuerpo no necesita más rutinas.<br />
              <span className="highlight">Necesita un sistema.</span>
            </h1>
            <p className="hero-desc">
              Accede a la plataforma digital fitness de **Naty Entrenadora**. Sistemas de entrenamiento diseñados para mujeres que buscan resultados reales mediante tecnología, acompañamiento y comunidad.
            </p>
            <div className="hero-cta-group">
              <a href="#sistemas" className="btn btn-primary btn-lg">
                EXPLORAR SISTEMAS <ArrowRight size={18} />
              </a>
              <a href="#ecosistema" className="btn btn-secondary btn-lg">
                CÓMO FUNCIONA
              </a>
            </div>
            
            {/* Trust Badges */}
            <div className="hero-trust-indicators">
              <div className="trust-item">
                <CheckCircle size={16} className="trust-icon" /> +200 Alumnas Activas
              </div>
              <div className="trust-item">
                <CheckCircle size={16} className="trust-icon" /> Preparación Física Certificada
              </div>
            </div>
          </div>

          {/* Premium UI Mockup Column */}
          <div className="hero-mockup-col animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="dashboard-mockup glass-card">
              <div className="mockup-header">
                <div className="mockup-dots">
                  <span className="dot red"></span>
                  <span className="dot yellow"></span>
                  <span className="dot green"></span>
                </div>
                <div className="mockup-title">Ana M. — Mi Progreso</div>
              </div>
              
              <div className="mockup-body">
                {/* Metrics row */}
                <div className="mockup-metrics">
                  <div className="mockup-metric-box">
                    <span className="metric-label">Asistencia</span>
                    <span className="metric-value">86%</span>
                    <div className="metric-bar"><div className="metric-progress" style={{ width: '86%' }}></div></div>
                  </div>
                  <div className="mockup-metric-box">
                    <span className="metric-label">Peso Actual</span>
                    <span className="metric-value">62 kg</span>
                    <span className="metric-sub text-green">↓ 3 kg</span>
                  </div>
                  <div className="mockup-metric-box">
                    <span className="metric-label">Racha Activa</span>
                    <span className="metric-value">8 Clases</span>
                    <span className="metric-sub highlight">🔥 Imparable</span>
                  </div>
                </div>

                {/* Graph representation */}
                <div className="mockup-graph-box">
                  <div className="graph-y-axis">
                    <span>65kg</span>
                    <span>63kg</span>
                    <span>61kg</span>
                  </div>
                  <div className="graph-area">
                    {/* Mock SVG Line Chart */}
                    <svg viewBox="0 0 300 80" className="mockup-svg-line">
                      <path 
                        d="M 10 60 Q 75 40 150 45 T 290 15" 
                        fill="none" 
                        stroke="var(--primary)" 
                        strokeWidth="3" 
                      />
                      <circle cx="290" cy="15" r="5" fill="var(--primary)" />
                    </svg>
                    <div className="graph-x-axis">
                      <span>08 May</span>
                      <span>22 May</span>
                      <span>05 Jun</span>
                    </div>
                  </div>
                </div>

                {/* Bottom quote */}
                <div className="mockup-footer-note">
                  <Award size={16} className="highlight" /> Logro Desbloqueado: Racha de 3 semanas completadas
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sistemas de Entrenamiento Grid */}
      <section id="sistemas" className="section-padding systems-section">
        <div className="container">
          <div className="text-center section-header">
            <span className="badge">PROGRAMAS DE ENTRENAMIENTO</span>
            <h2 className="section-title">Elige tu Sistema de Transformación</h2>
            <p className="section-subtitle">
              Cada programa posee su propio embudo, dashboard de alumna, contenido y acompañamiento especializado.
            </p>
          </div>

          <div className="grid-3">
            {systems.map((sys, idx) => (
              <div key={idx} className="system-card glass-card">
                <div className="system-card-header">
                  {sys.icon}
                  <span className="system-card-tag">{sys.tag}</span>
                </div>
                <h3 className="system-card-title">{sys.title}</h3>
                <p className="system-card-desc">{sys.desc}</p>
                
                <div className="system-card-price">
                  <span className="price-num">{sys.price}</span>
                  <span className="price-period">/ {sys.period}</span>
                </div>

                <ul className="system-card-features">
                  {sys.features.map((feat, fidx) => (
                    <li key={fidx} className="feat-item">
                      <CheckCircle size={16} className="feat-icon" /> {feat}
                    </li>
                  ))}
                </ul>

                <Link href={sys.link} className="btn btn-secondary btn-full system-card-btn">
                  EXPLORAR SISTEMA <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ecosistema Tecnológico (Why Us) */}
      <section id="ecosistema" className="section-padding ecosystem-section">
        <div className="container grid-2 align-center">
          <div className="ecosystem-text-col">
            <span className="badge">TECNOLOGÍA FITNESS</span>
            <h2 className="section-title">Una Plataforma Completa a tu Servicio</h2>
            <p className="section-subtitle">
              Naty Entrenadora no vende solo videos pregrabados. Proporciona un ecosistema integrado (NR Fit & Flow) para que nunca abandones el entrenamiento.
            </p>

            <div className="eco-feature-list">
              <div className="eco-feature-item">
                <div className="eco-icon-box"><Smartphone size={24} /></div>
                <div>
                  <h4>Dashboard Personalizado de Alumna</h4>
                  <p>Accede a tus gráficos de peso, medidas corporales, reservas de clases, y rutinas grabadas VOD desde cualquier dispositivo.</p>
                </div>
              </div>
              
              <div className="eco-feature-item">
                <div className="eco-icon-box"><BarChart3 size={24} /></div>
                <div>
                  <h4>Monitoreo Antropométrico y de Fuerza</h4>
                  <p>Guarda tus avances clínicos e iniciales (RM, PR, lesiones) para entrenar con total seguridad y sobrecarga progresiva dirigida.</p>
                </div>
              </div>

              <div className="eco-feature-item">
                <div className="eco-icon-box"><Users size={24} /></div>
                <div>
                  <h4>Control de Asistencia y Aforo</h4>
                  <p>Para clases en el Box Central, reserva tus horarios con un clic, confirmando tu asistencia de forma automática.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="ecosystem-image-col">
            <div className="interactive-preview glass-card">
              <div className="preview-label">Dashboard Administrativo Central</div>
              <h4 style={{ marginBottom: '15px' }}>Todo tu negocio en un solo panel</h4>
              <ul className="preview-list">
                <li><i className="fa-solid fa-circle-check text-pink"></i> Control de aforo y asistencias</li>
                <li><i className="fa-solid fa-circle-check text-pink"></i> Gestión de renovaciones y cobros automáticos</li>
                <li><i className="fa-solid fa-circle-check text-pink"></i> Comunicaciones masivas vía WhatsApp e Email</li>
                <li><i className="fa-solid fa-circle-check text-pink"></i> Reportes financieros en tiempo real</li>
              </ul>
              <div className="preview-metrics-strip">
                <div className="strip-item">
                  <span className="strip-val">$1.250M</span>
                  <span className="strip-lbl">Ingresos Mes</span>
                </div>
                <div className="strip-item">
                  <span className="strip-val">42</span>
                  <span className="strip-lbl">Activas Presencial</span>
                </div>
                <div className="strip-item">
                  <span className="strip-val">78%</span>
                  <span className="strip-lbl">Asistencias Promedio</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* E-E-A-T (Confianza y Natalia Riquelme) */}
      <section className="section-padding eeat-section">
        <div className="container grid-2 align-center">
          <div className="eeat-image-col">
            <div className="profile-card glass-card text-center">
              <img 
                src="https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/Copia_de_NR_logo_image_efdt04.png" 
                alt="Natalia Riquelme" 
                className="profile-img"
              />
              <h3>Natalia Riquelme</h3>
              <p className="highlight">Fundadora & Entrenadora Principal</p>
              <div className="badges-row">
                <span className="badge-sm">Preparadora Física</span>
                <span className="badge-sm">Fuerza & Post Parto</span>
              </div>
            </div>
          </div>

          <div className="eeat-text-col">
            <span className="badge">AUTORIDAD Y CONFIANZA</span>
            <h2 className="section-title">Acompañamiento Profesional Respaldado</h2>
            <p>
              Natalia Riquelme es Preparadora Física certificada con especializaciones en entrenamiento de fuerza femenino, hipertrofia y acondicionamiento en el periodo post parto.
            </p>
            <p style={{ marginTop: '15px' }}>
              Su metodología se basa en la ciencia del ejercicio y la fisiología aplicada a la mujer real, alejándose de las rutinas extremas e insostenibles. Con el ecosistema **NR Fit & Flow**, Natalia realiza un seguimiento detallado del progreso de cada alumna de forma automatizada y personalizada.
            </p>
            <div className="credentials-list">
              <div className="credential"><Award size={18} className="highlight" /> Certificación en Entrenamiento de Fuerza Femenino</div>
              <div className="credential"><Award size={18} className="highlight" /> Especialista en Prescripción del Ejercicio en Post Parto</div>
              <div className="credential"><Award size={18} className="highlight" /> Fundadora del Box Central Teodoro Schmidt</div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="section-padding testimonials-section">
        <div className="container">
          <div className="text-center section-header">
            <span className="badge">TESTIMONIOS DE ALUMNAS</span>
            <h2 className="section-title">Mujeres Reales, Resultados Sostenibles</h2>
            <p className="section-subtitle">Descubre cómo nuestra plataforma ha transformado la vida y rutina diaria de nuestras alumnas.</p>
          </div>

          <div className="grid-3">
            <div className="testimonial-card-react glass-card">
              <div className="stars">★★★★★</div>
              <p className="test-quote">"No tenía tiempo para nada y este método me cambió. Entreno desde casa en 40 minutos y me siento con mucha más energía y firmeza."</p>
              <div className="test-user">
                <img src="https://ui-avatars.com/api/?name=Camila+R&background=E91E63&color=fff" alt="Camila" className="avatar" />
                <div>
                  <h4>Camila R.</h4>
                  <span>31 años — Método 40/3</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card-react glass-card">
              <div className="stars">★★★★★</div>
              <p className="test-quote">"El sistema presencial en Teodoro Schmidt es excelente. El aforo controlado y el box son de primer nivel. El control de mis pesos me motiva."</p>
              <div className="test-user">
                <img src="https://ui-avatars.com/api/?name=Daniela+M&background=E91E63&color=fff" alt="Daniela" className="avatar" />
                <div>
                  <h4>Daniela M.</h4>
                  <span>28 años — Presencial</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card-react glass-card">
              <div className="stars">★★★★★</div>
              <p className="test-quote">"Volver a moverme tras el embarazo me daba miedo. Post Parto Seguro me dio la confianza para reeducar mi abdomen con ejercicios seguros."</p>
              <div className="test-user">
                <img src="https://ui-avatars.com/api/?name=Valentina+P&background=E91E63&color=fff" alt="Valentina" className="avatar" />
                <div>
                  <h4>Valentina P.</h4>
                  <span>34 años — Post Parto</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="section-padding faq-section">
        <div className="container" style={{ maxWidth: '800px' }}>
          <div className="text-center section-header">
            <span className="badge">PREGUNTAS FRECUENTES</span>
            <h2 className="section-title">Resolvemos tus Dudas</h2>
            <p className="section-subtitle">Todo lo que necesitas saber sobre el ecosistema de entrenamiento.</p>
          </div>

          <div className="faq-accordion">
            {faqs.map((faq, index) => (
              <div key={index} className={`faq-item-react ${activeFaq === index ? 'active' : ''}`}>
                <button className="faq-question-btn" onClick={() => toggleFaq(index)}>
                  <span>{faq.q}</span>
                  <span className="faq-icon-arrow">{activeFaq === index ? '−' : '+'}</span>
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
