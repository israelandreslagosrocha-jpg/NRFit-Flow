'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle, CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkIsValid, setLinkIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let unresolvedLinkTimer: number | undefined;
    const applySession = (session: unknown) => {
      if (unresolvedLinkTimer) window.clearTimeout(unresolvedLinkTimer);
      const valid = Boolean(session);
      setLinkIsValid(valid);
      if (!valid) {
        setErrorMessage('Este enlace de recuperación no es válido o ya venció. Solicita uno nuevo para continuar.');
      }
      setCheckingLink(false);
    };

    // Supabase emite PASSWORD_RECOVERY al consumir el enlace y la sesión puede
    // llegar desde el fragmento de URL. Escuchamos el evento además de leer la
    // sesión persistida para cubrir ambos flujos de recuperación.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        applySession(session);
      }
    });

    unresolvedLinkTimer = window.setTimeout(() => applySession(null), 1500);

    void supabase.auth.getSession().then(({ data, error }) => {
      if (data.session || error) applySession(data.session);
    });

    return () => {
      if (unresolvedLinkTimer) window.clearTimeout(unresolvedLinkTimer);
      subscription.unsubscribe();
    };
  }, []);

  const handlePasswordUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (password.length < 12) {
      setErrorMessage('Usa una contraseña de al menos 12 caracteres.');
      return;
    }
    if (password !== passwordConfirmation) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage('No pudimos actualizar tu contraseña. Solicita un nuevo enlace e inténtalo otra vez.');
      setLoading(false);
      return;
    }

    setSuccessMessage('Tu contraseña fue actualizada. Ya puedes iniciar sesión con tu nueva clave.');
    setLoading(false);
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
        <h1 className="auth-title">Crea una nueva contraseña</h1>
        <p className="auth-subtitle">Elige una clave segura para volver a tu portal.</p>
      </div>

      {errorMessage && (
        <div className="auth-error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="auth-success-banner" role="status" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{successMessage}</span>
        </div>
      )}

      {checkingLink ? (
        <div className="auth-status-card">
          <Loader2 size={18} className="animate-spin" />
          <span>Verificando tu enlace seguro…</span>
        </div>
      ) : linkIsValid && !successMessage ? (
        <form onSubmit={handlePasswordUpdate} className="auth-form">
          <div className="auth-field-group">
            <label className="auth-label" htmlFor="new-password">Nueva contraseña</label>
            <input
              id="new-password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="auth-input"
              placeholder="Mínimo 12 caracteres"
            />
          </div>
          <div className="auth-field-group">
            <label className="auth-label" htmlFor="new-password-confirmation">Repite la nueva contraseña</label>
            <input
              id="new-password-confirmation"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              className="auth-input"
            />
          </div>
          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LockKeyhole size={18} />}
            <span>{loading ? 'ACTUALIZANDO CONTRASEÑA…' : 'GUARDAR NUEVA CONTRASEÑA'}</span>
          </button>
        </form>
      ) : successMessage ? (
        <Link href="/auth/login" className="auth-submit-btn" style={{ textDecoration: 'none' }}>
          <span>IR A INICIAR SESIÓN</span>
          <ArrowRight size={18} />
        </Link>
      ) : (
        <Link href="/auth/forgot-password" className="auth-submit-btn" style={{ textDecoration: 'none' }}>
          <span>SOLICITAR NUEVO ENLACE</span>
          <ArrowRight size={18} />
        </Link>
      )}

      <div className="auth-footer-links">
        <Link href="/auth/login" className="auth-link">← Volver a iniciar sesión</Link>
        <Link href="/" className="auth-link-secondary">Volver a la página principal</Link>
      </div>
    </div>
  );
}
