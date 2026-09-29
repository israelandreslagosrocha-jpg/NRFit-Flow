'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

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

  const navItems = [
    { path: '/#como-funciona', label: 'CÓMO FUNCIONA' },
    { path: '/#natalia', label: 'NATALIA' },
    { path: '/#plataforma', label: 'PLATAFORMA' },
    { path: '/#comunidad', label: 'COMUNIDAD' },
    { path: '/#oferta', label: 'MEMBRESÍA' },
    { path: '/#faq', label: 'PREGUNTAS' },
  ];

  return (
    <nav className={`navbar-react ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container nav-flex">
        {/* Brand Logo */}
        <Link href="/" className="brand-logo" onClick={() => setIsOpen(false)}>
          <img 
            src="https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp"
            alt="Naty Entrenadora Logo" 
            className="logo-img"
          />
        </Link>

        {/* Desktop Links */}
        <div className="desktop-nav">
          <ul className="nav-links-list">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link href={item.path} className="nav-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="nav-actions">
            <Link href="/para-ti" className="btn btn-secondary btn-sm">
              MI DASHBOARD
            </Link>
            <Link href="/auth/register?trial=true" className="btn btn-primary btn-sm" data-conversion-event="enrollment_start" data-conversion-placement="navbar" style={{ background: 'var(--nt-pink, #FF4FB8)', borderColor: 'var(--nt-pink, #FF4FB8)' }}>
              PROBAR 7 DÍAS
            </Link>
          </div>
        </div>

        {/* Mobile Actions */}
        <div className="mobile-actions">
          <button className="burger-menu" onClick={() => setIsOpen(!isOpen)} aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={isOpen} aria-controls="mobile-navigation">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div id="mobile-navigation" className={`mobile-drawer ${isOpen ? 'open' : ''}`}>
        <ul className="mobile-links-list">
          {navItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.path}
                className="mobile-link"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link
              href="/auth/register?trial=true"
              className="btn btn-primary btn-full text-center"
              data-conversion-event="enrollment_start"
              data-conversion-placement="mobile_navigation"
              style={{ background: 'var(--nt-pink, #FF4FB8)' }}
              onClick={() => setIsOpen(false)}
            >
              PROBAR 7 DÍAS GRATIS
            </Link>
            <Link
              href="/para-ti"
              className="btn btn-secondary btn-full text-center"
              onClick={() => setIsOpen(false)}
            >
              MI DASHBOARD DE ALUMNA
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
