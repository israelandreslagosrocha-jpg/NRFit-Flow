import React from 'react';
import type { Metadata } from 'next';
import Metodo403 from '../../../views/Metodo403';

export const metadata: Metadata = {
  title: 'Método 40/3 | Entrenamiento Online 40 Min, 3 Veces por Semana | Naty Entrenadora',
  description: 'El sistema de entrenamiento online realista para mujeres ocupadas. Tonifica tu cuerpo en 40 minutos, 3 veces por semana desde casa con clases en vivo y VOD.',
  alternates: {
    canonical: 'https://natyentrenadora.cl/metodo-40-3',
  },
  openGraph: {
    title: 'Método 40/3 | Tonifica tu cuerpo desde casa | Naty Entrenadora',
    description: '40 minutos, 3 veces por semana. Clases en vivo por Zoom, videoteca grabada VOD y seguimiento por WhatsApp.',
    url: 'https://natyentrenadora.cl/metodo-40-3',
    siteName: 'Naty Entrenadora',
    images: ['https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png'],
    type: 'website',
  },
};

export default function Metodo403Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    'name': 'Método 40/3 — Entrenamiento Online',
    'provider': {
      '@type': 'Organization',
      'name': 'Naty Entrenadora',
      'url': 'https://natyentrenadora.cl',
    },
    'serviceType': 'Fitness Training',
    'description': 'Entrenamiento guiado online en vivo y videoteca grabada para mujeres.',
    'offers': {
      '@type': 'Offer',
      'price': '22000',
      'priceCurrency': 'CLP',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Metodo403 />
    </>
  );
}
