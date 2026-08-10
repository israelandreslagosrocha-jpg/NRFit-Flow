import React, { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);

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

  return (
    <nav className={`navbar-react ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container nav-flex">
        {/* Brand Logo */}
        <Link to="/" className="brand-logo" onClick={() => setIsOpen(false)}>
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
            <li>
              <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                INICIO
              </NavLink>
            </li>
            <li>
              <NavLink to="/metodo-40-3" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                MÉTODO 40/3
              </NavLink>
            </li>
            <li>
              <NavLink to="/presencial" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                PRESENCIAL
              </NavLink>
            </li>
            <li>
              <NavLink to="/post-parto" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                POST PARTO
              </NavLink>
            </li>
          </ul>

          <div className="nav-actions">
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Theme">
              {isLightTheme ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <Link to="/alumna/para-ti" className="btn btn-secondary btn-sm">MI DASHBOARD</Link>
            <a href="#sistemas" className="btn btn-primary btn-sm">REGISTRARSE</a>
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
          <li>
            <NavLink to="/" end className="mobile-link" onClick={() => setIsOpen(false)}>
              INICIO
            </NavLink>
          </li>
          <li>
            <NavLink to="/metodo-40-3" className="mobile-link" onClick={() => setIsOpen(false)}>
              MÉTODO 40/3 (ONLINE)
            </NavLink>
          </li>
          <li>
            <NavLink to="/presencial" className="mobile-link" onClick={() => setIsOpen(false)}>
              ENTRENAMIENTO PRESENCIAL
            </NavLink>
          </li>
          <li>
            <NavLink to="/post-parto" className="mobile-link" onClick={() => setIsOpen(false)}>
              POST PARTO SEGURO
            </NavLink>
          </li>
          <li style={{ marginTop: '20px' }}>
            <a href="#sistemas" className="btn btn-primary btn-full text-center" onClick={() => setIsOpen(false)}>
              REGISTRARSE
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
