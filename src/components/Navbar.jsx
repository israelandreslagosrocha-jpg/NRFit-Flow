'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
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

  const navItems = [
    { path: '/#como-funciona', label: 'CÓMO FUNCIONA' },
    { path: '/#natalia', label: 'NATALIA' },
    { path: '/#plataforma', label: 'PLATAFORMA' },
    { path: '/#comunidad', label: 'COMUNIDAD' },
    { path: '/#oferta', label: 'PRECIO FUNDADOR' },
    { path: '/#faq', label: 'PREGUNTAS' },
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
            <span className="brand-subtitle">TEAM NATY ONLINE</span>
          </div>
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
            <Link href="/#oferta" className="btn btn-primary btn-sm" style={{ background: 'var(--nt-pink, #FF2D78)', borderColor: 'var(--nt-pink, #FF2D78)' }}>
              PROBAR 7 DÍAS
            </Link>
          </div>
        </div>

        {/* Mobile Actions */}
        <div className="mobile-actions">
          <button className="burger-menu" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle Menu">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${isOpen ? 'open' : ''}`}>
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
              href="/#oferta"
              className="btn btn-primary btn-full text-center"
              style={{ background: 'var(--nt-pink, #FF2D78)' }}
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
