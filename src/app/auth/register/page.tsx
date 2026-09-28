'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';
import { ArrowRight, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { GoogleMark } from '../../../components/auth/GoogleMark';

function RegisterForm() {
  const searchParams = useSearchParams();
  const isTrial = searchParams.get('trial') === 'true' || true; // Default to trial for online membership

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fitnessExperience, setFitnessExperience] = useState('principiante');
  const [availableEquipment, setAvailableEquipment] = useState('cuerpo');
  const [trainingGoals, setTrainingGoals] = useState('energia');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            fitness_experience: fitnessExperience,
            available_equipment: availableEquipment,
            training_goals: trainingGoals,
            is_trial: isTrial,
          },
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          setErrorMsg('Este correo ya se encuentra registrado. Intenta iniciar sesión.');
        } else {
          setErrorMsg(error.message);
        }
        setLoading(false);
        return;
      }

      // Si Supabase no requiere confirmación de email y devuelve sesión directa
      if (data?.session) {
        window.location.assign('/auth/post-login');
        return;
      } else {
        setSuccessMsg('¡Cuenta creada con éxito! Revisa tu bandeja de entrada para confirmar tu correo e iniciar tu prueba.');
        setLoading(false);
      }
    } catch {
      setErrorMsg('Ocurrió un error inesperado al procesar tu registro.');
      setLoading(false);
    }
  };

  const handleGoogleRegistration = async () => {
    setErrorMsg(null);
    setLoading(true);

    const supabase = createClient();
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    callbackUrl.searchParams.set('next', '/auth/onboarding');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    });

    if (error) {
      setErrorMsg('No pudimos crear tu acceso con Google. Inténtalo nuevamente o usa tu correo.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-card" style={{ maxWidth: '520px' }}>
      <div className="auth-brand">
        <Link href="/">
          <img
            src="https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp"
            alt="Naty Entrenadora"
            className="auth-logo-img"
          />
        </Link>

        {isTrial && (
          <div className="auth-badge-trial">
            <Sparkles size={14} />
            <span>Prueba Gratuita de 7 Días ($0 hoy)</span>
          </div>
        )}

        <h1 className="auth-title">Únete al Team Naty</h1>
        <p className="auth-subtitle">Crea tu cuenta y comienza a entrenar para la vida que tienes.</p>
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
        <>
          <button type="button" onClick={handleGoogleRegistration} disabled={loading} className="auth-google-btn">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <GoogleMark />}
            <span>Continuar con Google</span>
          </button>

          <div className="auth-divider" aria-hidden="true"><span>o crea tu cuenta con tu correo</span></div>

          <form onSubmit={handleRegister} className="auth-form">
            <div className="auth-field-group">
              <label className="auth-label" htmlFor="reg-name">Nombre y Apellido</label>
              <input
                id="reg-name"
                type="text"
                required
                autoComplete="name"
                placeholder="Ej: Carolina Martínez"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="auth-input"
              />
            </div>

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="reg-email">Correo Electrónico</label>
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              placeholder="carolina@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </div>

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="reg-password">Contraseña (Mínimo 6 caracteres)</label>
            <input
              id="reg-password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />
          </div>

          {/* Onboarding de preferencias de entrenamiento (Cero datos médicos) */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#C52E88', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Personalización de tu inicio
            </span>
          </div>

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="reg-exp">¿Cuál es tu experiencia entrenando?</label>
            <select
              id="reg-exp"
              value={fitnessExperience}
              onChange={(e) => setFitnessExperience(e.target.value)}
              className="auth-select"
            >
              <option value="principiante">Principiante (Llevo tiempo sin entrenar o empiezo de cero)</option>
              <option value="intermedio">Intermedio (Entreno de vez en cuando, busco constancia)</option>
              <option value="avanzado">Avanzado (Entreno regular, quiero el sistema del Team)</option>
            </select>
          </div>

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="reg-equip">¿Qué implementos tienes en casa?</label>
            <select
              id="reg-equip"
              value={availableEquipment}
              onChange={(e) => setAvailableEquipment(e.target.value)}
              className="auth-select"
            >
              <option value="cuerpo">Solo mi cuerpo (Sin implementos)</option>
              <option value="bandas">Bandas elásticas / Mat</option>
              <option value="mancuernas">Mancuernas ligeras / Botellas con agua</option>
            </select>
          </div>

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="reg-goal">¿Cuál es tu objetivo prioritario?</label>
            <select
              id="reg-goal"
              value={trainingGoals}
              onChange={(e) => setTrainingGoals(e.target.value)}
              className="auth-select"
            >
              <option value="energia">Recuperar energía y sentirme ágil en mi día</option>
              <option value="fuerza">Ganar fuerza, postura y firmeza muscular</option>
              <option value="habito">Crear el hábito sostenible de entrenar sin culpas</option>
            </select>
          </div>

            <button type="submit" disabled={loading} className="auth-submit-btn">
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Creando cuenta...</span>
                </>
              ) : (
                <>
                  <span>EMPEZAR MI PRUEBA DE 7 DÍAS</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/auth/login" className="auth-submit-btn" style={{ textDecoration: 'none' }}>
            <span>Ir a Iniciar Sesión</span>
            <ArrowRight size={18} />
          </Link>
        </div>
      )}

      <div className="auth-footer-links">
        <span style={{ fontSize: '0.85rem', color: '#8a8a9a' }}>
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" className="auth-link">
            Inicia sesión aquí
          </Link>
        </span>
        <Link href="/" className="auth-link-secondary">
          ← Volver a la página principal
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ color: '#fff', textAlign: 'center' }}>Cargando registro...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
