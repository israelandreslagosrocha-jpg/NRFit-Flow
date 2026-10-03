'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity, Bell, Calendar, CalendarClock, Check, CheckCircle2, ChevronRight,
  Clock, CreditCard, Dumbbell, FileText, Play, Plus, Ruler, Sparkles, TrendingDown,
  TrendingUp, Trophy, Video, X,
} from 'lucide-react';
import BodyMeasurementsModal from './BodyMeasurementsModal';
import { markNotificationReadAction } from '../../actions/measurements';
import { beginMembershipRenewalAction, getManualPaymentLinkAction } from '../../actions/subscription';
import { getCurrentMembershipOffer } from '../../lib/offers/membership-offer';
import './StudentPortal.css';

const BRAND_LOGO = 'https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp';
type PortalSection = 'inicio' | 'progreso' | 'clases' | 'membresia';

type ContentItem = { id: string; title: string; description: string | null; media_url: string | null; thumbnail_url: string | null; type: string; category: string | null; duration_seconds: number | null; publish_date: string | null };
type LiveSession = { id: string; title: string | null; session_date: string; start_time: string; has_zoom_link: boolean };
type Notification = { id: string; title: string; message: string; created_at: string; is_read: boolean };
type BodyMeasurement = { id: string; date: string; weight_kg: number; waist_cm: number | null; hips_cm: number | null; notes: string | null };
type Membership = { status: string; start_date: string | null; trial_ends_at: string | null; current_period_start: string | null; current_period_end: string | null; price_contracted: number | null; auto_renew: boolean | null; renewal_mode: 'AUTO_CHARGE' | 'MANUAL_RENEWAL' | 'EXPIRE_ON_DATE' | null; gateway_status: string | null };
type AttendanceSummary = { booked: number; attended: number; excused: number; absent: number };

interface Props {
  name: string;
  content: ContentItem[];
  sessions: LiveSession[];
  notifications: Notification[];
  membership: Membership | null;
  measurements: BodyMeasurement[];
  attendance: AttendanceSummary;
  initialSection?: string;
  zoomState?: string;
}

function normalizeSection(section?: string): PortalSection {
  return section === 'progreso' || section === 'clases' || section === 'membresia' ? section : 'inicio';
}

function formatDate(isoDate: string) {
  if (!isoDate) return '';
  return new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(`${isoDate}T12:00:00`));
}

function formatLongDate(isoString: string | null) {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(isoString.includes('T') ? isoString : `${isoString}T12:00:00`));
}

function isLiveReplay(item: ContentItem) {
  return /sesi[oó]n en vivo|clase en vivo|live replay|repetici[oó]n/.test(`${item.title} ${item.category || ''}`.toLocaleLowerCase('es-CL'));
}

function contentKindLabel(item: ContentItem) {
  if (item.category === 'ENTRENAMIENTO_ASINCRONO') return 'Entrenamiento asíncrono';
  if (item.category === 'REPETICION_VIVO') return 'Repetición clase en vivo';
  if (item.category === 'RECURSO_PROXIMA_SESION') return 'Material para tu próxima sesión';
  if (item.type === 'PDF_GUIDE') return 'Documento de Natalia';
  if (item.type === 'TIP') return 'Tip de Natalia';
  if (item.type === 'ARTICLE') return 'Lectura recomendada';
  if (item.type === 'BONUS') return 'Material complementario';
  return item.category || 'Entrenamiento asíncrono';
}

