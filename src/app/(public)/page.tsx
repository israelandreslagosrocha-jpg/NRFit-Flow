import React from 'react';
import type { Metadata } from 'next';
import Home from '../../views/Home';

export const metadata: Metadata = {
  title: 'Naty Entrenadora | Plataforma Digital Multiprograma de Entrenamiento',
  description: 'Sistemas de entrenamiento para mujeres reales. Método 40/3 online, Entrenamiento Presencial en Teodoro Schmidt, Post Parto Seguro y Pilates.',
  alternates: {
    canonical: 'https://natyentrenadora.cl',
  },
  openGraph: {
    title: 'Naty Entrenadora | Plataforma Digital Multiprograma',
    description: 'Entrenamiento online y presencial que se adapta a tu vida, tu nivel y tus objetivos. Ecosistema NR Fit & Flow.',
    url: 'https://natyentrenadora.cl',
    siteName: 'Naty Entrenadora',
    images: [
      {
        url: 'https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png',
        width: 1200,
        height: 630,
        alt: 'Naty Entrenadora Logo',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Naty Entrenadora | Plataforma Digital Multiprograma',
    description: 'Sistemas de entrenamiento online y presencial para mujeres.',
    images: ['https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png'],
  },
};

export default function PublicHomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://natyentrenadora.cl/#organization',
        'name': 'Naty Entrenadora',
        'url': 'https://natyentrenadora.cl',
        'logo': 'https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png',
        'founder': {
          '@type': 'Person',
          'name': 'Natalia Riquelme',
          'jobTitle': 'Preparadora Física Certificada',
        },
      },
      {
        '@type': 'SportsActivityLocation',
        '@id': 'https://natyentrenadora.cl/#localbusiness',
        'name': 'Box Central Naty Entrenadora',
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': 'Teodoro Schmidt',
          'addressRegion': 'Región de La Araucanía',
          'addressCountry': 'CL',
        },
        'telephone': '+56957144823',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Home />
    </>
  );
}
