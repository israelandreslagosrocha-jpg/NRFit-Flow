import React from 'react';
import { useUserData } from '../../context/UserDataContext';
import StatCard from '../../components/ui/StatCard';
import { DollarSign, Users, CreditCard, AlertTriangle, ArrowUpRight, Video, BarChart2 } from 'lucide-react';
import './AdminDashboardHome.css';

export default function AdminDashboardHome() {
  const { adminMetrics, studentsList } = useUserData();

  return (
    <div className="admin-dashboard-page animate-fade-in">
      <div className="admin-page-header">
        <div>
          <span className="admin-header-tag">DASHBOARD DE GESTIÓN</span>
          <h1 className="admin-page-title">Resumen de Negocio & Operaciones</h1>
        </div>
        <button className="btn btn-primary btn-sm">
          <span>+ Crear Nueva Alumna</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid-3">
        <StatCard 
          title="MRR (Ingresos Recurrentes)" 
          value={adminMetrics.mrr} 
          subtitle="vs. mes anterior" 
          trend={adminMetrics.mrrGrowth} 
          icon={DollarSign} 
          color="purple" 
        />
        <StatCard 
          title="Alumnas Activas" 
          value={adminMetrics.activeStudents} 
          subtitle="Crecimiento continuo" 
          trend={adminMetrics.studentsGrowth} 
          icon={Users} 
          color="pink" 
        />
        <StatCard 
          title="Pagos Pendientes" 
          value={adminMetrics.pendingPaymentsTotal} 
          subtitle={`${adminMetrics.pendingPaymentsCount} cuentas por cobrar`} 
          trend="Revisar urgente" 
          icon={AlertTriangle} 
          color="orange" 
        />
      </div>

      {/* Main Admin Section: Recent Activity & Students Quick Overview */}
      <div className="admin-grid-2">
        {/* Table summary of students */}
        <div className="admin-card glass-card">
          <div className="card-header-flex">
            <h3 className="card-title">Alumnas Recientes</h3>
            <span className="card-badge-purple">Total: {studentsList.length}</span>
          </div>

          <div className="table-responsive-wrapper">
            <table className="custom-table admin-table">
              <thead>
                <tr>
                  <th>Alumna</th>
                  <th>Plan Actual</th>
                  <th>Estado</th>
                  <th>Renovación</th>
                </tr>
              </thead>
              <tbody>
                {studentsList.slice(0, 4).map(st => (
                  <tr key={st.id}>
                    <td>
                      <div className="table-user-cell">
                        <img src={st.avatar} alt={st.name} className="table-avatar" />
                        <div>
                          <span className="t-name">{st.name}</span>
                          <span className="t-email">{st.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{st.plan}</td>
                    <td>
                      <span className={`status-pill ${st.status === 'Activa' ? 'active' : 'pending'}`}>
                        {st.status}
                      </span>
                    </td>
                    <td>{st.renewalDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Operations Panel */}
        <div className="admin-card glass-card">
          <h3 className="card-title">Acciones Rápidas de Admin</h3>
          <p className="card-subtitle">Gestión directa de contenido y programación</p>

          <div className="admin-quick-actions">
            <div className="quick-action-item">
              <Video size={20} className="q-icon" />
              <div>
                <h4>Programar Clase en Vivo</h4>
                <p>Generar enlace Zoom e incrustar en calendario</p>
              </div>
              <ArrowUpRight size={18} className="arrow-icon" />
            </div>

            <div className="quick-action-item">
              <CreditCard size={20} className="q-icon" />
              <div>
                <h4>Gestionar Cupones de Descuento</h4>
                <p>Crear códigos promocionales para campañas</p>
              </div>
              <ArrowUpRight size={18} className="arrow-icon" />
            </div>

            <div className="quick-action-item">
              <BarChart2 size={20} className="q-icon" />
              <div>
                <h4>Ver Reporte de Ingresos</h4>
                <p>Descargar balance de facturación mensual</p>
              </div>
              <ArrowUpRight size={18} className="arrow-icon" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
