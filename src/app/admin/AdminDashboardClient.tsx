'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Video,
  Film,
  Bell,
  Search,
  Plus,
  ExternalLink,
  DollarSign,
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle2,
  Eye,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
  Send,
  Trash2,
} from 'lucide-react';
import { AuthSignOutButton } from '../../components/auth/AuthSignOutButton';
import {
  publishContentAction,
  createLiveSessionAction,
  archiveContentAction,
  sendBroadcastNotificationAction,
} from '../../actions/admin-portal';

type Student = {
  id: string;
  created_at: string;
  profile: {
    id?: string;
    full_name: string;
  } | null;
  memberships: Array<{
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    created_at: string;
    amount?: number | null;
    currency?: string | null;
    billing_email?: string | null;
  }>;
};

type ContentItem = {
  id: string;
  title: string;
  type: string;
  category: string | null;
  duration_seconds: number | null;
  publish_date: string | null;
  is_active: boolean;
  media_url: string | null;
  thumbnail_url: string | null;
};

type LiveSession = {
  id: string;
  title: string | null;
  session_date: string;
  start_time: string;
  zoom_join_url: string | null;
  max_capacity: number;
};

type Transaction = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_date: string;
  gateway_payment_id: string;
};

interface Props {
  profileName: string;
  students: Student[];
  content: ContentItem[];
  sessions: LiveSession[];
  transactions: Transaction[];
  message?: {
    success?: string;
    error?: string;
  };
}

