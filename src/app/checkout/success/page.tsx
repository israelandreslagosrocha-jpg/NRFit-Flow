'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, Dumbbell } from 'lucide-react';
import '../checkout.css';

export default function CheckoutSuccessPage() {
  return (
    <div className="checkout-page-container">
      <div className="checkout-card" style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(52, 211, 153, 0.15)',
          color: '#34d399',
          marginBottom: '20px'
        }}>
          <CheckCircle2 size={36} />
        </div>

        <h1 className="checkout-title">¡Bienvenida al Team Naty!</h1>
        <p className="checkout-subtitle" style={{ fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          Tu medio de pago ha sido verificado por Mercado Pago y tu período de prueba de <strong>7 días gratuitos ($0 CLP)</strong> ha comenzado.
        </p>

        <div className="checkout-summary-box" style={{ textAlign: 'left', marginBottom: '28px' }}>
          <div className="summary-row">
            <span className="summary-label">Estado de la membresía</span>
            <span className="summary-value highlight">Prueba Activa (7 Días)</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Cobrado hoy</span>
            <span className="summary-value">$0 CLP</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Próximo cobro</span>
            <span className="summary-value">$25.000 CLP (al término del trial)</span>
          </div>
        </div>

        <Link
          href="/para-ti"
          className="checkout-btn"
          style={{ textDecoration: 'none' }}
        >
          <Dumbbell size={18} />
          <span>IR A MI PORTAL DE ALUMNA</span>
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
