'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/client';
import { ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { GoogleMark } from '../../../components/auth/GoogleMark';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'google') {
      setErrorMsg('No fue posible completar el acceso con Google. Inténtalo nuevamente o usa tu correo.');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          setErrorMsg('Correo o contraseña incorrectos. Revisa tus datos e intenta nuevamente.');
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          setErrorMsg('Tu correo electrónico aún no ha sido confirmado. Revisa tu bandeja de entrada.');
        } else {
          setErrorMsg(error.message);
        }
        setLoading(false);
        return;
      }

      if (data?.session) {
        // La decisión de destino se toma en el servidor tras la creación de
        // la sesión. Así el rol OWNER/ADMIN no depende de una consulta desde
        // el navegador y nunca se confunde con una alumna sin membresía.
        window.location.assign('/auth/post-login');
        return;
      }

      setErrorMsg('No fue posible establecer tu sesión. Inténtalo nuevamente.');
      setLoading(false);
    } catch {
      setErrorMsg('Ocurrió un error inesperado al intentar iniciar sesión.');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);

    const supabase = createClient();
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    });

    if (error) {
      setErrorMsg('No pudimos iniciar el acceso con Google. Inténtalo nuevamente o usa tu correo.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <Link href="/">
          <img
            src="https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp"
            alt="Naty Entrenadora"
            className="auth-logo-img"
          />
        </Link>
        <h1 className="auth-title">Bienvenida de Vuelta</h1>
        <p className="auth-subtitle">Ingresa a tu portal personal para continuar entrenando.</p>
      </div>

      {errorMsg && (
        <div className="auth-error-banner" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      <button type="button" onClick={handleGoogleLogin} disabled={loading} className="auth-google-btn">
        {loading ? <Loader2 size={18} className="animate-spin" /> : <GoogleMark />}
        <span>Continuar con Google</span>
      </button>

      <div className="auth-divider" aria-hidden="true"><span>o continúa con tu correo</span></div>

      <form onSubmit={handleLogin} className="auth-form">
        <div className="auth-field-group">
          <label className="auth-label" htmlFor="login-email">Correo Electrónico</label>
          <div style={{ position: 'relative' }}>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu-correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </div>
        </div>

        <div className="auth-field-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="auth-label" htmlFor="login-password">Contraseña</label>
            <Link href="/auth/forgot-password" className="auth-link" style={{ fontSize: '0.8rem' }}>
              ¿Olvidaste tu clave?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
          />
        </div>

        <button type="submit" disabled={loading} className="auth-submit-btn">
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Iniciando sesión...</span>
            </>
          ) : (
            <>
              <span>INGRESAR A MI PORTAL</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className="auth-footer-links">
        <span style={{ fontSize: '0.85rem', color: '#8a8a9a' }}>
          ¿Aún no eres parte del Team?{' '}
          <Link href="/auth/register?trial=true" className="auth-link">
            Prueba 7 días gratis
          </Link>
        </span>
        <Link href="/" className="auth-link-secondary">
          ← Volver a la página principal
        </Link>
      </div>
    </div>
  );
}
