'use client';

import { chileToday, playbackPercent } from '../../lib/student-follow-up';
import type { CoachNote, VideoProgress, Measurement } from '../../lib/student-follow-up';

const date = (value: string) => new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));

export default function PersonalFollowUp({ notes, videos, measurements, available }: { notes: CoachNote[]; videos: VideoProgress[]; measurements: Measurement[]; available: boolean }) {
  const month = chileToday().slice(0, 7);
  return <div className="personal-follow-up student-section-content">
    <article className="portal-card"><div className="card-header-between"><div><h3>Tu seguimiento mensual</h3><span className="card-subtitle">Tus registros también están disponibles para que Natalia te acompañe.</span></div></div>
      <p className="card-body-copy">Sugerimos registrar tus medidas una vez al mes. Es un seguimiento personal, sin una meta obligatoria de peso; puedes registrar nuevos cambios cuando necesites.</p>
      {!measurements.some((item) => item.date.slice(0, 7) === month) && <p className="student-inline-notice">Todavía no tienes un registro de medidas de este mes. Usa «Registrar» en Mis medidas cuando quieras hacerlo.</p>}
      {measurements.length > 0 && <div className="personal-measurements-table"><table><thead><tr><th>Fecha</th><th>Peso kg</th><th>Cintura cm</th><th>Cadera cm</th></tr></thead><tbody>{measurements.map((measure) => <tr key={measure.id}><td>{date(measure.date)}{measure.notes && <small>{measure.notes}</small>}</td><td>{measure.weight_kg ?? '—'}</td><td>{measure.waist_cm ?? '—'}</td><td>{measure.hips_cm ?? '—'}</td></tr>)}</tbody></table></div>}
    </article>
    <article className="portal-card"><div className="card-header-between"><div><h3>Mensajes personales de Natalia</h3><span className="card-subtitle">Comentarios y materiales enviados exclusivamente para ti.</span></div></div>
      {!available && <p role="status">El acompañamiento personal todavía no está disponible. Tus clases y medidas siguen funcionando.</p>}
      {notes.map((note) => <article className="personal-coach-message" key={note.id}><small>{date(note.created_at)}</small><h4>{note.title}</h4><p>{note.message}</p>{note.resource_url && <a href={note.resource_url} target="_blank" rel="noreferrer">Abrir mi material personalizado</a>}</article>)}
      {available && !notes.length && <p className="card-body-copy">Aquí aparecerán los comentarios personales que Natalia comparta contigo. Los avisos generales se muestran por separado.</p>}
    </article>
    <article className="portal-card"><div className="card-header-between"><div><h3>Mi reproducción de videos</h3><span className="card-subtitle">Se registra desde la activación del seguimiento, no reconstruye videos anteriores.</span></div></div><p className="card-body-copy">Visto significa que reprodujiste al menos el 90%. Este registro no cuenta como asistencia en vivo ni acredita que hayas realizado el ejercicio.</p>
      {videos.map((video) => <div className="personal-video-progress" key={video.content_item_id}><strong>{video.title || 'Video'}</strong><progress max={100} value={playbackPercent(video)} aria-label={`Porcentaje visto de ${video.title}`} /><span>{playbackPercent(video)}% · {video.completed_at ? 'Visto' : 'Parcial'} · Última posición: {Math.floor(video.last_position_seconds / 60)} min</span></div>)}
      {available && !videos.length && <p className="card-body-copy">Todavía no hay reproducciones registradas.</p>}
    </article>
  </div>;
}
