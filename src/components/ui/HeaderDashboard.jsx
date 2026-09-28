'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { AuthSignOutButton } from '../auth/AuthSignOutButton';
import './HeaderDashboard.css';

export default function HeaderDashboard({ serverUser }) {
  const name = serverUser?.full_name || serverUser?.email?.split('@')[0] || 'Alumna';
  const initial = name.charAt(0).toUpperCase();

  return (
    <header className="dashboard-header glass-card">
      <div className="header-left">
        <div className="brand-badge">
          <span className="brand-dot"></span>
          <span className="brand-text">NATY ENTRENADORA</span>
        </div>

        <div className="system-selector">
          <span className="selector-label">Membresía:</span>
          <span className="system-name">Team Naty Online</span>
        </div>
      </div>

      <div className="header-right">

        <a className="icon-btn" title="Ver avisos" href="#avisos" aria-label="Ver avisos">
          <Bell size={18} />
        </a>

        <div className="user-profile-badge">
          <span className="user-avatar user-avatar-fallback" aria-hidden="true">{initial}</span>
          <div className="user-info">
            <span className="user-name">{name}</span>
            <span className="user-role-tag">Alumna</span>
          </div>
        </div>
        <AuthSignOutButton className="header-sign-out" />
      </div>
    </header>
  );
}
