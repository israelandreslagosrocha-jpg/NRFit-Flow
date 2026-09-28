'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';

export default function GoogleOnboardingPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [fitnessExperience, setFitnessExperience] = useState('principiante');
  const [availableEquipment, setAvailableEquipment] = useState('cuerpo');
  const [trainingGoals, setTrainingGoals] = useState('energia');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const confirmSession = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth/login');
        return;
      }

      setCheckingSession(false);
    };

    void confirmSession();
  }, [router]);

  const handleContinue = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        fitness_experience: fitnessExperience,
        available_equipment: availableEquipment,
        training_goals: trainingGoals,
        is_trial: true,
      },
    });

    if (error) {
      setErrorMsg('No pudimos guardar tus preferencias. Inténtalo nuevamente.');
      setLoading(false);
      return;
    }

    router.push('/checkout');
    router.refresh();
  };

  if (checkingSession) {
    return (
      <div className="auth-card auth-status-card" aria-live="polite">
        <Loader2 size={22} className="animate-spin" />
        <span>Verificando tu acceso seguro…</span>
      </div>
    );
  }

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
        <div className="auth-badge-trial">
          <Sparkles size={14} />
          <span>Prueba Gratuita de 7 Días ($0 hoy)</span>
        </div>
        <h1 className="auth-title">Personaliza tu inicio</h1>
        <p className="auth-subtitle">Cuéntanos lo justo para adaptar tu primera semana. No pedimos datos médicos.</p>
      </div>

      {errorMsg && (
        <div className="auth-error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleContinue} className="auth-form">
        <div className="auth-field-group">
          <label className="auth-label" htmlFor="google-reg-exp">¿Cuál es tu experiencia entrenando?</label>
          <select id="google-reg-exp" value={fitnessExperience} onChange={(event) => setFitnessExperience(event.target.value)} className="auth-select">
            <option value="principiante">Principiante (Llevo tiempo sin entrenar o empiezo de cero)</option>
            <option value="intermedio">Intermedio (Entreno de vez en cuando, busco constancia)</option>
            <option value="avanzado">Avanzado (Entreno regular, quiero el sistema del Team)</option>
          </select>
        </div>

        <div className="auth-field-group">
          <label className="auth-label" htmlFor="google-reg-equip">¿Qué implementos tienes en casa?</label>
          <select id="google-reg-equip" value={availableEquipment} onChange={(event) => setAvailableEquipment(event.target.value)} className="auth-select">
            <option value="cuerpo">Solo mi cuerpo (Sin implementos)</option>
            <option value="bandas">Bandas elásticas / Mat</option>
            <option value="mancuernas">Mancuernas ligeras / Botellas con agua</option>
          </select>
        </div>

        <div className="auth-field-group">
          <label className="auth-label" htmlFor="google-reg-goal">¿Cuál es tu objetivo prioritario?</label>
          <select id="google-reg-goal" value={trainingGoals} onChange={(event) => setTrainingGoals(event.target.value)} className="auth-select">
            <option value="energia">Recuperar energía y sentirme ágil en mi día</option>
            <option value="fuerza">Ganar fuerza, postura y firmeza muscular</option>
            <option value="habito">Crear el hábito sostenible de entrenar sin culpas</option>
          </select>
        </div>

        <button type="submit" disabled={loading} className="auth-submit-btn">
          {loading ? <><Loader2 size={18} className="animate-spin" /><span>Guardando…</span></> : <><span>CONTINUAR A MI INSCRIPCIÓN</span><ArrowRight size={18} /></>}
        </button>
      </form>
    </div>
  );
}
