'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, CreditCard } from 'lucide-react';
import './BottomNavAlumna.css';

export default function BottomNavAlumna() {
  const pathname = usePathname();

  const navItems = [
    { path: '/para-ti', label: 'Para ti', icon: Sparkles },
    { path: '/checkout', label: 'Membresía', icon: CreditCard },
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
