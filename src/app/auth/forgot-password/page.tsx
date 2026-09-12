'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/client';
import { ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setSuccessMsg('Si el correo existe en nuestro sistema, recibirás un enlace seguro para restablecer tu contraseña.');
      setLoading(false);
    } catch {
      setErrorMsg('Ocurrió un error inesperado al solicitar el restablecimiento.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <Link href="/">
          <img
            src="https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png"
            alt="Naty Entrenadora"
            className="auth-logo-img"
          />
        </Link>
        <h1 className="auth-title">Recuperar Contraseña</h1>
        <p className="auth-subtitle">Ingresa tu correo para recibir instrucciones de acceso.</p>
      </div>

      {errorMsg && (
        <div className="auth-error-banner" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="auth-success-banner" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {!successMsg ? (
        <form onSubmit={handleReset} className="auth-form">
          <div className="auth-field-group">
            <label className="auth-label" htmlFor="forgot-email">Correo Electrónico</label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu-correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </div>

          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Enviando enlace...</span>
              </>
            ) : (
              <>
                <span>ENVIAR ENLACE DE RECUPERACIÓN</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/auth/login" className="auth-submit-btn" style={{ textDecoration: 'none' }}>
            <span>Volver a Iniciar Sesión</span>
            <ArrowRight size={18} />
          </Link>
        </div>
      )}

      <div className="auth-footer-links">
        <Link href="/auth/login" className="auth-link">
          ← Volver a Iniciar Sesión
        </Link>
        <Link href="/" className="auth-link-secondary">
          Volver a la página principal
        </Link>
      </div>
    </div>
  );
}
