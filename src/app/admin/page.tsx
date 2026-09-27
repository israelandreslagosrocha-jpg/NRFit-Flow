import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { createAdminClient } from '../../lib/supabase/admin';
import {
  archiveContentAction,
  createLiveSessionAction,
  publishContentAction,
} from '../../actions/admin-portal';
import './admin.css';

const STAFF_ROLES = new Set(['ADMIN', 'OWNER']);

function statusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    ACTIVE: 'Activa',
    TRIAL: 'Prueba',
    PAST_DUE: 'Pago pendiente',
    PENDING_PAYMENT: 'Pago en proceso',
    CANCELLED: 'Cancelada',
    EXPIRED: 'Vencida',
    PAUSED: 'Pausada',
  };
  return labels[status || ''] || 'Sin membresía';
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirectedFrom=/admin');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('user_id', user.id)
    .single();

  if (!profile || !STAFF_ROLES.has(profile.role)) redirect('/para-ti');

  const query = await searchParams;
  let configurationError = false;
  let students: any[] = [];
  let content: any[] = [];
  let sessions: any[] = [];

  try {
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const [studentsResult, contentResult, sessionsResult] = await Promise.all([
      admin
        .from('students')
        .select('id, profile:profiles!inner(full_name), memberships(status, trial_ends_at, current_period_end, created_at)')
        .order('created_at', { ascending: false })
        .limit(30),
      admin
        .from('content_items')
        .select('id, title, type, publish_date, is_active, media_url')
        .order('created_at', { ascending: false })
        .limit(12),
      admin
        .from('sessions')
        .select('id, title, session_date, start_time, zoom_join_url')
        .eq('delivery_type', 'ONLINE')
        .gte('session_date', today)
        .order('session_date', { ascending: true })
        .limit(8),
    ]);

    students = studentsResult.data || [];
    content = contentResult.data || [];
    sessions = sessionsResult.data || [];
  } catch {
    configurationError = true;
  }

  const activeStudents = students.filter((student) =>
    (student.memberships || []).some((membership: any) => ['ACTIVE', 'TRIAL'].includes(membership.status))
  ).length;

  return (
    <main className="admin-portal">
      <header className="admin-hero">
        <div>
          <p className="admin-eyebrow">PANEL PRIVADO</p>
          <h1>Hola, {profile.full_name.split(' ')[0]}.</h1>
          <p>Publica clases, programa sesiones Zoom y revisa la actividad esencial de tus alumnas.</p>
        </div>
        <a href="/para-ti" className="admin-portal-link">Ver portal de alumna</a>
      </header>

      {query.success && <p className="admin-message admin-message-success" role="status">{query.success}</p>}
      {query.error && <p className="admin-message admin-message-error" role="alert">{query.error}</p>}

      {configurationError ? (
        <section className="admin-setup-warning">
          <h2>Falta una configuración de servidor para habilitar este panel.</h2>
          <p>Agrega <code>SUPABASE_SERVICE_ROLE_KEY</code> solo al entorno de servidor y aplica la migración nueva de Supabase. La clave nunca debe exponerse en el navegador.</p>
        </section>
      ) : (
        <>
          <section className="admin-kpis" aria-label="Resumen de alumnas">
            <article><span>Alumnas registradas</span><strong>{students.length}</strong></article>
            <article><span>Con acceso vigente</span><strong>{activeStudents}</strong></article>
            <article><span>Contenido publicado</span><strong>{content.filter((item) => item.is_active).length}</strong></article>
            <article><span>Próximos Zoom</span><strong>{sessions.length}</strong></article>
          </section>

          <section className="admin-workspace">
            <form action={publishContentAction} className="admin-form-card">
              <div><p className="admin-eyebrow">BIBLIOTECA</p><h2>Publicar video o material</h2><p>Agrega un enlace HTTPS de Cloudinary, Vimeo, YouTube u otro alojamiento autorizado. Cada publicación crea un aviso dentro del portal de las alumnas activas.</p></div>
              <label>Título<input name="title" required maxLength={255} placeholder="Ej. Piernas y glúteos · Semana 1" /></label>
              <label>Tipo<select name="type" defaultValue="VIDEO"><option value="VIDEO">Video</option><option value="TIP">Tip</option><option value="ARTICLE">Artículo</option><option value="PDF_GUIDE">Guía PDF</option><option value="BONUS">Bonus</option></select></label>
              <label>Descripción<textarea name="description" maxLength={2000} rows={3} placeholder="Qué trabajará la alumna y cómo usar este material." /></label>
              <div className="admin-form-row"><label>Enlace del contenido<input name="media_url" type="url" placeholder="https://…" /></label><label>Miniatura (opcional)<input name="thumbnail_url" type="url" placeholder="https://…" /></label></div>
              <div className="admin-form-row"><label>Categoría<input name="category" maxLength={100} placeholder="Fuerza, movilidad…" /></label><label>Duración (segundos)<input name="duration_seconds" type="number" min="0" max="86400" /></label><label>Publicar el<input name="publish_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label></div>
              <button type="submit">Publicar y notificar</button>
            </form>

            <form action={createLiveSessionAction} className="admin-form-card">
              <div><p className="admin-eyebrow">CLASES EN VIVO</p><h2>Programar una sesión Zoom</h2><p>El enlace se muestra solamente a alumnas que tienen una membresía vigente y genera un aviso en su portal.</p></div>
              <label>Nombre de la sesión<input name="title" required maxLength={255} placeholder="Ej. GAP + preguntas en vivo" /></label>
              <div className="admin-form-row"><label>Fecha<input name="session_date" type="date" required min={new Date().toISOString().slice(0, 10)} /></label><label>Hora<input name="start_time" type="time" required /></label><label>Capacidad<input name="max_capacity" type="number" defaultValue="100" min="1" max="10000" required /></label></div>
              <label>Enlace Zoom<input name="zoom_join_url" type="url" required placeholder="https://us02web.zoom.us/j/…" /></label>
              <button type="submit">Programar y notificar</button>
            </form>
          </section>

          <section className="admin-data-section">
            <div><p className="admin-eyebrow">ALUMNAS</p><h2>Estado de membresías</h2></div>
            {students.length ? <div className="admin-table-wrap"><table><thead><tr><th>Alumna</th><th>Estado</th><th>Vigencia</th></tr></thead><tbody>{students.map((student) => {
              const membership = (student.memberships || []).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0];
              const studentProfile = Array.isArray(student.profile) ? student.profile[0] : student.profile;
              return <tr key={student.id}><td>{studentProfile?.full_name || 'Sin nombre'}</td><td><span className={`admin-status admin-status-${(membership?.status || 'none').toLowerCase()}`}>{statusLabel(membership?.status)}</span></td><td>{membership?.trial_ends_at || membership?.current_period_end ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(membership.trial_ends_at || membership.current_period_end)) : '—'}</td></tr>;
            })}</tbody></table></div> : <p className="admin-empty">Aún no hay alumnas registradas.</p>}
          </section>

          <section className="admin-data-section">
            <div><p className="admin-eyebrow">PUBLICADO</p><h2>Contenido reciente</h2></div>
            {content.length ? <div className="admin-content-list">{content.map((item) => <article key={item.id}><div><strong>{item.title}</strong><p>{item.type} · {item.publish_date || 'Sin fecha'} · {item.is_active ? 'Visible' : 'Archivado'}</p></div>{item.is_active && <form action={archiveContentAction}><input type="hidden" name="content_id" value={item.id} /><button className="admin-archive-button" type="submit">Archivar</button></form>}</article>)}</div> : <p className="admin-empty">Aún no hay contenido publicado.</p>}
          </section>
        </>
      )}
    </main>
  );
}
