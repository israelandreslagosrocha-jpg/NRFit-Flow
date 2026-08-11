import React from 'react';
import type { Metadata } from 'next';
import Presencial from '../../../views/Presencial';

export const metadata: Metadata = {
  title: 'Entrenamiento Presencial Teodoro Schmidt | Box Central | Naty Entrenadora',
  description: 'Entrenamiento personalizado y de fuerza grupal en Teodoro Schmidt, La Araucanía. Monitoreo de sobrecarga progresiva, aforo limitado y asesoría técnica por Natalia Riquelme.',
  alternates: {
    canonical: 'https://natyentrenadora.cl/presencial',
  },
  openGraph: {
    title: 'Entrenamiento Presencial en Teodoro Schmidt | Naty Entrenadora',
    description: 'Box Central Teodoro Schmidt. Entrenamiento de fuerza, hipertrofia y acondicionamiento con aforo controlado.',
    url: 'https://natyentrenadora.cl/presencial',
    siteName: 'Naty Entrenadora',
    images: ['https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png'],
    type: 'website',
  },
};

export default function PresencialPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    'name': 'Box Central Naty Entrenadora — Teodoro Schmidt',
    'description': 'Centro de entrenamiento presencial especializado en fuerza femenina y acondicionamiento físico.',
    'url': 'https://natyentrenadora.cl/presencial',
    'telephone': '+56957144823',
    'address': {
      '@type': 'PostalAddress',
      'addressLocality': 'Teodoro Schmidt',
      'addressRegion': 'Región de La Araucanía',
      'addressCountry': 'CL',
    },
    'priceRange': '$$',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Presencial />
    </>
  );
}