function formatCLP(amount: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(isoDate: string | null | undefined) {
  if (!isoDate) return '—';
  try {
    const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`);
    return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  } catch {
    return isoDate;
  }
}

function santiagoDateInputValue(date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function nextTeamNatyLiveDate(): string {
  const [year, month, day] = santiagoDateInputValue().split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day, 12));
  while (![1, 3].includes(candidate.getUTCDay())) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate.toISOString().slice(0, 10);
}

export default function AdminDashboardClient({
  profileName,
  students,
  content,
  sessions,
  transactions,
  message,
}: Props) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alumnas' | 'clases' | 'contenido' | 'pagos' | 'comunicaciones'>('dashboard');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<'TODAS' | 'ACTIVAS' | 'NUEVAS' | 'INACTIVAS'>('TODAS');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const earliestLiveDate = santiagoDateInputValue();
  const defaultLiveDate = nextTeamNatyLiveDate();

  // Métricas calculadas
  const activeStudentsCount = students.filter((s) =>
    (s.memberships || []).some((m) => ['ACTIVE', 'TRIAL'].includes(m.status))
  ).length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newStudentsCount = students.filter((s) => new Date(s.created_at) >= thirtyDaysAgo).length;

  const pendingPaymentsCount = students.filter((s) =>
    (s.memberships || []).some((m) => ['PAST_DUE', 'PENDING_PAYMENT'].includes(m.status))
  ).length;

  const paidTransactions = transactions.filter((t) => t.status === 'APPROVED' || t.status === 'PAID');
  const totalRevenue = paidTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const activeContentCount = content.filter((item) => item.is_active).length;

  // Filtrado de alumnas
  const filteredStudents = students.filter((s) => {
    const name = s.profile?.full_name || 'Sin nombre';
    const matchesSearch = name.toLowerCase().includes(studentSearch.toLowerCase());
    const latestMembership = (s.memberships || [])[0];
    const status = latestMembership?.status;

    if (!matchesSearch) return false;
    if (studentFilter === 'ACTIVAS') return ['ACTIVE', 'TRIAL'].includes(status || '');
    if (studentFilter === 'NUEVAS') return new Date(s.created_at) >= thirtyDaysAgo;
    if (studentFilter === 'INACTIVAS') return !['ACTIVE', 'TRIAL'].includes(status || '');
    return true;
  });

  return (
    <div className="admin-shell">
      {/* 1. SIDEBAR IZQUIERDA OSCURA (Estilo idéntico a las maquetas) */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand-box">
          <div className="sidebar-logo">
            <span className="logo-pink">NATY</span>
            <span className="logo-white">ENTRENADORA</span>
          </div>
          <span className="sidebar-tagline">Fuerza · Disciplina · Confianza</span>
        </div>

        <nav className="sidebar-menu">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`nav-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('alumnas')}
            className={`nav-button ${activeTab === 'alumnas' ? 'active' : ''}`}
          >
            <Users size={19} />
            <span>Alumnas</span>
            <span className="nav-badge">{students.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('clases')}
            className={`nav-button ${activeTab === 'clases' ? 'active' : ''}`}
          >
            <Video size={19} />
            <span>Clases en Vivo</span>
            {sessions.length > 0 && <span className="nav-badge purple">{sessions.length}</span>}
          </button>

          <button
            onClick={() => setActiveTab('contenido')}
            className={`nav-button ${activeTab === 'contenido' ? 'active' : ''}`}
          >
            <Film size={19} />
            <span>Contenido</span>
          </button>

          <button
            onClick={() => setActiveTab('pagos')}
            className={`nav-button ${activeTab === 'pagos' ? 'active' : ''}`}
          >
            <CreditCard size={19} />
            <span>Membresías y Pagos</span>
          </button>

          <button
            onClick={() => setActiveTab('comunicaciones')}
            className={`nav-button ${activeTab === 'comunicaciones' ? 'active' : ''}`}
          >
            <Bell size={19} />
            <span>Comunicaciones</span>
          </button>
        </nav>

        {/* Accesos Rápidos Inferiores */}
        <div className="sidebar-quick-actions">
          <span className="quick-title">ACCESOS RÁPIDOS</span>
          <div className="quick-grid">
            <button
              onClick={() => setActiveTab('clases')}
              className="quick-btn"
              title="Programar nueva clase Zoom"
            >
              <Video size={16} />
              <span>Nueva clase</span>
            </button>
            <button
              onClick={() => setActiveTab('contenido')}
              className="quick-btn"
              title="Publicar video a biblioteca"
            >
              <Film size={16} />
              <span>Subir video</span>
            </button>
            <button
              onClick={() => setActiveTab('comunicaciones')}
              className="quick-btn"
              title="Enviar aviso a alumnas"
            >
              <Bell size={16} />
              <span>Enviar aviso</span>
            </button>
            <Link
              href="/para-ti"
              target="_blank"
              className="quick-btn"
              title="Ver portal de alumna"
            >
              <ExternalLink size={16} />
              <span>Ver alumna</span>
            </Link>
          </div>
        </div>

        {/* Perfil Admin y Botón Salir */}
        <div className="sidebar-admin-profile">
          <img
            src="https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp"
            alt="Logo oficial Naty Entrenadora"
            className="admin-avatar"
          />
          <div className="admin-profile-details">
            <span className="admin-name">{profileName}</span>
            <span className="admin-role">Administradora</span>
          </div>
          <AuthSignOutButton className="admin-logout-icon-btn" />
        </div>
      </aside>

      {/* 2. LIENZO PRINCIPAL (Header superior + Contenido de pestañas) */}
      <main className="admin-main-canvas">
        {/* Header Superior */}
        <header className="admin-top-header">
          <div className="header-breadcrumbs">
            <span className="crumb-root">Dashboard</span>
            <ChevronRight size={14} className="crumb-arrow" />
            <span className="crumb-current">
              {activeTab === 'dashboard' && 'Resumen General'}
              {activeTab === 'alumnas' && 'Directorio de Alumnas'}
              {activeTab === 'clases' && 'Sesiones en Vivo (Zoom)'}
              {activeTab === 'contenido' && 'Biblioteca Multimedia'}
              {activeTab === 'pagos' && 'Membresías & Transacciones Flow'}
              {activeTab === 'comunicaciones' && 'Avisos & Comunicaciones'}
            </span>
          </div>

          <div className="header-actions">
            <div className="header-date-badge">
              <Calendar size={15} />
              <span>
                {new Intl.DateTimeFormat('es-CL', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date())}
              </span>
            </div>

            <Link href="/para-ti" target="_blank" className="btn-preview-portal">
              <span>Ver portal alumna</span>
              <ExternalLink size={14} />
            </Link>

            <button
              onClick={() => setActiveTab('comunicaciones')}
              className="header-bell-btn"
              title="Ir a comunicaciones"
            >
              <Bell size={18} />
            </button>
          </div>
        </header>

        {/* Mensajes de éxito o error */}
        {message?.success && (
          <div className="admin-banner-alert success">
            <CheckCircle2 size={18} />
            <span>{message.success}</span>
          </div>
        )}
        {message?.error && (
          <div className="admin-banner-alert error">
            <AlertTriangle size={18} />
            <span>{message.error}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 1: DASHBOARD HOME (Maqueta 04_48_21 p.m.)              */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <div className="tab-pane animate-fade-in">
            {/* Indicadores estrictamente derivados de datos reales */}
            <div className="kpi-banner-grid">
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-title">ALUMNAS ACTIVAS</span>
                  <div className="kpi-icon-wrap purple">
                    <Users size={18} />
                  </div>
                </div>
                <div className="kpi-number-row">
                  <strong className="kpi-big-num">{activeStudentsCount}</strong>
                </div>
                <span className="kpi-foot">Acceso activo al portal</span>
              </div>

              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-title">NUEVAS ALUMNAS</span>
                  <div className="kpi-icon-wrap pink">
                    <Sparkles size={18} />
                  </div>
                </div>
                <div className="kpi-number-row">
                  <strong className="kpi-big-num">{newStudentsCount}</strong>
                </div>
                <span className="kpi-foot">Registradas en los últimos 30 días</span>
              </div>

              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-title">COBROS RECIBIDOS</span>
                  <div className="kpi-icon-wrap green">
                    <DollarSign size={18} />
                  </div>
                </div>
                <div className="kpi-number-row">
                  <strong className="kpi-big-num">{formatCLP(totalRevenue)}</strong>
                </div>
                <span className="kpi-foot">{paidTransactions.length} transacción(es) aprobada(s)</span>
              </div>

              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-title">PAGOS PENDIENTES</span>
                  <div className="kpi-icon-wrap orange">
                    <AlertTriangle size={18} />
                  </div>
                </div>
                <div className="kpi-number-row">
                  <strong className="kpi-big-num">{pendingPaymentsCount}</strong>
                </div>
                <span className="kpi-foot">Requieren seguimiento</span>
              </div>

              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-title">CONTENIDO ACTIVO</span>
                  <div className="kpi-icon-wrap blue">
                    <Film size={18} />
                  </div>
                </div>
                <div className="kpi-number-row">
                  <strong className="kpi-big-num">{activeContentCount}</strong>
                </div>
                <span className="kpi-foot">Disponible para las alumnas</span>
              </div>
            </div>

            {/* Resumen operativo sin proyectar tendencias ni ingresos ficticios */}
            <div className="charts-split-grid">
              <div className="panel-card">
                <div className="panel-header-between">
                  <div>
                    <h3 className="panel-title">Estado de la plataforma</h3>
                    <span className="panel-subtitle">Resumen de lo que está disponible hoy.</span>
                  </div>
                </div>
                <ul className="admin-operation-list">
                  <li><Users size={17} /><span>{activeStudentsCount} alumna(s) con acceso vigente.</span></li>
                  <li><Video size={17} /><span>{sessions.length} clase(s) en vivo programada(s).</span></li>
                  <li><Film size={17} /><span>{activeContentCount} recurso(s) publicados en la biblioteca.</span></li>
                  <li><CreditCard size={17} /><span>{pendingPaymentsCount} pago(s) pendiente(s) de revisión.</span></li>
                </ul>
              </div>

              <div className="panel-card">
                <div className="panel-header-between">
                  <div>
                    <h3 className="panel-title">Team Naty Online</h3>
                    <span className="panel-subtitle">La única membresía disponible en esta etapa.</span>
                  </div>
                </div>
                <ul className="admin-operation-list brand-list">
                  <li><CheckCircle2 size={17} /><span>7 días de prueba y precio mensual fijado al momento de cada inscripción.</span></li>
                  <li><CheckCircle2 size={17} /><span>Dos clases en vivo: lunes y miércoles.</span></li>
                  <li><CheckCircle2 size={17} /><span>Tres entrenamientos grabados por semana.</span></li>
                  <li><CheckCircle2 size={17} /><span>Sesiones de entre 10 y 40 minutos.</span></li>
                </ul>
              </div>
            </div>

            {/* Fila Media: Alumnas Recientes & Próxima Clase Zoom */}
            <div className="dashboard-double-panel">
              {/* Tabla Resumen Alumnas */}
              <div className="panel-card">
                <div className="panel-header-between">
                  <h3 className="panel-title">Alumnas Recientes</h3>
                  <button onClick={() => setActiveTab('alumnas')} className="link-see-all">
                    <span>Ver todas</span>
                    <ArrowUpRight size={15} />
                  </button>
                </div>

                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Alumna</th>
                        <th>Plan</th>
                        <th>Estado</th>
                        <th>Vencimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.slice(0, 5).map((student) => {
                        const m = (student.memberships || [])[0];
                        const name = student.profile?.full_name || 'Sin nombre';
                        const isActive = ['ACTIVE', 'TRIAL'].includes(m?.status || '');
                        return (
                          <tr key={student.id}>
                            <td>
                              <div className="user-cell">
                                <div className="avatar-circle">{name.charAt(0)}</div>
                                <span className="cell-name">{name}</span>
                              </div>
                            </td>
                            <td>Team Naty Online</td>
                            <td>
                              <span className={`status-badge ${isActive ? 'active' : 'pending'}`}>
                                {isActive ? 'Activa' : (m?.status || 'Inactiva')}
                              </span>
                            </td>
                            <td>{formatDate(m?.trial_ends_at || m?.current_period_end)}</td>
                          </tr>
                        );
                      })}
                      {students.length === 0 && (
                        <tr>
                          <td colSpan={4} className="empty-td">No hay alumnas registradas todavía.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Próximas Clases Zoom */}
              <div className="panel-card">
                <div className="panel-header-between">
                  <h3 className="panel-title">Próximas Clases en Vivo</h3>
                  <button onClick={() => setActiveTab('clases')} className="btn-small-primary">
                    <Plus size={14} />
                    <span>Programar</span>
                  </button>
                </div>

                <div className="live-sessions-stack">
                  {sessions.slice(0, 3).map((session) => (
                    <div key={session.id} className="session-item-row">
                      <div className="session-date-box">
                        <Clock size={16} />
                        <span>{session.start_time.slice(0, 5)}</span>
                      </div>
                      <div className="session-info">
                        <strong>{session.title || 'Clase en vivo con Naty'}</strong>
                        <span>{formatDate(session.session_date)} · Vía Zoom</span>
                      </div>
                      {session.zoom_join_url && (
                        <a
                          href={session.zoom_join_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-zoom-host"
                        >
                          <Video size={14} />
                          <span>Iniciar Zoom</span>
                        </a>
                      )}
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <div className="empty-state-box">
                      <p>No hay clases Zoom programadas para los próximos días.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 2: ALUMNAS (Maqueta 04_54_10 p.m.)                     */}
        {/* ============================================================== */}
        {activeTab === 'alumnas' && (
          <div className="tab-pane animate-fade-in">
            <div className="tab-actions-bar">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar alumna por nombre..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>

              <div className="filter-pill-group">
                {(['TODAS', 'ACTIVAS', 'NUEVAS', 'INACTIVAS'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStudentFilter(filter)}
                    className={`filter-btn ${studentFilter === filter ? 'active' : ''}`}
                  >
                    {filter === 'TODAS' && 'Todas'}
                    {filter === 'ACTIVAS' && `Activas (${activeStudentsCount})`}
                    {filter === 'NUEVAS' && `Nuevas (${newStudentsCount})`}
                    {filter === 'INACTIVAS' && 'Inactivas'}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-card">
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Alumna</th>
                      <th>Plan</th>
                      <th>Estado</th>
                      <th>Fecha Registro</th>
                      <th>Próxima Renovación</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => {
                      const m = (student.memberships || [])[0];
                      const name = student.profile?.full_name || 'Sin nombre';
                      const isActive = ['ACTIVE', 'TRIAL'].includes(m?.status || '');
                      return (
                        <tr key={student.id}>
                          <td>
                            <div className="user-cell">
                              <div className="avatar-circle">{name.charAt(0)}</div>
                              <div>
                                <span className="cell-name">{name}</span>
                                <span className="cell-sub">{m?.billing_email || 'Sin email registrado'}</span>
                              </div>
                            </div>
                          </td>
                          <td>Team Naty Online</td>
                          <td>
                            <span className={`status-badge ${isActive ? 'active' : 'pending'}`}>
                              {isActive ? 'Activa' : (m?.status || 'Inactiva')}
                            </span>
                          </td>
                          <td>{formatDate(student.created_at)}</td>
                          <td>{formatDate(m?.trial_ends_at || m?.current_period_end)}</td>
                          <td>
                            <button
                              onClick={() => setSelectedStudent(student)}
                              className="btn-table-action"
                              title="Ver ficha de alumna"
                            >
                              <Eye size={15} />
                              <span>Detalle</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="empty-td">No se encontraron alumnas con los filtros aplicados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Drawer/Modal de Detalle de Alumna */}
            {selectedStudent && (
              <div className="student-drawer-backdrop" onClick={() => setSelectedStudent(null)}>
                <div className="student-drawer-card" onClick={(e) => e.stopPropagation()}>
                  <div className="drawer-header">
                    <h3>Ficha de Alumna</h3>
                    <button onClick={() => setSelectedStudent(null)} className="btn-close-drawer">✕</button>
                  </div>
                  <div className="drawer-body">
                    <div className="drawer-avatar-row">
                      <div className="drawer-big-avatar">{selectedStudent.profile?.full_name?.charAt(0) || 'A'}</div>
                      <div>
                        <h4>{selectedStudent.profile?.full_name || 'Alumna'}</h4>
                        <span>Registrada el {formatDate(selectedStudent.created_at)}</span>
                      </div>
                    </div>
                    <div className="drawer-section">
                      <h5>Membresía Actual</h5>
                      <div className="drawer-info-row">
                        <span>Plan:</span>
                        <strong>Team Naty Online</strong>
                      </div>
                      <div className="drawer-info-row">
                        <span>Estado:</span>
                        <strong>{(selectedStudent.memberships || [])[0]?.status || 'Sin membresía'}</strong>
                      </div>
                      <div className="drawer-info-row">
                        <span>Vigencia:</span>
                        <strong>{formatDate((selectedStudent.memberships || [])[0]?.trial_ends_at || (selectedStudent.memberships || [])[0]?.current_period_end)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 3: CLASES EN VIVO (Maqueta 11_43_26 p.m.)              */}
        {/* ============================================================== */}
        {activeTab === 'clases' && (
          <div className="tab-pane animate-fade-in">
            <div className="dashboard-double-panel">
              {/* Agenda de Clases Programadas */}
              <div className="panel-card">
                <div className="panel-header-between">
                  <div>
                    <h3 className="panel-title">Agenda de Clases en Vivo</h3>
                    <span className="panel-subtitle">Transmitidas exclusivamente por Zoom</span>
                  </div>
                  <span className="total-students-pill">{sessions.length} Programadas</span>
                </div>

                <div className="sessions-list">
                  {sessions.map((s) => (
                    <div key={s.id} className="live-session-full-card">
                      <div className="session-left">
                        <div className="date-badge-box">
                          <span className="d-day">{s.session_date.slice(8, 10)}</span>
                          <span className="d-month">{s.session_date.slice(5, 7)}</span>
                        </div>
                        <div>
                          <h4 className="s-title">{s.title || 'Clase en vivo'}</h4>
                          <span className="s-time">
                            <Clock size={13} /> {s.start_time.slice(0, 5)} hrs · Capacidad: {s.max_capacity} alumnas
                          </span>
                        </div>
                      </div>
                      {s.zoom_join_url && (
                        <a
                          href={s.zoom_join_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-join-zoom-direct"
                        >
                          <Video size={16} />
                          <span>Abrir Zoom</span>
                        </a>
                      )}
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <div className="empty-state-box">
                      <p>No tienes clases en vivo programadas. Usa el formulario para programar la próxima.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Formulario para Programar Nueva Sesión Zoom */}
              <div className="panel-card">
                <div className="panel-header-between">
                  <div>
                    <h3 className="panel-title">Programar Nueva Clase</h3>
                    <span className="panel-subtitle">Disponible los lunes y miércoles; se enviará un aviso al portal de las alumnas activas.</span>
                  </div>
                </div>

                <form action={createLiveSessionAction} className="admin-form-styled">
                  <div className="form-group">
                    <label>Título de la clase *</label>
                    <input
                      name="title"
                      required
                      maxLength={255}
                      placeholder="Ej: Fuerza funcional y movilidad"
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Fecha *</label>
                      <input
                        type="date"
                        name="session_date"
                        required
                        min={earliestLiveDate}
                        defaultValue={defaultLiveDate}
                      />
                      <span className="form-help">Solo lunes o miércoles.</span>
                    </div>
                    <div className="form-group">
                      <label>Hora *</label>
                      <input
                        type="time"
                        name="start_time"
                        required
                        defaultValue="19:00"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Enlace de Zoom *</label>
                    <input
                      type="url"
                      name="zoom_join_url"
                      required
                      placeholder="https://us02web.zoom.us/j/..."
                    />
                  </div>

                  <input type="hidden" name="max_capacity" value="100" />

                  <button type="submit" className="btn-submit-action">
                    <Video size={16} />
                    <span>Programar Clase y Notificar</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 4: CONTENIDO & BIBLIOTECA (Maqueta 11_43_23 p.m.)        */}
        {/* ============================================================== */}
        {activeTab === 'contenido' && (
          <div className="tab-pane animate-fade-in">
            <div className="dashboard-double-panel">
              {/* Catálogo de Videos Publicados */}
              <div className="panel-card">
                <div className="panel-header-between">
                  <div>
                    <h3 className="panel-title">Biblioteca de Clases</h3>
                    <span className="panel-subtitle">Material visible para alumnas activas</span>
                  </div>
                  <span className="total-students-pill">{content.length} Recursos</span>
                </div>

                <div className="content-grid-cards">
                  {content.map((item) => (
                    <div key={item.id} className="content-admin-card">
                      <div className="card-thumb-wrap">
                        {item.thumbnail_url ? (
                          <img src={item.thumbnail_url} alt={item.title} className="thumb-img" />
                        ) : (
                          <div className="thumb-placeholder">
                            <Film size={28} />
                          </div>
                        )}
                        <span className="card-type-tag">{item.type}</span>
                      </div>
                      <div className="card-details">
                        <span className="c-category">{item.category || 'General'}</span>
                        <h4 className="c-title">{item.title}</h4>
                        <span className="c-date">Publicado: {formatDate(item.publish_date)}</span>
                        <div className="card-actions-row">
                          {item.media_url && (
                            <a href={item.media_url} target="_blank" rel="noreferrer" className="btn-view-content">
                              <ExternalLink size={13} />
                              <span>Ver</span>
                            </a>
                          )}
                          {item.is_active && (
                            <form action={archiveContentAction}>
                              <input type="hidden" name="content_id" value={item.id} />
                              <button type="submit" className="btn-archive" title="Archivar">
                                <Trash2 size={13} />
                                <span>Archivar</span>
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {content.length === 0 && (
                    <div className="empty-state-box">
                      <p>Aún no hay contenido publicado en la biblioteca.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Formulario para Publicar Contenido */}
              <div className="panel-card">
                <div className="panel-header-between">
                  <div>
                    <h3 className="panel-title">Publicar Nuevo Video</h3>
                    <span className="panel-subtitle">Aparece de inmediato en el portal de alumnas</span>
                  </div>
                </div>

                <form action={publishContentAction} className="admin-form-styled">
                  <div className="form-group">
                    <label>Título del video o material *</label>
                    <input
                      name="title"
                      required
                      maxLength={255}
                      placeholder="Ej: Rutina Piernas y Glúteos · Nivel 1"
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Tipo *</label>
                      <select name="type" defaultValue="VIDEO">
                        <option value="VIDEO">Video de Clase</option>
                        <option value="TIP">Tip de Nutrición/Técnica</option>
                        <option value="PDF_GUIDE">Guía PDF</option>
                        <option value="BONUS">Bonus Especial</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Categoría</label>
                      <input
                        name="category"
                        maxLength={100}
                        placeholder="Ej: Fuerza funcional, movilidad"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Enlace del video (YouTube, Vimeo, Cloudinary) *</label>
                    <input
                      name="media_url"
                      type="url"
                      required
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Enlace de la miniatura (opcional)</label>
                      <input
                        name="thumbnail_url"
                        type="url"
                        placeholder="https://res.cloudinary.com/..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Descripción breve</label>
                    <textarea
                      name="description"
                      rows={2}
                      maxLength={500}
                      placeholder="Qué trabajarán y qué equipamiento necesitan..."
                    />
                  </div>

                  <button type="submit" className="btn-submit-action">
                    <Film size={16} />
                    <span>Publicar Video y Notificar</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 5: MEMBRESÍAS Y PAGOS (Maquetas 11_43_53 / 11_44_00)    */}
        {/* ============================================================== */}
        {activeTab === 'pagos' && (
          <div className="tab-pane animate-fade-in">
            {/* KPIs de Membresías */}
            <div className="kpi-banner-grid four-cols">
              <div className="kpi-card">
                <span className="kpi-title">TOTAL SUSCRIPCIONES</span>
                <strong className="kpi-big-num">{activeStudentsCount}</strong>
                <span className="kpi-foot">Team Naty Online</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-title">COBROS RECIBIDOS</span>
                <strong className="kpi-big-num">{formatCLP(totalRevenue)}</strong>
                <span className="kpi-foot">Transacciones aprobadas registradas</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-title">POR RENOVAR (7 DÍAS)</span>
                <strong className="kpi-big-num">
                  {students.filter((s) => {
                    const m = (s.memberships || [])[0];
                    const exp = m?.trial_ends_at || m?.current_period_end;
                    if (!exp) return false;
                    const diffDays = Math.ceil((new Date(exp).getTime() - Date.now()) / (1000 * 3600 * 24));
                    return diffDays >= 0 && diffDays <= 7;
                  }).length}
                </strong>
                <span className="kpi-foot">Alumnas próximas a vencer</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-title">PAGOS PENDIENTES</span>
                <strong className="kpi-big-num">{pendingPaymentsCount}</strong>
                <span className="kpi-foot">Requieren revisión manual</span>
              </div>
            </div>

            {/* Historial de Transacciones Flow */}
            <div className="panel-card">
              <div className="panel-header-between">
                <div>
                  <h3 className="panel-title">Transacciones Recientes de Flow</h3>
                  <span className="panel-subtitle">Historial de órdenes y pagos procesados</span>
                </div>
                <span className="total-students-pill">{transactions.length} Registros</span>
              </div>

              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Orden Flow</th>
                      <th>Monto</th>
                      <th>Medio de Pago</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td><code>{tx.gateway_payment_id}</code></td>
                        <td><strong>{formatCLP(tx.amount)}</strong></td>
                        <td>{tx.payment_method || 'Webpay / Tarjeta'}</td>
                        <td>{formatDate(tx.payment_date)}</td>
                        <td>
                          <span className={`status-badge ${tx.status === 'APPROVED' || tx.status === 'PAID' ? 'active' : 'pending'}`}>
                            {tx.status === 'APPROVED' ? 'Aprobado' : tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="empty-td">Aún no hay transacciones registradas en este período.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 6: COMUNICACIONES                                       */}
        {/* ============================================================== */}
        {activeTab === 'comunicaciones' && (
          <div className="tab-pane animate-fade-in">
            <div className="panel-card max-w-600">
              <div className="panel-header-between">
                <div>
                  <h3 className="panel-title">Enviar Notificación a Alumnas Activas</h3>
                  <span className="panel-subtitle">Aparecerá en el portal de todas las alumnas suscritas</span>
                </div>
              </div>

              <form action={sendBroadcastNotificationAction} className="admin-form-styled">
                <div className="form-group">
                  <label>Título del aviso *</label>
                  <input
                    name="title"
                    required
                    maxLength={255}
                    placeholder="Ej: Recordatorio: Clase especial de técnica este viernes"
                  />
                </div>

                <div className="form-group">
                  <label>Mensaje del aviso *</label>
                  <textarea
                    name="message"
                    required
                    rows={4}
                    maxLength={2000}
                    placeholder="Escribe el mensaje motivacional, instrucción o recordatorio para las alumnas..."
                  />
                </div>

                <button type="submit" className="btn-submit-action">
                  <Send size={16} />
                  <span>Enviar Aviso a Alumnas Activas</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
