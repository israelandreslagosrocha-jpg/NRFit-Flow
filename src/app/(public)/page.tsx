import React from 'react';
import type { Metadata } from 'next';
import Home from '../../views/Home';

export const metadata: Metadata = {
  title: 'Naty Entrenadora | Entrena para la vida que tienes',
  description: 'Entrenamiento online continuo para mujeres que quieren recuperar fuerza, energía, movilidad y constancia, adaptando el entrenamiento a la vida que realmente tienen.',
  alternates: {
    canonical: 'https://www.natyentrenadora.cl',
  },
  openGraph: {
    title: 'Naty Entrenadora | Entrena para la vida que tienes',
    description: 'Entrenamiento online continuo para mujeres que quieren recuperar fuerza, energía, movilidad y constancia. Membresía mensual con clases en vivo y grabadas.',
    url: 'https://www.natyentrenadora.cl',
    siteName: 'Naty Entrenadora',
    images: [
      {
        url: 'https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png',
        width: 1200,
        height: 630,
        alt: 'Naty Entrenadora - Entrena para la vida que tienes',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Naty Entrenadora | Entrena para la vida que tienes',
    description: 'Entrenamiento online continuo para mujeres reales. Membresía mensual con acompañamiento profesional.',
    images: ['https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png'],
  },
};

export default function PublicHomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://www.natyentrenadora.cl/#organization',
        'name': 'Naty Entrenadora',
        'url': 'https://www.natyentrenadora.cl',
        'logo': 'https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png',
        'email': 'team@natyentrenadora.cl',
        'founder': {
          '@type': 'Person',
          'name': 'Natalia Riquelme',
          'jobTitle': 'Preparadora Física Certificada',
        },
      },
      {
        '@type': 'WebSite',
        '@id': 'https://www.natyentrenadora.cl/#website',
        'url': 'https://www.natyentrenadora.cl',
        'name': 'Naty Entrenadora',
        'description': 'Entrena para la vida que tienes. Plataforma de entrenamiento online continuo para mujeres.',
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
