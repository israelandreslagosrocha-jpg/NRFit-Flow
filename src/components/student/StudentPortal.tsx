'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Calendar,
  Flame,
  Trophy,
  Play,
  Video,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Plus,
  Clock,
  CheckCircle2,
  MessageCircle,
  Dumbbell,
  Ruler,
  Bell,
  Check,
} from 'lucide-react';
import BodyMeasurementsModal from './BodyMeasurementsModal';
import { markNotificationReadAction } from '../../actions/measurements';
import { getCurrentMembershipOffer } from '../../lib/offers/membership-offer';
import './StudentPortal.css';

const BRAND_LOGO = 'https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp';

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
  has_zoom_link: boolean;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
};

type BodyMeasurement = {
  id: string;
  date: string;
  weight_kg: number;
  waist_cm: number | null;
  hips_cm: number | null;
  notes: string | null;
};

type Membership = {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  amount: number | null;
  currency: string | null;
};

interface Props {
  name: string;
  content: ContentItem[];
  sessions: LiveSession[];
  notifications: Notification[];
  membership: Membership | null;
  measurements: BodyMeasurement[];
  zoomState?: string;
}

function formatDate(isoDate: string) {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatPeriodEnd(isoString: string | null) {
  if (!isoString) return 'Vigencia activa';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function StudentPortal({
  name,
  content,
  sessions,
  notifications,
  membership,
  measurements = [],
  zoomState,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState(notifications);
  const [isUpdatingNotification, setIsUpdatingNotification] = useState<string | null>(null);

  const firstName = name.split(' ')[0] || 'Alumna';
  const nextSession = sessions[0] || null;
  const latestRecorded = content.find((c) => c.type === 'VIDEO') || content[0] || null;
  const unreadNotifications = notificationItems.filter((item) => !item.is_read);
  const displayedMembershipPrice = membership?.amount ?? getCurrentMembershipOffer().monthlyPrice;

  // Medidas más recientes y cálculos de tendencia
  const latestMeasurement = measurements[0] || null;
  const previousMeasurement = measurements[1] || null;
  const currentWeight = latestMeasurement?.weight_kg ?? null;
  const currentWaist = latestMeasurement?.waist_cm ?? null;
  const currentHips = latestMeasurement?.hips_cm ?? null;

  const weightDiff = previousMeasurement
    ? Number((currentWeight - previousMeasurement.weight_kg).toFixed(1))
    : null;

  // Puntos para la gráfica SVG de peso
  // Invertir orden cronológico para trazar de izquierda a derecha
  const chartData = measurements.length > 1 ? [...measurements].reverse() : [];
  const minWeight = chartData.length ? Math.min(...chartData.map((d) => d.weight_kg)) - 0.5 : 0;
  const maxWeight = chartData.length ? Math.max(...chartData.map((d) => d.weight_kg)) + 0.5 : 1;
  const range = maxWeight - minWeight || 1;

  const svgPoints = chartData
    .map((d, index) => {
      const x = 20 + (index / (chartData.length - 1 || 1)) * 260;
      const y = 80 - ((d.weight_kg - minWeight) / range) * 60;
      return `${x},${y}`;
    })
    .join(' ');

  const zoomMessage = zoomState === 'not-ready'
    ? 'El acceso a Zoom se habilita 15 minutos antes de la clase.'
    : zoomState === 'membership'
      ? 'Necesitas una membresía vigente para entrar a esta clase.'
      : zoomState
        ? 'No fue posible abrir esta clase. Inténtalo nuevamente desde el portal.'
        : null;

  const markNotificationAsRead = async (notificationId: string) => {
    setIsUpdatingNotification(notificationId);
    const result = await markNotificationReadAction(notificationId);
    if (result.success) {
      setNotificationItems((current) => current.map((item) => (
        item.id === notificationId ? { ...item, is_read: true } : item
      )));
    }
    setIsUpdatingNotification(null);
  };

  return (
    <div className="alumna-portal-container">
      {/* 1. Header Saludo */}
      <header className="alumna-header-row">
        <div>
          <h1 className="alumna-greeting">
            Hola, {firstName} <span className="greeting-wave">👋</span>
          </h1>
          <p className="alumna-greeting-sub">
            Bienvenida a tu panel de entrenamiento. ¡Hoy es un excelente día para avanzar!
          </p>
        </div>
        <div className="alumna-header-date">
          <button
            type="button"
            className="student-notifications-button"
            onClick={() => document.getElementById('avisos')?.scrollIntoView({ behavior: 'smooth' })}
            aria-label={`Ver ${unreadNotifications.length} aviso(s) sin leer`}
          >
            <Bell size={16} />
            <span>{unreadNotifications.length ? `${unreadNotifications.length} avisos` : 'Avisos'}</span>
          </button>
          <Calendar size={16} />
          <span>
            {new Intl.DateTimeFormat('es-CL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(new Date())}
          </span>
        </div>
      </header>

      {/* 2. Banner Hero Motivacional */}
      <section className="alumna-hero-banner">
        <div className="hero-banner-content">
          <span className="hero-pill-tag">
            <Sparkles size={14} /> TEAM NATY
          </span>
          <h2 className="hero-title">Tu espacio para entrenar a tu ritmo</h2>
          <p className="hero-copy">
            Encuentra tus clases en vivo, videos grabados y avances personales en un solo lugar.
          </p>
          <div className="hero-cta-group">
            {nextSession?.has_zoom_link ? (
              <a
                href={`/para-ti/zoom/${nextSession.id}`}
                target="_blank"
                rel="noreferrer"
                className="hero-btn-primary"
              >
                <Video size={16} />
                <span>Entrar a la clase en vivo</span>
              </a>
            ) : latestRecorded?.media_url ? (
              <a
                href={latestRecorded.media_url}
                target="_blank"
                rel="noreferrer"
                className="hero-btn-primary"
              >
                <Play size={16} fill="currentColor" />
                <span>Comenzar rutina de hoy</span>
              </a>
            ) : (
              <button
                onClick={() => setModalOpen(true)}
                className="hero-btn-primary"
              >
                <Plus size={16} />
                <span>Registrar mis medidas</span>
              </button>
            )}
          </div>
        </div>

        <div className="hero-banner-image-wrap">
          <img
            src={BRAND_LOGO}
            alt="Logo oficial Naty Entrenadora"
            className="hero-naty-photo"
          />
        </div>
      </section>

      {zoomMessage && <div className="student-inline-notice">{zoomMessage}</div>}

      {/* 3. Datos reales disponibles en el portal */}
      <section className="alumna-metrics-grid" aria-label="Métricas de la alumna">
        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Material disponible</span>
            <div className="metric-icon-wrap icon-purple">
              <Dumbbell size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{content.length}</span>
            <span className="metric-badge green">Biblioteca activa</span>
          </div>
          <div className="metric-bar-track">
            <div className="metric-bar-fill" style={{ width: content.length ? '100%' : '0%' }}></div>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Clases en vivo</span>
            <div className="metric-icon-wrap icon-orange">
              <Flame size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{sessions.length}</span>
            <span className="metric-badge orange">Próximamente</span>
          </div>
          <div className="metric-bar-track">
            <div className="metric-bar-fill orange-fill" style={{ width: sessions.length ? '100%' : '0%' }}></div>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Avisos nuevos</span>
            <div className="metric-icon-wrap icon-pink">
              <Trophy size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{unreadNotifications.length}</span>
            <span className="metric-badge purple">Mantente al día</span>
          </div>
          <div className="metric-bar-track">
            <div className="metric-bar-fill pink-fill" style={{ width: unreadNotifications.length ? '100%' : '0%' }}></div>
          </div>
        </article>
      </section>

      {/* 4. Layout Principal Dividido en Dos Columnas (Maqueta exacta) */}
      <div className="alumna-split-grid">
        {/* Columna Izquierda */}
        <div className="alumna-col-left">
          {/* Tip del día */}
          <article className="portal-card tip-card">
            <div className="tip-header">
              <div className="tip-badge">
                <Sparkles size={14} />
                <span>TIP DEL DÍA</span>
              </div>
            </div>
            <h3 className="tip-title">La hidratación también es parte de tu entrenamiento</h3>
            <p className="tip-copy">
              Ten agua cerca y adapta la intensidad a cómo te sientes hoy. La constancia se construye con sesiones que puedes sostener.
            </p>
          </article>

          {/* Próxima Clase en Vivo */}
          <article className="portal-card live-card">
            <div className="card-header-between">
              <div className="live-status-pill">
                <span className="live-pulse"></span>
                <span>PRÓXIMA CLASE EN VIVO</span>
              </div>
              <span className="live-zoom-tag">Vía Zoom</span>
            </div>

            {nextSession ? (
              <div className="live-card-body">
                <div className="live-time-badge">
                  <Clock size={16} />
                  <span>
                    {formatDate(nextSession.session_date)} · {nextSession.start_time.slice(0, 5)} hrs
                  </span>
                </div>
                <h3 className="live-session-name">
                  {nextSession.title || 'Clase en vivo Team Naty'}
                </h3>
                <div className="live-instructor-row">
                  <img
                    src={BRAND_LOGO}
                    alt="Logo Naty Entrenadora"
                    className="instructor-avatar"
                  />
                  <div>
                    <span className="instructor-name">Naty Entrenadora</span>
                    <span className="instructor-role">Coach principal</span>
                  </div>
                </div>

                {nextSession.has_zoom_link ? (
                  <a
                    href={`/para-ti/zoom/${nextSession.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-join-live"
                  >
                    <Video size={18} />
                    <span>Unirme a la clase en vivo</span>
                  </a>
                ) : (
                  <div className="zoom-waiting-note">
                    <span>El enlace de Zoom estará disponible 15 minutos antes de la clase.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-live-box">
                <Calendar size={28} className="empty-icon" />
                <p>Aún no hay clases en vivo programadas.</p>
                <span>Revisa la biblioteca para entrenar a tu propio ritmo.</span>
              </div>
            )}
          </article>

          {/* Mi Membresía */}
          <article className="portal-card membership-card">
            <div className="card-header-between">
              <h3>Mi Membresía</h3>
              <span className={`status-pill ${membership?.status === 'ACTIVE' ? 'pill-active' : 'pill-trial'}`}>
                {membership?.status === 'ACTIVE' ? 'Activa' : 'Período Activo'}
              </span>
            </div>
            <div className="membership-info-box">
              <div className="membership-row">
                <span className="m-label">Plan</span>
                <span className="m-value">Team Naty Online (${displayedMembershipPrice.toLocaleString('es-CL')} CLP / mes)</span>
              </div>
              <div className="membership-row">
                <span className="m-label">Próxima renovación</span>
                <span className="m-value">
                  {formatPeriodEnd(membership?.current_period_end || membership?.trial_ends_at || null)}
                </span>
              </div>
              <div className="membership-row">
                <span className="m-label">Beneficios incluidos</span>
                <span className="m-value green-text">
                  <CheckCircle2 size={14} /> Clases en vivo + Biblioteca + Comunidad
                </span>
              </div>
            </div>
            <Link href="/checkout" className="btn-manage-membership">
              <span>Gestionar suscripción</span>
              <ChevronRight size={16} />
            </Link>
          </article>
        </div>

        {/* Columna Derecha */}
        <div className="alumna-col-right">
          {/* Mi Progreso */}
          <article className="portal-card progress-card" id="progreso">
            <div className="card-header-between">
              <div>
                <h3>Mi Progreso</h3>
                <span className="card-subtitle">Evolución de peso y medidas</span>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="btn-add-measurements"
                title="Registrar nuevo peso y medidas"
              >
                <Plus size={16} />
                <span>Registrar</span>
              </button>
            </div>

            {chartData.length > 1 ? <div className="weight-chart-container">
              <svg viewBox="0 0 300 95" className="weight-svg-chart">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF4FB8" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#E9B4C0" stopOpacity="0.04" />
                  </linearGradient>
                </defs>
                <path
                  d={`M 20,85 L ${svgPoints} L 280,85 Z`}
                  fill="url(#chartGradient)"
                />
                <polyline
                  fill="none"
                  stroke="#FF4FB8"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={svgPoints}
                />
                {chartData.map((d, i) => {
                  const x = 20 + (i / (chartData.length - 1 || 1)) * 260;
                  const y = 80 - ((d.weight_kg - minWeight) / range) * 60;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="4.5"
                      fill="#ffffff"
                      stroke="#FF4FB8"
                      strokeWidth="2.5"
                    />
                  );
                })}
              </svg>
              <div className="chart-x-labels">
                <span>Inicial</span>
                <span>Actual ({currentWeight} kg)</span>
              </div>
            </div> : (
              <div className="measurements-empty-state">
                <Ruler size={24} />
                <p>Aún no has registrado medidas.</p>
                <span>Cuando quieras, agrega tu primer registro para ver tu evolución aquí.</span>
              </div>
            )}

            {/* Medidas Actuales */}
            <div className="measurements-pill-grid">
              <div className="measurement-pill">
                <span className="pill-name">Peso Actual</span>
                <div className="pill-num-row">
                  <strong>{currentWeight !== null ? `${currentWeight} kg` : '—'}</strong>
                  {weightDiff !== null && (
                    <span className={`diff-tag ${weightDiff <= 0 ? 'diff-good' : 'diff-neutral'}`}>
                      {weightDiff <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                      {Math.abs(weightDiff)} kg
                    </span>
                  )}
                </div>
              </div>

              <div className="measurement-pill">
                <span className="pill-name">Cintura</span>
                <div className="pill-num-row">
                  <strong>{currentWaist !== null ? `${currentWaist} cm` : '—'}</strong>
                </div>
              </div>

              <div className="measurement-pill">
                <span className="pill-name">Cadera</span>
                <div className="pill-num-row">
                  <strong>{currentHips !== null ? `${currentHips} cm` : '—'}</strong>
                </div>
              </div>
            </div>
          </article>

          {/* Última Clase Grabada */}
          <article className="portal-card recorded-card" id="clases">
            <div className="card-header-between">
              <h3>Última clase grabada</h3>
              <span className="card-subtitle">Disponible 24/7</span>
            </div>

            {latestRecorded ? (
              <div className="recorded-body">
                <div className="recorded-thumb-wrap">
                  <img
                    src={
                      latestRecorded.thumbnail_url || BRAND_LOGO
                    }
                    alt={latestRecorded.title}
                    className="recorded-thumbnail"
                  />
                  <div className="recorded-duration">
                    <Clock size={12} />
                    <span>
                      {latestRecorded.duration_seconds
                        ? `${Math.ceil(latestRecorded.duration_seconds / 60)} min`
                        : 'Duración por confirmar'}
                    </span>
                  </div>
                  {latestRecorded.media_url && (
                    <a
                      href={latestRecorded.media_url}
                      target="_blank"
                      rel="noreferrer"
                      className="play-overlay-btn"
                      aria-label="Reproducir video"
                    >
                      <Play size={20} fill="#ffffff" />
                    </a>
                  )}
                </div>
                <div className="recorded-meta">
                  <span className="category-pill">{latestRecorded.category || 'Entrenamiento'}</span>
                  <h4 className="recorded-title">{latestRecorded.title}</h4>
                  {latestRecorded.description && (
                    <p className="recorded-desc">{latestRecorded.description}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-recorded-box">
                <p>Muy pronto habrá nuevos videos en tu biblioteca.</p>
              </div>
            )}
          </article>

          {/* Accesos Rápidos */}
          <article className="portal-card shortcuts-card">
            <h3 className="shortcuts-title">Accesos rápidos</h3>
            <div className="shortcuts-grid">
              <a href="#clases" className="shortcut-item">
                <div className="shortcut-icon icon-purple">
                  <Dumbbell size={18} />
                </div>
                <span>Mis rutinas</span>
              </a>

              <button onClick={() => setModalOpen(true)} className="shortcut-item">
                <div className="shortcut-icon icon-pink">
                  <Ruler size={18} />
                </div>
                <span>Mis medidas</span>
              </button>

              <a
                href={nextSession?.has_zoom_link ? `/para-ti/zoom/${nextSession.id}` : '#clases'}
                target={nextSession?.has_zoom_link ? '_blank' : '_self'}
                rel="noreferrer"
                className="shortcut-item"
              >
                <div className="shortcut-icon icon-blue">
                  <Calendar size={18} />
                </div>
                <span>Calendario Zoom</span>
              </a>

              <a href="mailto:team@natyentrenadora.com?subject=Acceso%20a%20la%20comunidad%20Team%20Naty" className="shortcut-item">
                <div className="shortcut-icon icon-green">
                  <MessageCircle size={18} />
                </div>
                <span>Solicitar acceso a comunidad</span>
              </a>
            </div>
          </article>
        </div>
      </div>

      <section className="portal-card notifications-card" id="avisos" aria-labelledby="avisos-title">
        <div className="card-header-between">
          <div>
            <h3 id="avisos-title">Avisos de Team Naty</h3>
            <span className="card-subtitle">Novedades publicadas por Natalia para tu entrenamiento.</span>
          </div>
          <Bell size={19} aria-hidden="true" />
        </div>
        <div className="notifications-list">
          {notificationItems.map((notification) => (
            <article key={notification.id} className={`notification-item ${notification.is_read ? 'is-read' : 'is-unread'}`}>
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <span>{new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(new Date(notification.created_at))}</span>
              </div>
              {!notification.is_read && (
                <button
                  type="button"
                  onClick={() => markNotificationAsRead(notification.id)}
                  disabled={isUpdatingNotification === notification.id}
                  className="notification-read-button"
                >
                  <Check size={15} />
                  <span>{isUpdatingNotification === notification.id ? 'Guardando…' : 'Leído'}</span>
                </button>
              )}
            </article>
          ))}
          {notificationItems.length === 0 && <p className="empty-notifications">Aquí aparecerán las novedades, clases y videos que publique Natalia.</p>}
        </div>
      </section>

      {/* Modal para Registrar Medidas */}
      <BodyMeasurementsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        lastWeight={currentWeight ?? undefined}
        lastWaist={currentWaist ?? undefined}
        lastHips={currentHips ?? undefined}
      />
    </div>
  );
}
