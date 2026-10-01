'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, AlertCircle, Info, Loader2 } from 'lucide-react';
import { createCheckoutSubscriptionAction } from '../../actions/subscription';
import type { MembershipOffer } from '../../lib/offers/membership-offer';
import './checkout.css';

type CheckoutClientProps = {
  offer: MembershipOffer;
};

export default function CheckoutClient({ offer }: CheckoutClientProps) {
  const router = useRouter();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      const result = await createCheckoutSubscriptionAction(offer.id);

      if (!result.success) {
        if (result.redirectUrl) {
          router.push(result.redirectUrl);
          return;
        }
        setErrorMessage(result.error || 'Ocurrió un error al iniciar la suscripción.');
        setLoading(false);
        return;
      }

      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        setErrorMessage('No se recibió la URL de redirección de la pasarela.');
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
            gap: '10px',
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
            <span className="summary-label">Fin de tu prueba</span>
            <span className="summary-value">{chargeDate}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Después del trial</span>
            <span className="summary-value">${offer.monthlyPrice.toLocaleString('es-CL')} CLP / mes</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Condición de la oferta</span>
            <span className="summary-value">{offer.isPresale ? 'Tu precio de preventa queda fijado al inscribirte.' : 'Valor oficial para nuevas inscripciones.'}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Renovación</span>
            <span className="summary-value">Al terminar tu prueba, tú eliges: pago automático o recordatorio mensual con enlace.</span>
          </div>
        </div>

        <div className="cancellation-note">
          <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Sin compromiso:</strong> Puedes cancelar antes de tu próximo cobro para evitar futuras renovaciones. Si cancelas durante los 7 días de prueba, mantendrás tu acceso hasta completar la semana y no se realizará ningún cobro. Consulta nuestra <Link href="/cancelacion" className="terms-link">política de cancelación</Link>.
          </span>
        </div>

        <label className="terms-checkbox-container">
          <input
            type="checkbox"
            className="terms-checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          <span>
            He leído y acepto los <Link href="/terminos" className="terms-link">Términos y Condiciones</Link> y la <Link href="/privacidad" className="terms-link">Política de Privacidad</Link>. Entiendo que hoy no se solicitará ni cobrará ningún medio de pago; elegiré cómo continuar al finalizar mi prueba.
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
              <span>Activando tu prueba gratuita...</span>
            </>
          ) : (
            <>
              <span>ACTIVAR MIS 7 DÍAS GRATIS</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>

        <div className="mp-security-badge">
          <ShieldCheck size={16} />
          <span>Hoy no se solicita tarjeta. Al finalizar tu prueba, la modalidad que elijas se procesa de forma segura con Flow.</span>
        </div>
      </div>
    </div>
  );
}
