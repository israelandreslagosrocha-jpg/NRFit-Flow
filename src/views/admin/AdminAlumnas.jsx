import React, { useState } from 'react';
import { useUserData } from '../../context/UserDataContext';
import { Search, UserPlus, MoreVertical, Shield, Filter } from 'lucide-react';
import './AdminAlumnas.css';

export default function AdminAlumnas() {
  const { studentsList } = useUserData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('Todos');

  const filtered = studentsList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'Todos' || s.plan === filterPlan;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="admin-alumnas-page animate-fade-in">
      <div className="admin-page-header">
        <div>
          <span className="admin-header-tag">GESTIÓN DE USUARIAS</span>
          <h1 className="admin-page-title">Directorio de Alumnas</h1>
        </div>
        <button className="btn btn-primary btn-sm">
          <UserPlus size={16} />
          <span>Registrar Alumna</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar glass-card">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar alumna por nombre o email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-pills-row">
          <span className="filter-label"><Filter size={14} /> Filtrar por Plan:</span>
          {['Todos', 'GAP en Casa Mujeres', 'Método 40/3', 'Programa Post-Parto', 'Entrenamiento Presencial'].map(plan => (
            <button 
              key={plan}
              onClick={() => setFilterPlan(plan)}
              className={`pill-btn ${filterPlan === plan ? 'active' : ''}`}
            >
              {plan}
            </button>
          ))}
        </div>
      </div>

      {/* Full Students Table */}
      <div className="admin-card glass-card">
        <div className="table-responsive-wrapper">
          <table className="custom-table admin-table">
            <thead>
              <tr>
                <th>Alumna</th>
                <th>Plan Inscrito</th>
                <th>Estado de Pago</th>
                <th>Próxima Renovación</th>
                <th>Total Facturado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(student => (
                <tr key={student.id}>
                  <td>
                    <div className="table-user-cell">
                      <img src={student.avatar} alt={student.name} className="table-avatar" />
                      <div>
                        <span className="t-name">{student.name}</span>
                        <span className="t-email">{student.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="plan-badge">{student.plan}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${student.status === 'Activa' ? 'active' : 'pending'}`}>
                      {student.status}
                    </span>
                  </td>
                  <td>{student.renewalDate}</td>
                  <td className="font-weight-600">{student.totalPaid}</td>
                  <td>
                    <button className="icon-btn-sm" title="Opciones">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
