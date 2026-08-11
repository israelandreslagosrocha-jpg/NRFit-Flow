'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Compass, Calendar, Film, TrendingUp, Users } from 'lucide-react';
import './BottomNavAlumna.css';

export default function BottomNavAlumna() {
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
    <nav className="bottom-nav-alumna">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;

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
