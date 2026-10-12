'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getStudentDetailAction, sendStudentNoteAction, setStudentPriceAction } from '../../actions/student-follow-up';
import type { StudentDetail } from '../../actions/student-follow-up';
import { playbackPercent } from '../../lib/student-follow-up';
import './StudentFollowUp.css';

const date = (value: string) => new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
const minute = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function StudentFollowUp({ studentId, name, children, onPriceSaved }: { studentId: string; name: string; children: ReactNode; onPriceSaved?: (price: number) => void }) {
  const [tab, setTab] = useState('progreso');
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [price, setPrice] = useState('25000');
  const [shared, setShared] = useState(true);
  const [confirmPrice, setConfirmPrice] = useState(false);

  async function refresh() {
    const response = await getStudentDetailAction(studentId);
    if (response.success) { setDetail(response.detail); setError(''); setPrice(String(response.detail.membership?.price_contracted === 21000 ? 21000 : 25000)); }
    else setError('message' in response ? response.message : 'No se pudo abrir la ficha.');
    setLoading(false);
  }
  useEffect(() => {
    let cancelled = false;
    void getStudentDetailAction(studentId).then((response) => {
      if (cancelled) return;
      if (response.success) { setDetail(response.detail); setPrice(String(response.detail.membership?.price_contracted === 21000 ? 21000 : 25000)); }
      else setError('message' in response ? response.message : 'No se pudo abrir la ficha.');
      setLoading(false);
    }).catch(() => { if (!cancelled) { setError('No fue posible abrir la ficha. Inténtalo nuevamente.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [studentId]);
  const membership = detail?.membership;
  const priceBlocked = Boolean(!membership || membership.gateway_subscription_id || membership.status === 'PENDING_PAYMENT' || membership.is_complimentary || !detail?.availability.membership);

  async function sendNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    setSaving(true); setResult(null);
    try {
      const response = await sendStudentNoteAction({ studentId, title: String(data.get('title')), message: String(data.get('message')), resourceUrl: String(data.get('resource') || ''), shared });
      setResult(response);
      if (response.success) { form.reset(); await refresh(); }
    } catch { setResult({ success: false, message: 'No se pudo guardar. Inténtalo nuevamente.' }); }
    finally { setSaving(false); }
  }
  async function savePrice(event: React.FormEvent) {
    event.preventDefault(); if (!membership || priceBlocked) return;
    setConfirmPrice(true); setResult(null);
  }
  async function confirmPriceChange() {
    if (!membership || priceBlocked || saving) return;
    setSaving(true); setResult(null);
    try {
      const response = await setStudentPriceAction({ studentId, membershipId: membership.id, expectedPrice: membership.price_contracted, price: Number(price) });
      setResult(response);
      if (response.success) onPriceSaved?.(Number(price));
      await refresh();
    } catch { setResult({ success: false, message: 'No fue posible guardar el valor. Actualiza la ficha antes de reintentar.' }); }
    finally { setSaving(false); setConfirmPrice(false); }
  }
  return <div className="student-follow-up">
    <p className="follow-up-name">Seguimiento personal · {name}</p>
    <nav className="follow-up-tabs" aria-label="Detalle de alumna">{[['progreso', 'Progreso y medidas'], ['mensajes', 'Acompañamiento'], ['membresia', 'Membresía']].map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setResult(null); }} disabled={saving}>{label}</button>)}</nav>
    {loading && <p role="status">Cargando ficha personal…</p>}
    {error && <p className="follow-up-alert" role="alert">{error} <button type="button" onClick={() => { setLoading(true); void refresh().catch(() => { setLoading(false); }); }}>Reintentar</button></p>}
    {result && <p className={`follow-up-alert ${result.success ? 'success' : ''}`} role="status">{result.message}</p>}
    {detail && tab === 'progreso' && <>
      <section className="drawer-section"><h5>Reproducción de clases y entrenamientos</h5><p className="drawer-help">Observaciones del reproductor desde la activación del seguimiento. Visto = al menos 90% del video; no acredita ejercicio ni asistencia en vivo. Se muestran hasta 100 videos recientes.</p>
        {!detail.availability.videos ? <p role="status">Seguimiento no disponible. Falta aplicar el SQL o revisar la conexión.</p> : <><div className="follow-up-summary"><span><strong>{detail.videos.filter((video) => video.completed_at).length}</strong> vistos</span><span><strong>{detail.videos.filter((video) => !video.completed_at).length}</strong> parciales</span></div>
          {detail.videos.map((video) => <article className="follow-up-entry" key={video.content_item_id}><strong>{video.title || 'Video'}</strong><progress max={100} value={playbackPercent(video)} aria-label={`Porcentaje visto de ${video.title}`} /><span>{playbackPercent(video)}% reproducido · {video.completed_at ? 'Visto' : 'Parcial'} · Última posición {minute(video.last_position_seconds)} / {minute(video.duration_seconds)}</span><small>Última reproducción: {date(video.last_watched_at)}</small></article>)}
          {!detail.videos.length && <p>Todavía no hay reproducciones registradas. Los videos vistos antes de activar este seguimiento no se reconstruyen.</p>}</>}
      </section>
      <section className="drawer-section"><h5>Medidas y cambios personales</h5><p className="drawer-help">Registros enviados por la alumna. Sugerimos comparar cada mes sin imponer una meta de peso. Hasta 120 registros recientes.</p>
        {!detail.availability.measurements ? <p>No fue posible consultar las medidas.</p> : detail.measurements.length ? <div className="follow-up-table-wrap"><table><thead><tr><th>Fecha</th><th>Peso kg</th><th>Cintura cm</th><th>Cadera cm</th></tr></thead><tbody>{detail.measurements.map((measure) => <tr key={measure.id}><td>{date(measure.date)}{measure.notes && <small>{measure.notes}</small>}</td><td>{measure.weight_kg ?? '—'}</td><td>{measure.waist_cm ?? '—'}</td><td>{measure.hips_cm ?? '—'}</td></tr>)}</tbody></table></div> : <p>Esta alumna todavía no registra medidas.</p>}
        <button type="button" className="drawer-action-button" onClick={() => setTab('mensajes')}>Comentar su avance personalmente</button>
      </section>
    </>}
    {detail && tab === 'mensajes' && <section className="drawer-section">
      <h5>Acompañamiento exclusivo para {name}</h5>
      {!detail.availability.notes ? <p>Los mensajes personales no están disponibles. Aplica el SQL de acompañamiento antes de enviarlos.</p> : <>
        <form onSubmit={sendNote} className="drawer-form"><label>Título<input name="title" maxLength={160} required placeholder="Tu seguimiento de este mes" /></label><label>Comentario u orientación<textarea name="message" maxLength={3000} required rows={5} placeholder="Escribe una orientación personal, adaptación o preparación para su próxima sesión." /></label><label>Documento o material (opcional)<input name="resource" type="url" maxLength={2048} placeholder="https://…" /></label>
          <label>Visibilidad<select value={shared ? 'shared' : 'internal'} onChange={(event) => setShared(event.target.value === 'shared')}><option value="shared">Enviar a la alumna en Mi progreso</option><option value="internal">Nota interna · sólo administración</option></select></label>
          <p className="drawer-help">{shared ? 'Se guarda en su portal y se genera un aviso sólo para ella. No envía correo.' : 'No se comparte con la alumna ni genera un aviso. Será visible sólo para administración.'} Un enlace externo debe tener sus propios permisos de privacidad.</p>
          <button className="drawer-action-button" disabled={saving}>{saving ? 'Guardando…' : shared ? 'Enviar mensaje personal' : 'Guardar nota interna'}</button>
        </form>
        <h5 className="follow-up-history-title">Historial de acompañamiento</h5>{detail.notes.map((note) => <article className="follow-up-entry" key={note.id}><small>{date(note.created_at)} · {note.visible_to_student ? 'Compartido con la alumna' : 'Nota interna'}</small><strong>{note.title}</strong><p>{note.message}</p>{note.resource_url && <a href={note.resource_url} target="_blank" rel="noreferrer">Abrir material personalizado</a>}</article>)}{!detail.notes.length && <p>Aún no hay mensajes personales.</p>}
      </>}
    </section>}
    {tab === 'membresia' && <>
      {detail && <section className="drawer-section"><h5>Valor mensual acordado</h5><p className="drawer-help">Para próximos pagos. No cambia mensualidades ya pagadas, fechas de acceso ni cobra al guardar. Reutiliza los planes de $21.000 y $25.000 existentes en Flow.</p>
        <form className="drawer-form" onSubmit={savePrice}><label>Precio mensual CLP<select value={price} onChange={(event) => { setPrice(event.target.value); setConfirmPrice(false); }} disabled={priceBlocked || saving}><option value="21000">$21.000</option><option value="25000">$25.000</option></select></label><button className="drawer-action-button" disabled={priceBlocked || saving}>{saving ? 'Guardando…' : 'Guardar valor acordado'}</button></form>
        {confirmPrice && <div className="follow-up-alert" role="region" aria-label="Confirmar precio acordado"><p>¿Acordar ${Number(price).toLocaleString('es-CL')} CLP para las próximas mensualidades de {name}? No se cobra al guardar.</p><button type="button" className="drawer-action-button" onClick={confirmPriceChange} disabled={saving}>{saving ? 'Guardando…' : 'Confirmar valor mensual'}</button><button type="button" className="follow-up-cancel" onClick={() => setConfirmPrice(false)} disabled={saving}>Cancelar cambio</button></div>}
        {priceBlocked && <p className="follow-up-alert">{membership?.is_complimentary ? 'Cortesía activa: no tiene pagos mensuales.' : membership?.gateway_subscription_id || membership?.status === 'PENDING_PAYMENT' ? 'Suscripción o pago Flow en curso: requiere sincronización con la pasarela para no modificar el ciclo ya pagado. El precio no se cambia sólo en la web.' : 'Se necesita una membresía disponible antes de acordar el valor.'}</p>}
      </section>}
      {children}
    </>}
  </div>;
}
