import Link from 'next/link';
import './StudentPortal.css';

type ContentItem = {
  id: string;
  title: string;
  description: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  type: string;
  category: string | null;
  duration_seconds: number | null;
  publish_date: string | null;
};

type LiveSession = {
  id: string;
  title: string | null;
  session_date: string;
  start_time: string;
  zoom_join_url: string | null;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`));
}

function timeLabel(value: string) {
  return value.slice(0, 5);
}

export default function StudentPortal({
  name,
  content,
  sessions,
  notifications,
}: {
  name: string;
  content: ContentItem[];
  sessions: LiveSession[];
  notifications: Notification[];
}) {
  return (
    <div className="student-portal">
      <section className="student-hero">
        <p className="student-eyebrow">TU PORTAL TEAM NATY</p>
        <h1>Hola, {name.split(' ')[0] || 'alumna'}.</h1>
        <p>Todo lo que Natalia publique para ti — entrenamientos, sesiones en vivo y avisos — aparece aquí.</p>
      </section>

      {sessions.length > 0 && (
        <section className="student-section" aria-labelledby="next-live-title">
          <div className="student-section-heading">
            <div>
              <p className="student-eyebrow">EN VIVO</p>
              <h2 id="next-live-title">Próximas sesiones Zoom</h2>
            </div>
          </div>
          <div className="student-live-grid">
            {sessions.map((session) => (
              <article className="student-live-card" key={session.id}>
                <p>{dateLabel(session.session_date)} · {timeLabel(session.start_time)} hrs</p>
                <h3>{session.title || 'Sesión en vivo con Natalia'}</h3>
                {session.zoom_join_url ? (
                  <a className="student-primary-link" href={session.zoom_join_url} target="_blank" rel="noreferrer">Unirme por Zoom</a>
                ) : (
                  <span className="student-muted">El enlace se publicará antes de la sesión.</span>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="student-section" aria-labelledby="content-title">
        <div className="student-section-heading">
          <div>
            <p className="student-eyebrow">ENTRENA CUANDO QUIERAS</p>
            <h2 id="content-title">Último contenido</h2>
          </div>
          <Link href="/checkout" className="student-secondary-link">Gestionar membresía</Link>
        </div>
        {content.length ? (
          <div className="student-content-grid">
            {content.map((item) => (
              <article className="student-content-card" key={item.id}>
                {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="student-thumbnail" /> : <div className="student-thumbnail student-thumbnail-placeholder">{item.type}</div>}
                <div className="student-content-body">
                  <p className="student-content-meta">{item.category || item.type}{item.duration_seconds ? ` · ${Math.ceil(item.duration_seconds / 60)} min` : ''}</p>
                  <h3>{item.title}</h3>
                  {item.description && <p>{item.description}</p>}
                  {item.media_url ? <a className="student-primary-link" href={item.media_url} target="_blank" rel="noreferrer">Ver contenido</a> : <span className="student-muted">Material disponible próximamente</span>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="student-empty-state"><h3>Muy pronto habrá entrenamientos aquí.</h3><p>Natalia aún no ha publicado contenido para tu programa. Te avisaremos cuando esté listo.</p></div>
        )}
      </section>

      <section className="student-section" aria-labelledby="notifications-title">
        <div className="student-section-heading"><div><p className="student-eyebrow">MANTENTE AL DÍA</p><h2 id="notifications-title">Notificaciones</h2></div></div>
        {notifications.length ? (
          <div className="student-notifications">
            {notifications.map((notification) => (
              <article className="student-notification" key={notification.id}>
                <div><h3>{notification.title}</h3><p>{notification.message}</p></div>
                <time dateTime={notification.created_at}>{new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(new Date(notification.created_at))}</time>
              </article>
            ))}
          </div>
        ) : <div className="student-empty-state"><p>No tienes notificaciones nuevas.</p></div>}
      </section>
    </div>
  );
}
