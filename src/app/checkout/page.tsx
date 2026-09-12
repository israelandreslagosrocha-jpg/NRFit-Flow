'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, AlertCircle, Info, Loader2 } from 'lucide-react';
import { createCheckoutSubscriptionAction } from '../../actions/subscription';
import './checkout.css';

export default function CheckoutPage() {
  const router = useRouter();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cálculo de fecha de cobro a 7 días
  const chargeDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleStartTrial = async () => {
    if (!acceptedTerms) {
      setErrorMessage('Debes aceptar los Términos y Condiciones para continuar.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await createCheckoutSubscriptionAction();

      if (!result.success) {
        if (result.redirectUrl) {
          router.push(result.redirectUrl);
          return;
        }
        setErrorMessage(result.error || 'Ocurrió un error al iniciar la suscripción.');
        setLoading(false);
        return;
      }

      if (result.initPoint) {
        // Redirigir a la pasarela segura de Mercado Pago
        window.location.href = result.initPoint;
      } else {
        setErrorMessage('No se recibió la URL de pago de Mercado Pago.');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error inesperado al conectar con el servidor.');
      setLoading(false);
    }
  };

  return (
    <div className="checkout-page-container">
      <div className="checkout-card">
        <div className="checkout-header">
          <span className="checkout-badge">Acceso Inmediato</span>
          <h1 className="checkout-title">Comienza tus 7 Días de Prueba</h1>
          <p className="checkout-subtitle">Entrena con Natalia y accede a toda la plataforma online.</p>
        </div>

        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: '#f87171',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="checkout-summary-box">
          <div className="summary-row">
            <span className="summary-label">Membresía</span>
            <span className="summary-value">Team Naty Entrenadora Online</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Hoy pagas</span>
            <span className="summary-value highlight">$0 CLP</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Prueba gratuita</span>
            <span className="summary-value">7 días corridos</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Fecha del primer cobro</span>
            <span className="summary-value">{chargeDate}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Después del trial</span>
            <span className="summary-value">$25.000 CLP / mes</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Renovación</span>
            <span className="summary-value">Mensual automática</span>
          </div>
        </div>

        <div className="cancellation-note">
          <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Sin compromiso:</strong> Puedes cancelar antes de tu próximo cobro para evitar futuras renovaciones. Si cancelas durante los 7 días de prueba, no se realizará ningún cobro.
          </span>
        </div>

        <label className="terms-checkbox-container">
          <input
            type="checkbox"
            className="terms-checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
          />
          <span>
            He leído y acepto los <Link href="/terminos" className="terms-link">Términos y Condiciones</Link> y la <Link href="/privacidad" className="terms-link">Política de Privacidad</Link>, y autorizo el cobro recurrente mensual de $25.000 CLP al finalizar los 7 días de prueba si no cancelo previamente.
          </span>
        </label>

        <button
          className="checkout-btn"
          onClick={handleStartTrial}
          disabled={!acceptedTerms || loading}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Conectando con Mercado Pago...</span>
            </>
          ) : (
            <>
              <span>EMPEZAR MI PRUEBA DE 7 DÍAS GRATIS</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>

        <div className="mp-security-badge">
          <ShieldCheck size={16} />
          <span>Procesado de forma segura por Mercado Pago Chile. Cero datos de tarjeta almacenados en nuestros servidores.</span>
        </div>
      </div>
    </div>
  );
}
