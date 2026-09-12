'use client';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Flame, Bell } from 'lucide-react';
import './HeaderDashboard.css';

export default function HeaderDashboard({ serverUser }) {
  const { role: contextRole, activeSystem, changeSystem, user: contextUser } = useAuth();
  
  const user = serverUser ? {
    ...contextUser,
    id: serverUser.id,
    name: serverUser.full_name || serverUser.email?.split('@')[0] || contextUser.name,
    email: serverUser.email || contextUser.email,
  } : contextUser;

  const role = serverUser?.role || contextRole;

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
              <option value="team-naty">Team Naty Online</option>
            </select>
          </div>
        )}
      </div>

      <div className="header-right">

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
