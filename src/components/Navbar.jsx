'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Sun, Moon } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isLightTheme;
    setIsLightTheme(newTheme);
    if (newTheme) {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
  };

  const navItems = [
    { path: '/', label: 'INICIO' },
    { path: '/metodo-40-3', label: 'MÉTODO 40/3' },
    { path: '/presencial', label: 'PRESENCIAL' },
    { path: '/post-parto', label: 'POST PARTO' },
  ];

  return (
    <nav className={`navbar-react ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container nav-flex">
        {/* Brand Logo */}
        <Link href="/" className="brand-logo" onClick={() => setIsOpen(false)}>
          <img 
            src="https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png" 
            alt="Naty Entrenadora Logo" 
            className="logo-img"
          />
          <div className="brand-text">
            <span className="brand-title">NATY ENTRENADORA</span>
            <span className="brand-subtitle">NR FIT & FLOW</span>
          </div>
        </Link>

        {/* Desktop Links */}
        <div className="desktop-nav">
          <ul className="nav-links-list">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <li key={item.path}>
                  <Link href={item.path} className={`nav-link ${isActive ? 'active' : ''}`}>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="nav-actions">
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Theme">
              {isLightTheme ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <Link href="/alumna/para-ti" className="btn btn-secondary btn-sm">MI DASHBOARD</Link>
            <Link href="/#sistemas" className="btn btn-primary btn-sm">REGISTRARSE</Link>
          </div>
        </div>

        {/* Mobile Actions */}
        <div className="mobile-actions">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Theme">
            {isLightTheme ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button className="burger-menu" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle Menu">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${isOpen ? 'open' : ''}`}>
        <ul className="mobile-links-list">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`mobile-link ${isActive ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li style={{ marginTop: '20px' }}>
            <Link
              href="/#sistemas"
              className="btn btn-primary btn-full text-center"
              onClick={() => setIsOpen(false)}
            >
              REGISTRARSE
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
