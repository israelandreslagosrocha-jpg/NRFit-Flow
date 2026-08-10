import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sparkles, Compass, Calendar, Film, TrendingUp, Users } from 'lucide-react';
import './BottomNavAlumna.css';

export default function BottomNavAlumna() {
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
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `bottom-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={20} className="bottom-nav-icon" />
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
