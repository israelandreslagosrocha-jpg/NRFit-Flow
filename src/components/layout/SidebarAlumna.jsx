'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Compass, Calendar, Film, TrendingUp, Users } from 'lucide-react';
import './SidebarAlumna.css';

export default function SidebarAlumna() {
  const pathname = usePathname();

  const navItems = [
    { path: '/alumna/para-ti', label: 'Para ti', icon: Sparkles },
    { path: '/alumna/explorar', label: 'Explorar', icon: Compass },
    { path: '/alumna/mi-plan', label: 'Mi plan', icon: Calendar },
    { path: '/alumna/biblioteca', label: 'Biblioteca', icon: Film },
    { path: '/alumna/progreso', label: 'Progreso', icon: TrendingUp },
    { path: '/alumna/comunidad', label: 'Comunidad', icon: Users },
  ];

  return (
    <aside className="sidebar-alumna glass-card">
      <div className="sidebar-nav-list">
        <span className="sidebar-section-title">MENÚ PRINCIPAL</span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} className="sidebar-icon" />
              <span className="sidebar-label">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-footer-card">
        <div className="naty-avatar-wrapper">
          <img 
            src="https://images.unsplash.com/photo-1594381898411-846e7d193883?w=120&auto=format&fit=crop&q=80" 
            alt="Naty Entrenadora" 
            className="naty-avatar"
          />
          <span className="live-status-dot" title="Naty en línea"></span>
        </div>
        <div className="naty-footer-info">
          <span className="naty-name">Naty Entrenadora</span>
          <span className="naty-status">¿Lista para entrenar hoy? 💪</span>
        </div>
      </div>
    </aside>
  );
}
