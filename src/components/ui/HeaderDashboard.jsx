'use client';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, User, Flame, Bell, Sparkles } from 'lucide-react';
import './HeaderDashboard.css';

export default function HeaderDashboard() {
  const { role, toggleRole, activeSystem, changeSystem, user } = useAuth();

  return (
    <header className="dashboard-header glass-card">
      <div className="header-left">
        <div className="brand-badge">
          <span className="brand-dot"></span>
          <span className="brand-text">NATY ENTRENADORA</span>
        </div>

        {role === 'alumna' && (
          <div className="system-selector">
            <span className="selector-label">Sistema:</span>
            <select 
              value={activeSystem} 
              onChange={(e) => changeSystem(e.target.value)}
              className="system-select"
            >
              <option value="gap-en-casa">GAP en Casa Mujeres</option>
              <option value="metodo-40-3">Método 40/3</option>
              <option value="post-parto">Programa Post-Parto</option>
              <option value="presencial">Entrenamiento Presencial</option>
            </select>
          </div>
        )}
      </div>

      <div className="header-right">
        {/* Role Switcher Button for instant demo/testing */}
        <button 
          onClick={() => toggleRole()} 
          className={`role-switcher-btn ${role === 'admin' ? 'is-admin' : 'is-alumna'}`}
          title="Cambiar entre vista de Alumna y Administrador"
        >
          {role === 'alumna' ? (
            <>
              <Shield size={16} />
              <span>Ver Modo Admin</span>
            </>
          ) : (
            <>
              <User size={16} />
              <span>Ver Modo Alumna</span>
            </>
          )}
        </button>

        {role === 'alumna' && (
          <div className="streak-badge" title="Tus días consecutivos entrenando">
            <Flame size={18} className="flame-icon" />
            <span className="streak-count">{user.streakDays} Días</span>
          </div>
        )}

        <button className="icon-btn" title="Notificaciones">
          <Bell size={18} />
          <span className="notif-dot"></span>
        </button>

        <div className="user-profile-badge">
          <img src={user.avatar} alt={user.name} className="user-avatar" />
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role-tag">{role === 'admin' ? 'Administrador' : user.systemName}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
