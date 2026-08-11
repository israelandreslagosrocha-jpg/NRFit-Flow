'use client';

import React from 'react';
import Link from 'next/link';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer-react">
      {/* Top CTA Banner */}
      <div className="footer-cta-banner">
        <div className="container text-center animate-fade-in">
          <span className="badge">COMIENZA HOY</span>
          <h2 className="footer-cta-title">¿Lista para construir tu mejor versión?</h2>
          <p className="footer-cta-subtitle">Sistemas realistas diseñados para mujeres que buscan resultados duraderos.</p>
          <div className="footer-cta-actions">
            <Link href="/#sistemas" className="btn btn-primary btn-lg">EMPEZAR AHORA</Link>
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
              No vendemos solo rutinas. Ofrecemos sistemas completos de entrenamiento con acompañamiento profesional, tecnología y comunidad para asegurar tu constancia.
            </p>
            <div className="footer-socials">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
                <i className="fa-brands fa-instagram"></i>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">
                <i className="fa-brands fa-youtube"></i>
              </a>
            </div>
          </div>

          {/* Nav Col 1: Systems */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Sistemas Activos</h4>
            <ul className="footer-links-list-react">
              <li><Link href="/metodo-40-3">Método 40/3 (Online)</Link></li>
              <li><Link href="/presencial">Entrenamiento Presencial</Link></li>
              <li><Link href="/post-parto">Recuperación Post Parto</Link></li>
            </ul>
          </div>

          {/* Nav Col 2: Pipeline */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Próximos Módulos</h4>
            <ul className="footer-links-list-react disabled-links">
              <li><span>Desafíos Fit (Próximamente)</span></li>
              <li><span>Nutrición Avanzada</span></li>
              <li><span>Running & Resistencia</span></li>
              <li><span>Mentorías 1-a-1</span></li>
            </ul>
          </div>

          {/* Nav Col 3: Contact */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">Contacto</h4>
            <ul className="footer-links-list-react contact-list">
              <li>
                <a href="https://wa.me/56957144823" target="_blank" rel="noreferrer">
                  <i className="fa-solid fa-phone" style={{ fontSize: '0.9rem' }}></i> +56 9 5714 4823
                </a>
              </li>
              <li>
                <a href="mailto:hola@natyentrenadora.cl">
                  <i className="fa-regular fa-envelope" style={{ fontSize: '0.9rem' }}></i> hola@natyentrenadora.cl
                </a>
              </li>
              <li className="location">
                <span className="d-block">📍 Box Central Teodoro Schmidt</span>
                <span className="d-block text-muted" style={{ fontSize: '0.85rem' }}>Región de La Araucanía, Chile</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Legal / Copyright */}
      <div className="footer-bottom-react">
        <div className="container footer-bottom-flex">
          <p className="copyright-text">&copy; {new Date().getFullYear()} Naty Entrenadora. Todos los derechos reservados. Plataforma NR Fit & Flow.</p>
          <div className="legal-links">
            <a href="#terminos">Términos de Servicio</a>
            <span className="divider">•</span>
            <a href="#privacidad">Política de Privacidad</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
