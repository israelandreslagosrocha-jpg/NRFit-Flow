import { Bell, Calendar, Play, Video } from 'lucide-react';

export default function DashboardPreviewSection() {
  return (
    <section id="plataforma" className="landing-section" style={{ background: '#070709' }}>
      <div className="landing-container">
        <div className="nt-section-header">
          <span className="nt-badge">TECNOLOGÍA A TU SERVICIO</span>
          <h2 className="nt-title">
            Mucho más que videos. <br />
            <span className="nt-highlight">Tu plataforma personal de constancia.</span>
          </h2>
          <p className="nt-subtitle">
            Entrena, revisa tu semana y recibe los avisos importantes sin tener que empezar de cero cada vez.
          </p>
        </div>

        <div className="dashboard-preview-card" aria-label="Vista demostrativa del portal de alumna">
          <div className="dash-mock-topbar">
            <div className="dash-mock-user">
              <div className="dash-mock-avatar">NR</div>
              <div>
                <h3>Portal de Alumna · Team Naty</h3>
                <span>Una vista simple de tu semana</span>
              </div>
            </div>
            <span className="dash-preview-label">VISTA DEMOSTRATIVA</span>
          </div>

          <div className="dash-mock-grid dash-preview-grid">
            <article className="dash-mock-box dash-live-card">
              <p className="dash-card-eyebrow"><span className="live-pulse-dot" /> EN VIVO CON NATALIA</p>
              <h3>Sesiones Zoom desde tu portal</h3>
              <p>La fecha, horario y enlace de cada sesión se publican en tu cuenta cuando Natalia los programa.</p>
              <span className="dash-demo-action"><Play size={15} fill="currentColor" /> Acceso protegido para alumnas</span>
            </article>

            <article className="dash-mock-box">
              <p className="dash-card-eyebrow"><Calendar size={15} /> TU SEMANA</p>
              <h3>Una ruta clara, sin adivinar qué toca hoy</h3>
              <div className="dash-demo-week" aria-hidden="true">
                <div><span>1</span><strong>Grabado</strong></div>
                <div><span>2</span><strong>En vivo</strong></div>
                <div><span>3</span><strong>Grabado</strong></div>
                <div><span>4</span><strong>En vivo</strong></div>
                <div><span>5</span><strong>Grabado</strong></div>
              </div>
              <p>Dos sesiones en vivo y tres grabadas aparecen ordenadas dentro de tu portal.</p>
            </article>

            <article className="dash-mock-box">
              <p className="dash-card-eyebrow"><Video size={15} /> VIDEOTECA</p>
              <h3>Contenido publicado para entrenar cuando puedas</h3>
              <div className="dash-demo-list" aria-hidden="true">
                <div><span>Entrenamiento grabado</span><Play size={16} /></div>
                <div><span>Sesión en vivo disponible</span><Play size={16} /></div>
              </div>
              <p>Cada pieza muestra su título, categoría, duración y acceso cuando Natalia la publica.</p>
            </article>

            <article className="dash-mock-box">
              <p className="dash-card-eyebrow"><Bell size={15} /> AVISOS IMPORTANTES</p>
              <h3>Todo lo nuevo en un solo lugar</h3>
              <p>Cuando se publique una clase o se programe una sesión, verás el aviso dentro del portal de alumna.</p>
              <span className="dash-notification-example">Nueva publicación · visible en tu portal</span>
            </article>
          </div>

          <p className="dash-preview-disclaimer">Ilustración de las secciones disponibles para alumnas con membresía vigente. El contenido visible depende de las publicaciones reales de Natalia.</p>
        </div>
      </div>
    </section>
  );
}
