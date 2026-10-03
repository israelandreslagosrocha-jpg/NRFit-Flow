'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Sparkles, CreditCard, TrendingUp, Video, MessageCircle } from 'lucide-react';
import './SidebarAlumna.css';

export default function SidebarAlumna() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSection = searchParams.get('seccion') || 'inicio';

  const navItems = [
    { path: '/para-ti', section: 'inicio', label: 'Para ti', icon: Sparkles },
    { path: '/para-ti?seccion=progreso', section: 'progreso', label: 'Mi Progreso', icon: TrendingUp },
    { path: '/para-ti?seccion=clases', section: 'clases', label: 'Clases & Videos', icon: Video },
    { path: '/para-ti?seccion=membresia', section: 'membresia', label: 'Membresía', icon: CreditCard },
  ];

  return (
    <aside className="sidebar-alumna glass-card">
      <div className="sidebar-nav-list">
        <span className="sidebar-section-title">MENÚ PRINCIPAL</span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === '/para-ti' && activeSection === item.section;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} className="sidebar-icon" />
              <span className="sidebar-label">{item.label}</span>
            </Link>
          );
        })}

        <div className="sidebar-divider"></div>
        <span className="sidebar-section-title">COMUNIDAD</span>
        <a
          href="mailto:team@natyentrenadora.com?subject=Acceso%20a%20la%20comunidad%20Team%20Naty"
          className="sidebar-item community-link"
        >
          <MessageCircle size={18} className="sidebar-icon green-icon" />
          <span className="sidebar-label">Solicitar acceso a comunidad</span>
        </a>
      </div>

      <div className="sidebar-footer-card">
        <div className="naty-avatar-wrapper">
          <img
            src="https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp"
            alt="Logo oficial Naty Entrenadora"
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