function youtubeEmbedUrl(mediaUrl: string | null): string | null {
  if (!mediaUrl) return null;

  try {
    const url = new URL(mediaUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let videoId = '';

    if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      videoId = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1] || '';
    }

    return /^[A-Za-z0-9_-]{11}$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`
      : null;
  } catch {
    return null;
  }
}

export default function StudentPortal({ name, content, sessions, notifications, membership, measurements = [], attendance, initialSection, zoomState }: Props) {
  const [activeSection, setActiveSection] = useState<PortalSection>(normalizeSection(initialSection));
  const [modalOpen, setModalOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState(notifications);
  const [isUpdatingNotification, setIsUpdatingNotification] = useState<string | null>(null);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const [earlyPaymentUrl, setEarlyPaymentUrl] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<ContentItem | null>(null);

  useEffect(() => setActiveSection(normalizeSection(initialSection)), [initialSection]);

  const firstName = name.split(' ')[0] || 'Alumna';
  const nextSession = sessions[0] || null;
  const unreadNotifications = notificationItems.filter((item) => !item.is_read);
  const displayedMembershipPrice = membership?.price_contracted ?? getCurrentMembershipOffer().monthlyPrice;
  const isTrial = membership?.status === 'TRIAL' || (membership?.status === 'PENDING_PAYMENT' && membership.gateway_status === 'early_manual_payment_pending');
  const membershipEnd = isTrial ? membership?.trial_ends_at : membership?.current_period_end;
  const renewalLabel = membership?.renewal_mode === 'AUTO_CHARGE' ? 'Pago automático mensual' : membership?.renewal_mode === 'MANUAL_RENEWAL' ? 'Recordatorio y enlace mensual' : 'Lo elegirás libremente';
  const { asyncWorkouts, liveReplays, personalResources } = useMemo(() => ({
    asyncWorkouts: content.filter((item) => item.type === 'VIDEO' && !isLiveReplay(item)),
    liveReplays: content.filter((item) => item.type === 'VIDEO' && isLiveReplay(item)),
    personalResources: content.filter((item) => item.type !== 'VIDEO'),
  }), [content]);
  const featuredWorkout = asyncWorkouts[0] || null;
  const latestMeasurement = measurements[0] || null;
  const previousMeasurement = measurements[1] || null;
  const currentWeight = latestMeasurement?.weight_kg ?? null;
  const currentWaist = latestMeasurement?.waist_cm ?? null;
  const currentHips = latestMeasurement?.hips_cm ?? null;
  const weightDiff = previousMeasurement && currentWeight !== null ? Number((currentWeight - previousMeasurement.weight_kg).toFixed(1)) : null;
  const chartData = measurements.length > 1 ? [...measurements].reverse() : [];
  const minWeight = chartData.length ? Math.min(...chartData.map((d) => d.weight_kg)) - 0.5 : 0;
  const maxWeight = chartData.length ? Math.max(...chartData.map((d) => d.weight_kg)) + 0.5 : 1;
  const range = maxWeight - minWeight || 1;
  const svgPoints = chartData.map((d, index) => `${20 + (index / (chartData.length - 1 || 1)) * 260},${80 - ((d.weight_kg - minWeight) / range) * 60}`).join(' ');
  const zoomMessage = zoomState === 'not-ready' ? 'El acceso a Zoom se habilita 15 minutos antes de la clase.' : zoomState === 'membership' ? 'Necesitas una membresía vigente para entrar a esta clase.' : zoomState ? 'No fue posible abrir esta clase. Inténtalo nuevamente desde el portal.' : null;
  const activeYoutubeEmbed = youtubeEmbedUrl(activeVideo?.media_url || null);

  const selectSection = (section: PortalSection) => {
    setActiveSection(section);
    window.history.replaceState(null, '', section === 'inicio' ? '/para-ti' : `/para-ti?seccion=${section}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openVideo = (item: ContentItem) => {
    if (item.media_url) setActiveVideo(item);
  };
  const markNotificationAsRead = async (notificationId: string) => {
    setIsUpdatingNotification(notificationId);
    const result = await markNotificationReadAction(notificationId);
    if (result.success) setNotificationItems((current) => current.map((item) => item.id === notificationId ? { ...item, is_read: true } : item));
    setIsUpdatingNotification(null);
  };
  const payBeforeTrialEnds = async () => {
    setRenewalLoading(true); setRenewalError(null);
    const result = await beginMembershipRenewalAction('MANUAL_RENEWAL', 'PAY_NOW');
    if (!result.success || 'error' in result) setRenewalError(('error' in result && result.error) || 'No fue posible preparar tu pago.');
    else setEarlyPaymentUrl('paymentUrl' in result ? result.paymentUrl || null : null);
    setRenewalLoading(false);
  };
  const reopenPaymentLink = async () => {
    setRenewalLoading(true); setRenewalError(null);
    const result = await getManualPaymentLinkAction();
    if (!result.success || 'error' in result) setRenewalError(('error' in result && result.error) || 'No fue posible recuperar el enlace.');
    else setEarlyPaymentUrl(result.paymentUrl || null);
    setRenewalLoading(false);
  };
  const renderJoinLive = (session: LiveSession, label = 'Entrar a la clase en vivo') => session.has_zoom_link ? <a href={`/para-ti/zoom/${session.id}`} target="_blank" rel="noreferrer" className="btn-join-live"><Video size={18} /><span>{label}</span></a> : <p className="zoom-waiting-note">El enlace de Zoom estará disponible 15 minutos antes de la clase.</p>;
  const renderWorkoutCard = (item: ContentItem, variant = '') => <article key={item.id} className={`content-library-card ${variant}`}><div className="content-library-thumb"><button type="button" className="content-library-play-button" onClick={() => openVideo(item)} disabled={!item.media_url} aria-label={`Reproducir ${item.title}`}><img src={item.thumbnail_url || BRAND_LOGO} alt="" />{item.duration_seconds && <span className="content-duration"><Clock size={12} />{Math.ceil(item.duration_seconds / 60)} min</span>}{item.media_url && <span className="content-play-icon"><Play size={18} fill="currentColor" /><span className="sr-only">Reproducir</span></span>}</button></div><div className="content-library-copy"><span className="category-pill">{contentKindLabel(item)}</span><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div></article>;

  return <div className="alumna-portal-container">
    <header className="alumna-header-row"><div><p className="portal-eyebrow">PORTAL PERSONAL · TEAM NATY</p><h1 className="alumna-greeting">Hola, {firstName} <span className="greeting-wave">👋</span></h1><p className="alumna-greeting-sub">Un espacio claro para entrenar, registrar tus avances y sostener tu proceso.</p></div><div className="alumna-header-date"><button type="button" className="student-notifications-button" onClick={() => selectSection('progreso')}><Bell size={16} /><span>{unreadNotifications.length ? `${unreadNotifications.length} avisos` : 'Avisos'}</span></button><Calendar size={16} /><span>{new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span></div></header>
    <nav className="student-section-tabs" aria-label="Secciones de tu portal">{[['inicio', 'Para ti'], ['progreso', 'Mi progreso'], ['clases', 'Clases y videos'], ['membresia', 'Mi membresía']].map(([section, label]) => <button key={section} type="button" onClick={() => selectSection(section as PortalSection)} className={activeSection === section ? 'is-active' : ''}>{label}</button>)}</nav>
    {zoomMessage && <div className="student-inline-notice">{zoomMessage}</div>}

    {activeSection === 'inicio' && <>
      <section className="alumna-hero-banner"><div className="hero-banner-content"><span className="hero-pill-tag"><Sparkles size={14} /> TU SEMANA, A TU RITMO</span><h2 className="hero-title">Dos clases en vivo para guiar tu semana. La biblioteca está para acompañarte cuando puedas.</h2><p className="hero-copy">Te sugerimos seguir el orden de las sesiones en vivo. Los entrenamientos asíncronos son de libre disposición: elige el que mejor calce con tu energía y tiempo.</p><div className="hero-cta-group">{nextSession ? renderJoinLive(nextSession, 'Ver mi próxima clase en vivo') : featuredWorkout?.media_url ? <a href={featuredWorkout.media_url} target="_blank" rel="noreferrer" className="hero-btn-primary"><Play size={16} fill="currentColor" /><span>Elegir un entrenamiento flexible</span></a> : <button onClick={() => selectSection('clases')} className="hero-btn-primary"><Video size={16} /><span>Ver clases y videos</span></button>}</div></div><div className="hero-banner-image-wrap"><img src={BRAND_LOGO} alt="Logo oficial Naty Entrenadora" className="hero-naty-photo" /></div></section>
      <section className="alumna-metrics-grid" aria-label="Resumen personal"><article className="metric-card"><div className="metric-card-top"><span className="metric-label">Próxima clase en vivo</span><div className="metric-icon-wrap icon-orange"><CalendarClock size={18} /></div></div><div className="metric-value-row"><span className="metric-number">{nextSession ? '1' : '—'}</span><span className="metric-badge orange">{nextSession ? formatDate(nextSession.session_date) : 'Sin agenda'}</span></div><p className="metric-helper">{nextSession?.title || 'Natalia publicará la siguiente sesión aquí.'}</p></article><article className="metric-card"><div className="metric-card-top"><span className="metric-label">Biblioteca flexible</span><div className="metric-icon-wrap icon-purple"><Dumbbell size={18} /></div></div><div className="metric-value-row"><span className="metric-number">{asyncWorkouts.length}</span><span className="metric-badge green">A tu ritmo</span></div><p className="metric-helper">Entrenamientos asíncronos disponibles, sin cuota semanal obligatoria.</p></article><article className="metric-card"><div className="metric-card-top"><span className="metric-label">Asistencia registrada</span><div className="metric-icon-wrap icon-pink"><Trophy size={18} /></div></div><div className="metric-value-row"><span className="metric-number">{attendance.attended}</span><span className="metric-badge purple">de {attendance.booked} reservas</span></div><p className="metric-helper">Este dato se actualiza cuando Natalia confirma la asistencia.</p></article></section>
      <div className="student-home-grid"><article className="portal-card live-card"><div className="card-header-between"><div className="live-status-pill"><span className="live-pulse" /><span>RUTA RECOMENDADA</span></div><span className="live-zoom-tag">Lunes y miércoles</span></div>{nextSession ? <div className="live-card-body"><span className="live-time-badge"><Clock size={16} />{formatDate(nextSession.session_date)} · {nextSession.start_time.slice(0, 5)} hrs</span><h3 className="live-session-name">Paso 1 · {nextSession.title || 'Tu próxima sesión en vivo'}</h3><p className="card-body-copy">Empezar por la primera sesión publicada te ayuda a seguir la progresión de Natalia. Si no alcanzas, podrás retomar sin perder tu proceso.</p>{renderJoinLive(nextSession)}</div> : <div className="empty-live-box"><Calendar size={28} className="empty-icon" /><p>Aún no hay una sesión programada.</p><span>Mientras tanto, usa la biblioteca flexible.</span></div>}<button className="text-action" type="button" onClick={() => selectSection('clases')}>Ver agenda y biblioteca <ChevronRight size={16} /></button></article><article className="portal-card tip-card"><div className="tip-header"><div className="tip-badge"><Sparkles size={14} /><span>RECUERDA</span></div></div><h3 className="tip-title">La constancia no se mide por entrenar perfecto.</h3><p className="tip-copy">Las dos clases en vivo te dan estructura; la biblioteca existe para que adaptes el movimiento a tu vida real, no al revés.</p><button className="text-action" type="button" onClick={() => selectSection('progreso')}>Ver mi proceso personal <ChevronRight size={16} /></button></article></div>
    </>}

    {activeSection === 'clases' && <section className="student-section-content" aria-labelledby="clases-title"><div className="section-heading"><span className="portal-eyebrow">ENTRENAMIENTO</span><h2 id="clases-title">Clases en vivo y biblioteca</h2><p>Las sesiones en vivo son la ruta sugerida de la semana. Los entrenamientos asíncronos siempre quedan disponibles para que elijas con libertad.</p></div><article className="portal-card live-path-card"><div className="card-header-between"><div><h3>Tu ruta de clases en vivo</h3><span className="card-subtitle">Sigue el orden publicado para aprovechar la progresión.</span></div><span className="live-zoom-tag">2 por semana</span></div><div className="live-route-list">{sessions.map((session, index) => <article className="live-route-item" key={session.id}><span className="live-route-order">{index + 1}</span><div><strong>Sesión {index + 1} · {session.title || 'Clase en vivo Team Naty'}</strong><span>{formatDate(session.session_date)} · {session.start_time.slice(0, 5)} hrs · Zoom</span></div>{renderJoinLive(session, index === 0 ? 'Prepararme' : 'Ver sesión')}</article>)}{!sessions.length && <div className="empty-live-box"><p>Natalia aún no publica la agenda de la semana.</p><span>Revisa la biblioteca mientras aparece la siguiente sesión.</span></div>}</div></article><div className="library-section-heading"><div><span className="portal-eyebrow">A TU RITMO</span><h3>Entrenamientos asíncronos</h3><p>Disponibles cuando quieras. No reemplazan tu proceso: son una opción flexible para sumar movimiento.</p></div><span>{asyncWorkouts.length} disponibles</span></div><div className="content-library-grid">{asyncWorkouts.map((item) => renderWorkoutCard(item))}{!asyncWorkouts.length && <div className="empty-resource-box"><Dumbbell size={22} /><p>La biblioteca asíncrona se está preparando.</p><span>Los próximos entrenamientos aparecerán aquí cuando Natalia los publique.</span></div>}</div>{liveReplays.length > 0 && <><div className="library-section-heading"><div><span className="portal-eyebrow">REPETICIONES</span><h3>Clases en vivo disponibles</h3><p>Grabaciones de sesiones anteriores para retomar una clase que no pudiste tomar en directo.</p></div></div><div className="content-library-grid">{liveReplays.map((item) => renderWorkoutCard(item, 'live-replay-card'))}</div></>}</section>}

    {activeSection === 'progreso' && <section className="student-section-content" aria-labelledby="progreso-title"><div className="section-heading"><span className="portal-eyebrow">TU PROCESO</span><h2 id="progreso-title">Mi progreso personal</h2><p>Tu avance se construye con información útil, no con presión. Aquí se reúnen tus medidas, asistencia y lo que Natalia comparte para acompañarte.</p></div><div className="progress-overview-grid"><article className="portal-card progress-card"><div className="card-header-between"><div><h3>Mis medidas</h3><span className="card-subtitle">Registra cambios cuando te haga sentido.</span></div><button onClick={() => setModalOpen(true)} className="btn-add-measurements"><Plus size={16} /><span>Registrar</span></button></div>{chartData.length > 1 ? <div className="weight-chart-container"><svg viewBox="0 0 300 95" className="weight-svg-chart"><defs><linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF4FB8" stopOpacity="0.32" /><stop offset="100%" stopColor="#E9B4C0" stopOpacity="0.04" /></linearGradient></defs><path d={`M 20,85 L ${svgPoints} L 280,85 Z`} fill="url(#chartGradient)" /><polyline fill="none" stroke="#FF4FB8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={svgPoints} />{chartData.map((d, i) => { const x = 20 + (i / (chartData.length - 1 || 1)) * 260; const y = 80 - ((d.weight_kg - minWeight) / range) * 60; return <circle key={d.id} cx={x} cy={y} r="4.5" fill="#ffffff" stroke="#FF4FB8" strokeWidth="2.5" />; })}</svg><div className="chart-x-labels"><span>Inicial</span><span>Actual ({currentWeight} kg)</span></div></div> : <div className="measurements-empty-state"><Ruler size={24} /><p>Aún no has registrado medidas.</p><span>Cuando quieras, agrega tu primer registro para ver tu evolución aquí.</span></div>}<div className="measurements-pill-grid"><div className="measurement-pill"><span className="pill-name">Peso actual</span><div className="pill-num-row"><strong>{currentWeight !== null ? `${currentWeight} kg` : '—'}</strong>{weightDiff !== null && <span className={`diff-tag ${weightDiff <= 0 ? 'diff-good' : 'diff-neutral'}`}>{weightDiff <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}{Math.abs(weightDiff)} kg</span>}</div></div><div className="measurement-pill"><span className="pill-name">Cintura</span><strong>{currentWaist !== null ? `${currentWaist} cm` : '—'}</strong></div><div className="measurement-pill"><span className="pill-name">Cadera</span><strong>{currentHips !== null ? `${currentHips} cm` : '—'}</strong></div></div></article><article className="portal-card attendance-card"><div className="card-header-between"><div><h3>Mi asistencia</h3><span className="card-subtitle">Registro de clases confirmadas por Natalia.</span></div><Activity size={19} /></div><div className="attendance-number"><strong>{attendance.attended}</strong><span>clases asistidas</span></div><div className="attendance-detail-grid"><div><span>Reservas</span><strong>{attendance.booked}</strong></div><div><span>Justificadas</span><strong>{attendance.excused}</strong></div><div><span>Ausencias</span><strong>{attendance.absent}</strong></div></div><p className="attendance-note">No hay una meta obligatoria de cinco días. Las dos clases en vivo te dan una base semanal y la biblioteca te permite adaptarte.</p></article></div><div className="resources-and-notices-grid"><article className="portal-card resources-card"><div className="card-header-between"><div><h3>Material de Natalia para ti</h3><span className="card-subtitle">Documentos, tips y orientaciones para tus próximas sesiones.</span></div><FileText size={19} /></div><div className="resources-list">{personalResources.map((item) => <article key={item.id} className="resource-item"><div><span>{contentKindLabel(item)}</span><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}</div>{item.media_url && <a href={item.media_url} target="_blank" rel="noreferrer">Abrir <ChevronRight size={15} /></a>}</article>)}{!personalResources.length && <div className="empty-resource-box"><FileText size={22} /><p>Aquí aparecerán los documentos, tips y materiales que Natalia comparta contigo.</p></div>}</div></article><article className="portal-card notifications-card"><div className="card-header-between"><div><h3>Avisos de Team Naty</h3><span className="card-subtitle">Novedades importantes de tu entrenamiento.</span></div><Bell size={19} /></div><div className="notifications-list">{notificationItems.map((notification) => <article key={notification.id} className={`notification-item ${notification.is_read ? 'is-read' : 'is-unread'}`}><div><strong>{notification.title}</strong><p>{notification.message}</p><span>{new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(new Date(notification.created_at))}</span></div>{!notification.is_read && <button type="button" onClick={() => markNotificationAsRead(notification.id)} disabled={isUpdatingNotification === notification.id} className="notification-read-button"><Check size={15} /><span>{isUpdatingNotification === notification.id ? 'Guardando…' : 'Leído'}</span></button>}</article>)}{!notificationItems.length && <p className="empty-notifications">Aquí aparecerán las novedades, clases y videos que publique Natalia.</p>}</div></article></div></section>}

    {activeSection === 'membresia' && <section className="student-section-content membership-section" aria-labelledby="membresia-title"><div className="section-heading"><span className="portal-eyebrow">TU ACCESO</span><h2 id="membresia-title">Mi membresía</h2><p>Todo lo que ocurre con tu acceso, prueba y pagos queda explicado aquí antes de que tomes una decisión.</p></div><article className="portal-card membership-detail-card"><div className="card-header-between"><div><h3>Team Naty Online</h3><span className="card-subtitle">Clases en vivo, biblioteca flexible y portal personal.</span></div><span className={`status-pill ${isTrial ? 'pill-trial' : 'pill-active'}`}>{isTrial ? 'Prueba activa' : 'Membresía activa'}</span></div><div className="membership-info-box detailed"><div className="membership-row"><span className="m-label">Valor mensual contratado</span><span className="m-value">${displayedMembershipPrice.toLocaleString('es-CL')} CLP / mes</span></div><div className="membership-row"><span className="m-label">{isTrial ? 'Tu prueba comenzó' : 'Tu ciclo pagado comenzó'}</span><span className="m-value">{formatLongDate(isTrial ? membership?.start_date || null : membership?.current_period_start || membership?.start_date || null)}</span></div><div className="membership-row"><span className="m-label">{isTrial ? 'Tu prueba gratuita termina' : 'Próxima mensualidad'}</span><span className="m-value">{formatLongDate(membershipEnd || null)}</span></div><div className="membership-row"><span className="m-label">Modalidad de pago</span><span className="m-value">{renewalLabel}</span></div><div className="membership-row"><span className="m-label">Incluye</span><span className="m-value green-text"><CheckCircle2 size={14} /> 2 clases en vivo + biblioteca flexible</span></div></div>{isTrial && <div className="early-payment-callout"><CreditCard size={20} /><div><strong>¿Quieres pagar antes de que termine tu prueba?</strong><p>Es opcional. Si confirmas el pago ahora, tu primer ciclo pagado comenzará hoy y se reemplazarán los días gratuitos restantes.</p></div></div>}{isTrial && !earlyPaymentUrl && <button type="button" className="btn-manage-membership primary-membership-action" onClick={payBeforeTrialEnds} disabled={renewalLoading}><span>{renewalLoading ? 'Preparando pago seguro…' : 'Pagar mi membresía ahora'}</span><ChevronRight size={16} /></button>}{membership?.status === 'PENDING_PAYMENT' && membership.gateway_status === 'early_manual_payment_pending' && !earlyPaymentUrl && <button type="button" className="btn-manage-membership primary-membership-action" onClick={reopenPaymentLink} disabled={renewalLoading}><span>{renewalLoading ? 'Recuperando enlace…' : 'Ver mi enlace de pago seguro'}</span><ChevronRight size={16} /></button>}{earlyPaymentUrl && <a href={earlyPaymentUrl} target="_blank" rel="noreferrer" className="btn-manage-membership primary-membership-action"><span>Ir a pagar con Flow</span><ChevronRight size={16} /></a>}{renewalError && <p className="membership-action-error" role="alert">{renewalError}</p>}{!isTrial && <Link href="/checkout" className="btn-manage-membership"><span>Gestionar suscripción</span><ChevronRight size={16} /></Link>}</article><article className="portal-card membership-explainer"><CalendarClock size={22} /><div><h3>Tu decisión de renovación</h3><p>Al finalizar tu prueba puedes continuar con pago automático en Flow o con un recordatorio y enlace mensual. La modalidad se confirma antes de cualquier cobro.</p></div></article></section>}
    {activeVideo && <div className="student-video-backdrop" role="presentation" onMouseDown={() => setActiveVideo(null)}><section className="student-video-dialog" role="dialog" aria-modal="true" aria-labelledby="student-video-title" onMouseDown={(event) => event.stopPropagation()}><header className="student-video-header"><div><p className="portal-eyebrow">BIBLIOTECA TEAM NATY</p><h2 id="student-video-title">{activeVideo.title}</h2></div><button type="button" className="student-video-close" onClick={() => setActiveVideo(null)} aria-label="Cerrar reproductor"><X size={20} /></button></header><div className="student-video-frame">{activeYoutubeEmbed ? <iframe src={activeYoutubeEmbed} title={activeVideo.title} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <video controls controlsList="nodownload noremoteplayback" disablePictureInPicture src={activeVideo.media_url || undefined}>Tu navegador no permite reproducir este video.</video>}</div><p className="student-video-note">Este entrenamiento está disponible dentro de tu portal Team Naty.</p></section></div>}
    <BodyMeasurementsModal isOpen={modalOpen} onClose={() => setModalOpen(false)} lastWeight={currentWeight ?? undefined} lastWaist={currentWaist ?? undefined} lastHips={currentHips ?? undefined} />
  </div>;
}
