'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, CreditCard, DollarSign, Video, BarChart3 } from 'lucide-react';
import './SidebarAdmin.css';

export default function SidebarAdmin() {
  const pathname = usePathname();

  const adminItems = [
    { path: '/admin/dashboard', label: 'Dashboard Home', icon: LayoutDashboard },
    { path: '/admin/alumnas', label: 'Gestión Alumnas', icon: Users },
    { path: '/admin/planes', label: 'Planes & Membresías', icon: CreditCard },
    { path: '/admin/pagos', label: 'Pagos & Cobros', icon: DollarSign },
    { path: '/admin/contenido', label: 'Contenido & Clases', icon: Video },
    { path: '/admin/reportes', label: 'Reportes & Ventas', icon: BarChart3 },
  ];

  return (
    <aside className="sidebar-admin glass-card">
      <div className="admin-sidebar-header">
        <span className="admin-badge-label">PANEL DE CONTROL</span>
        <span className="admin-brand">Naty Admin HQ</span>
      </div>

      <div className="sidebar-nav-list">
        {adminItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`sidebar-item admin-item ${isActive ? 'active-admin' : ''}`}
            >
              <Icon size={20} className="sidebar-icon" />
              <span className="sidebar-label">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-footer-card admin-footer">
        <div className="admin-status-indicator">
          <span className="status-dot green"></span>
          <span className="status-text">Servidores & Supabase Online</span>
        </div>
      </div>
    </aside>
  );
}
