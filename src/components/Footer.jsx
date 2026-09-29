'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer-react">
      {/* Top CTA Banner */}
      <div className="footer-cta-banner">
        <div className="container text-center">
          <span className="badge" style={{ background: 'rgba(255, 79, 184, 0.12)', color: 'var(--nt-pink, #FF4FB8)', border: '1px solid rgba(255, 79, 184, 0.34)' }}>
            TEAM NATY ENTRENADORA
          </span>
          <h2 className="footer-cta-title">Entrena para la vida que tienes.</h2>
          <p className="footer-cta-subtitle">
            Un sistema de entrenamiento continuo pensado para mujeres que buscan constancia, fuerza y bienestar real.
          </p>
          <div className="footer-cta-actions">
            <Link href="/auth/register?trial=true" className="btn btn-primary btn-lg" data-conversion-event="enrollment_start" data-conversion-placement="footer" style={{ background: 'var(--nt-pink, #FF4FB8)', borderColor: 'var(--nt-pink, #FF4FB8)' }}>
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
                src="https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp"
                alt="Logo Naty Entrenadora" 
                className="footer-logo-img"
              />
            </Link>
            <p className="footer-brand-desc">
              Plataforma digital de entrenamiento online continuo para mujeres. Guiado por Natalia Riquelme, Preparadora Física con más de 15 años de experiencia.
            </p>
            <p className="footer-brand-note">Las redes oficiales se agregarán aquí cuando estén verificadas.</p>
          </div>

          {/* Nav Col 1: Platform */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Plataforma</h4>
            <ul className="footer-links-list-react">
              <li><Link href="/#como-funciona">Cómo Funciona</Link></li>
              <li><Link href="/#natalia">Natalia</Link></li>
              <li><Link href="/#plataforma">Plataforma</Link></li>
              <li><Link href="/#comunidad">Comunidad</Link></li>
              <li><Link href="/#oferta">Membresía</Link></li>
              <li><Link href="/#faq">Preguntas Frecuentes</Link></li>
            </ul>
          </div>

          {/* Nav Col 2: Alumna */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Alumna</h4>
            <ul className="footer-links-list-react">
              <li><Link href="/para-ti">Mi Dashboard</Link></li>
              <li><Link href="/checkout">Membresía</Link></li>
              <li><Link href="/auth/login">Iniciar Sesión</Link></li>
              <li><Link href="/auth/register">Prueba 7 Días</Link></li>
            </ul>
          </div>

          {/* Nav Col 3: Contact */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Contacto Oficial</h4>
            <ul className="footer-links-list-react contact-list">
              <li>
                <a href="mailto:team@natyentrenadora.com" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={16} style={{ color: 'var(--nt-pink, #FF4FB8)' }} /> team@natyentrenadora.com
                </a>
              </li>
              <li style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--nt-text-muted, #9CA3AF)' }}>
                <span>🌐 natyentrenadora.com</span>
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
          <p className="copyright-text">&copy; {new Date().getFullYear()} Naty Entrenadora (natyentrenadora.com). Todos los derechos reservados.</p>
          <div className="legal-links" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link href="/terminos" style={{ fontSize: '0.8rem', color: 'var(--nt-text-muted, #9CA3AF)' }}>Términos del Servicio</Link>
            <Link href="/privacidad" style={{ fontSize: '0.8rem', color: 'var(--nt-text-muted, #9CA3AF)' }}>Privacidad</Link>
            <Link href="/cookies" style={{ fontSize: '0.8rem', color: 'var(--nt-text-muted, #9CA3AF)' }}>Cookies</Link>
            <Link href="/cancelacion" style={{ fontSize: '0.8rem', color: 'var(--nt-text-muted, #9CA3AF)' }}>Política de Cancelación</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
