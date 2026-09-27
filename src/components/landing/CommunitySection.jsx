import { CalendarDays, HeartHandshake, ShieldCheck, Sparkles } from 'lucide-react';

export default function CommunitySection() {
  const commitments = [
    { icon: <Sparkles size={20} />, eyebrow: 'A TU RITMO', title: 'Tu semana también cuenta.', desc: 'Entrena cuando puedas y retoma sin sentir que partes desde cero.' },
    { icon: <CalendarDays size={20} />, eyebrow: 'ESTRUCTURA CLARA', title: 'Cinco momentos para ti.', desc: 'Dos clases en vivo y tres rutinas grabadas, todas entre 10 y 40 minutos.' },
    { icon: <ShieldCheck size={20} />, eyebrow: 'GUÍA PROFESIONAL', title: 'Acompañada por Natalia.', desc: 'Una preparación cercana para entrenar con seguridad y criterio.' },
    { icon: <HeartHandshake size={20} />, eyebrow: 'SIN JUICIOS', title: 'Volver a intentarlo es avanzar.', desc: 'Aquí celebramos la constancia real, incluso en las semanas difíciles.' },
  ];

  return (
    <section id="comunidad" className="landing-section" style={{ background: '#FBE7EE' }}>
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

          {/* Community commitments, not unverified performance metrics */}
          <div className="community-grid-stats">
            {commitments.map((item, idx) => (
              <article key={idx} className="community-stat-item">
                <div className="community-stat-icon" aria-hidden="true">{item.icon}</div>
                <p className="community-stat-val">{item.eyebrow}</p>
                <h3 className="community-stat-lbl">{item.title}</h3>
                <p className="community-stat-desc">{item.desc}</p>
              </article>
            ))}
          </div>

          <p style={{ marginTop: '2rem', fontSize: '0.92rem', color: 'var(--nt-text-secondary)', fontStyle: 'italic' }}>
            “Aquí no competimos por quién tiene el cuerpo más delgado. Celebramos que hoy encontraste un momento para ti.”
          </p>

        </div>

      </div>
    </section>
  );
}
