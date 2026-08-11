'use client';

import React, { useState } from 'react';
import { Calendar, Clock, MapPin, CheckCircle, ArrowRight, Info, AlertTriangle } from 'lucide-react';
import './Presencial.css';

export default function Presencial() {
  const [selectedClass, setSelectedClass] = useState(null);
  const [bookingName, setBookingName] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const classes = [
    { id: 1, time: '06:00 AM - 07:00 AM', name: 'Fuerza + Hipertrofia', spots: 8, totalSpots: 20 },
    { id: 2, time: '07:00 AM - 08:00 AM', name: 'HIIT Metabólico', spots: 3, totalSpots: 20 },
    { id: 3, time: '06:00 PM - 07:00 PM', name: 'Glúteos + Pierna', spots: 0, totalSpots: 20 },
    { id: 4, time: '07:00 PM - 08:00 PM', name: 'Full Body', spots: 12, totalSpots: 20 }
  ];

  const handleBooking = (e) => {
    e.preventDefault();
    if (bookingName && selectedClass) {
      setBookingSuccess(true);
    }
  };

  const handleClassSelection = (cls) => {
    if (cls.spots > 0) {
      setSelectedClass(cls);
      setBookingSuccess(false);
    }
  };

  return (
    <div className="presencial-page">
      {/* Hero Section */}
      <section className="presencial-hero">
        <div className="container grid-2 align-center">
          <div className="presencial-hero-text animate-fade-in">
            <span className="badge">ENTRENAMIENTO LOCAL — TEODORO SCHMIDT</span>
            <h1 className="presencial-title">Entrena con propósito. Vive con fuerza.</h1>
            <p className="presencial-subtitle">
              Sistemas de entrenamiento presencial y de sobrecarga progresiva en nuestro **Box Central**. Planes con aforo controlado de máximo 20 personas por bloque, evaluaciones de composición corporal y supervisión constante.
            </p>
            <div className="presencial-location-banner">
              <MapPin size={18} className="highlight" />
              <span>Teodoro Schmidt, Región de La Araucanía, Chile</span>
            </div>
          </div>

          <div className="presencial-hero-form animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="booking-mockup-card glass-card">
              <div className="booking-header">
                <h3>Reserva de Bloque Presencial</h3>
                <p>Simula tu agendamiento en el Box Central</p>
              </div>

              {!bookingSuccess ? (
                <form onSubmit={handleBooking} className="booking-form">
                  <div className="form-group">
                    <label className="form-label">Elige un Bloque Horario</label>
                    <div className="classes-list-booking">
                      {classes.map((cls) => {
                        const isSelected = selectedClass?.id === cls.id;
                        const isFull = cls.spots === 0;
                        return (
                          <div 
                            key={cls.id} 
                            className={`class-booking-row ${isSelected ? 'selected' : ''} ${isFull ? 'full' : ''}`}
                            onClick={() => handleClassSelection(cls)}
                          >
                            <div className="class-row-info">
                              <span className="class-time"><Clock size={14} /> {cls.time}</span>
                              <span className="class-name">{cls.name}</span>
                            </div>
                            <div className="class-row-spots">
                              {isFull ? (
                                <span className="spots-tag full-spots">LLENO</span>
                              ) : (
                                <span className="spots-tag">{cls.spots} cupos</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tu Nombre</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Ingresa tu nombre para agendar" 
                      required 
                      value={bookingName}
                      onChange={(e) => setBookingName(e.target.value)}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary btn-full"
                    disabled={!selectedClass}
                  >
                    AGENDAR EVALUACIÓN <ArrowRight size={18} />
                  </button>
                </form>
              ) : (
                <div className="booking-success-wrapper text-center">
                  <div className="success-icon">✓</div>
                  <h3>¡Reserva Confirmada!</h3>
                  <p style={{ margin: '15px 0', fontSize: '0.95rem' }}>
                    Hola <strong>{bookingName}</strong>, hemos reservado tu bloque de las <strong>{selectedClass.time}</strong> ({selectedClass.name}) en nuestro Box Central para tu evaluación antropométrica inicial.
                  </p>
                  <div className="success-note">
                    <Info size={16} className="highlight" /> Recuerda llegar 5 minutos antes y llevar ropa deportiva cómoda.
                  </div>
                  <button onClick={() => setBookingSuccess(false)} className="btn btn-secondary btn-full">
                    Agendar otra hora
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Box Central Pillars */}
      <section className="section-padding bg-dark-secondary">
        <div className="container">
          <div className="text-center section-header">
            <span className="badge">NUESTROS PILARES EN EL BOX</span>
            <h2 className="section-title">¿Qué hace único a nuestro Box Central?</h2>
            <p className="section-subtitle">
              Un enfoque centrado en la técnica, aforo limitado, y sobrecarga progresiva real.
            </p>
          </div>

          <div className="grid-3">
            <div className="eco-feature-item glass-card">
              <div className="eco-icon-box"><Calendar size={24} /></div>
              <div>
                <h4>Aforo Controlado por Bloque</h4>
                <p>Garantizamos un máximo de 20 alumnas por hora. Entrena sin aglomeraciones, con espacio suficiente y atención personalizada del entrenador.</p>
              </div>
            </div>

            <div className="eco-feature-item glass-card">
              <div className="eco-icon-box"><CheckCircle size={24} /></div>
              <div>
                <h4>Evaluaciones Antropométricas</h4>
                <p>Monitoreamos de manera mensual tus perímetros, porcentajes de grasa y masa muscular para ajustar la nutrición y cargas.</p>
              </div>
            </div>

            <div className="eco-feature-item glass-card">
              <div className="eco-icon-box"><MapPin size={24} /></div>
              <div>
                <h4>Ubicación Local en Teodoro Schmidt</h4>
                <p>En el corazón de Teodoro Schmidt, un espacio cómodo, limpio y equipado con racks de fuerza profesionales para el entrenamiento femenino.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="section-padding">
        <div className="container">
          <div className="text-center section-header">
            <span className="badge">PLANES Y MEMBRESÍAS</span>
            <h2 className="section-title">Comienza en el Box Central</h2>
            <p className="section-subtitle">Planes de membresía adaptados para tu constancia.</p>
          </div>

          <div className="grid-2" style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* Plan 1 */}
            <div className="pricing-box-react glass-card">
              <span className="pricing-tag">RECOMENDADO</span>
              <h3>Plan Trimestral Presencial VIP</h3>
              <p className="pricing-desc">El plan definitivo para una transformación real con acompañamiento clínico.</p>
              <div className="pricing-price">
                <span className="price-val">$120.000</span>
                <span className="price-lbl">/ trimestre</span>
              </div>
              <ul className="pricing-bullets-react">
                <li><CheckCircle size={16} className="highlight" /> Acceso a 4 clases semanales en Box</li>
                <li><CheckCircle size={16} className="highlight" /> 3 Evaluaciones físicas antropométricas</li>
                <li><CheckCircle size={16} className="highlight" /> Monitoreo clínico de lesiones</li>
                <li><CheckCircle size={16} className="highlight" /> Acceso VOD gratuito en la App</li>
              </ul>
              <a href="https://wa.me/56957144823?text=Hola,%20quiero%20el%20Plan%20Trimestral%20VIP" target="_blank" rel="noreferrer" className="btn btn-primary btn-full">
                COMPRAR PLAN VIP
              </a>
            </div>

            {/* Plan 2 */}
            <div className="pricing-box-react glass-card">
              <h3>Plan Mensual Presencial Plus</h3>
              <p className="pricing-desc">Perfecto para quienes buscan flexibilidad y quieren entrenar fuerza mes a mes.</p>
              <div className="pricing-price">
                <span className="price-val">$45.000</span>
                <span className="price-lbl">/ mes</span>
              </div>
              <ul className="pricing-bullets-react">
                <li><CheckCircle size={16} className="highlight" /> Acceso a 3 clases semanales en Box</li>
                <li><CheckCircle size={16} className="highlight" /> 1 Evaluación física antropométrica</li>
                <li><CheckCircle size={16} className="highlight" /> Soporte por grupo de WhatsApp</li>
                <li><CheckCircle size={16} className="highlight" /> Acceso VOD a mitad de precio</li>
              </ul>
              <a href="https://wa.me/56957144823?text=Hola,%20quiero%20el%20Plan%20Mensual%20Plus" target="_blank" rel="noreferrer" className="btn btn-secondary btn-full">
                COMPRAR PLAN PLUS
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Safety Alert (Prevenir Lesiones) */}
      <section className="section-padding bg-dark-secondary safety-section">
        <div className="container" style={{ maxWidth: '800px' }}>
          <div className="safety-card glass-card">
            <AlertTriangle size={32} className="safety-alert-icon" />
            <h3>Tu seguridad es nuestra prioridad número uno</h3>
            <p>
              Antes de que cargues tu primer peso, nuestro equipo realiza un análisis clínico de lesiones y rango de movilidad. Si presentas dolores lumbares, de rodilla o venías de una cesárea, adaptamos cada movimiento para asegurar tu progreso sin recaídas.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
