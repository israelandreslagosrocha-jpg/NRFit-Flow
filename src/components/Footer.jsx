'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Mail } from 'lucide-react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer-react" style={{ background: '#070709', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
      {/* Top CTA Banner */}
      <div className="footer-cta-banner">
        <div className="container text-center">
          <span className="badge" style={{ background: 'rgba(255, 45, 120, 0.1)', color: 'var(--nt-pink, #FF2D78)', border: '1px solid rgba(255, 45, 120, 0.3)' }}>
            TEAM NATY ENTRENADORA
          </span>
          <h2 className="footer-cta-title">Entrena para la vida que tienes.</h2>
          <p className="footer-cta-subtitle">
            Un sistema de entrenamiento continuo pensado para mujeres que buscan constancia, fuerza y bienestar real.
          </p>
          <div className="footer-cta-actions">
            <Link href="/#oferta" className="btn btn-primary btn-lg" style={{ background: 'var(--nt-pink, #FF2D78)', borderColor: 'var(--nt-pink, #FF2D78)' }}>
              QUIERO PROBAR 7 DÍAS <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="footer-main">
        <div className="container footer-grid">
          {/* Brand Info */}
          <div className="footer-brand-col">
            <Link href="/" className="footer-logo">
              <img 
                src="https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png" 
                alt="Logo Naty Entrenadora" 
                className="footer-logo-img"
              />
              <span className="footer-brand-title">NATY ENTRENADORA</span>
            </Link>
            <p className="footer-brand-desc">
              Plataforma digital de entrenamiento online continuo para mujeres. Guiado por Natalia Riquelme, Preparadora Física con más de 15 años de experiencia.
            </p>
            <div className="footer-socials">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
              </a>
            </div>
          </div>

          {/* Nav Col 1: Platform */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Plataforma</h4>
            <ul className="footer-links-list-react">
              <li><Link href="/#como-funciona">Cómo Funciona</Link></li>
              <li><Link href="/#natalia">Natalia Riquelme</Link></li>
              <li><Link href="/#comunidad">Comunidad Team Naty</Link></li>
              <li><Link href="/#oferta">Precio Fundador ($25.000)</Link></li>
              <li><Link href="/#faq">Preguntas Frecuentes</Link></li>
            </ul>
          </div>

          {/* Nav Col 2: Alumnas */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Portal Alumna</h4>
            <ul className="footer-links-list-react">
              <li><Link href="/alumna/para-ti">Mi Dashboard</Link></li>
              <li><Link href="/alumna/explorar">Videoteca de Clases</Link></li>
              <li><Link href="/alumna/progreso">Mi Constancia y Racha</Link></li>
              <li><Link href="/alumna/comunidad">Comunidad de Apoyo</Link></li>
            </ul>
          </div>

          {/* Nav Col 3: Contact */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Contacto Oficial</h4>
            <ul className="footer-links-list-react contact-list">
              <li>
                <a href="mailto:team@natyentrenadora.cl" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={16} style={{ color: 'var(--nt-pink, #FF2D78)' }} /> team@natyentrenadora.cl
                </a>
              </li>
              <li style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--nt-text-muted, #9CA3AF)' }}>
                <span>🌐 www.natyentrenadora.cl</span>
              </li>
              <li style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--nt-text-muted, #9CA3AF)' }}>
                <span>🇨🇱 Chile (Entrenamiento 100% Online)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Legal / Copyright */}
      <div className="footer-bottom-react">
        <div className="container footer-bottom-flex">
          <p className="copyright-text">&copy; {new Date().getFullYear()} Naty Entrenadora (www.natyentrenadora.cl). Todos los derechos reservados.</p>
          <div className="legal-links">
            <span style={{ fontSize: '0.85rem', color: 'var(--nt-text-muted, #9CA3AF)' }}>Pagos seguros • Privacidad protegida</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
