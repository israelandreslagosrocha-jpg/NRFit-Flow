import React from 'react';
import type { Metadata } from 'next';
import Home from '../../views/Home';

export const metadata: Metadata = {
  title: 'Naty Entrenadora | Entrena para la vida que tienes',
  description: 'Cinco entrenamientos online por semana para mujeres que quieren recuperar fuerza, energía, movilidad y constancia, adaptando el entrenamiento a la vida que realmente tienen.',
  alternates: {
    canonical: 'https://natyentrenadora.com',
  },
  openGraph: {
    title: 'Naty Entrenadora | Entrena para la vida que tienes',
    description: 'Cinco entrenamientos semanales: 2 clases en vivo por Zoom y 3 grabados para entrenar desde casa.',
    url: 'https://natyentrenadora.com',
    siteName: 'Naty Entrenadora',
    images: [
      {
        url: 'https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp',
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
    description: 'Cinco entrenamientos semanales para mujeres reales: 2 clases en vivo y 3 grabados.',
    images: ['https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp'],
  },
};

export default function PublicHomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://natyentrenadora.com/#organization',
        'name': 'Naty Entrenadora',
        'url': 'https://natyentrenadora.com',
        'logo': 'https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp',
        'email': 'team@natyentrenadora.com',
        'founder': {
          '@type': 'Person',
          'name': 'Natalia Riquelme',
          'jobTitle': 'Preparadora Física Certificada',
        },
      },
      {
        '@type': 'WebSite',
        '@id': 'https://natyentrenadora.com/#website',
        'url': 'https://natyentrenadora.com',
        'name': 'Naty Entrenadora',
        'description': 'Entrena para la vida que tienes. Cinco entrenamientos online por semana para mujeres.',
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
