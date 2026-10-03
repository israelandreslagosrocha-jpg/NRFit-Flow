'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Sparkles, CreditCard, TrendingUp, Video } from 'lucide-react';
import './BottomNavAlumna.css';

export default function BottomNavAlumna() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSection = searchParams.get('seccion') || 'inicio';

  const navItems = [
    { path: '/para-ti', section: 'inicio', label: 'Para ti', icon: Sparkles },
    { path: '/para-ti?seccion=progreso', section: 'progreso', label: 'Progreso', icon: TrendingUp },
    { path: '/para-ti?seccion=clases', section: 'clases', label: 'Clases', icon: Video },
    { path: '/para-ti?seccion=membresia', section: 'membresia', label: 'Membresía', icon: CreditCard },
  ];

  return (
    <nav className="bottom-nav-alumna">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === '/para-ti' && currentSection === item.section;

        return (
          <Link
            key={item.path}
            href={item.path}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} className="bottom-nav-icon" />
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
