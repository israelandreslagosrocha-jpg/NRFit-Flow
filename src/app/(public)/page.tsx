import React from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import Home from '../../views/Home';
import { getCurrentMembershipOffer } from '../../lib/offers/membership-offer';

export const metadata: Metadata = {
  title: 'Entrenamiento online para mujeres | Naty Entrenadora',
  description: 'Entrena desde casa con Natalia: clases online en vivo lunes y miércoles y rutinas de 10 a 40 minutos a tu ritmo. Prueba 7 días gratis, sin tarjeta.',
  alternates: {
    canonical: 'https://natyentrenadora.com',
  },
  openGraph: {
    title: 'Entrenamiento online para mujeres | Naty Entrenadora',
    description: 'Dos clases en vivo por Zoom cada semana y una biblioteca flexible para entrenar desde casa.',
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
    title: 'Entrenamiento online para mujeres | Naty Entrenadora',
    description: 'Dos clases en vivo semanales y entrenamientos flexibles para mujeres reales.',
    images: ['https://res.cloudinary.com/dhgifjpkh/image/upload/v1790527147/compressed_Imagen_de_ChatGPT_27_sept_2026_01_38_38_p.m._eqbozm.webp'],
  },
};

export default async function PublicHomePage() {
  // La campaña cambia en una fecha concreta; esperar una petición real evita
  // que el HTML quede congelado con el precio usado durante el build.
  await connection();
  const offer = getCurrentMembershipOffer();

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
        'description': 'Entrena para la vida que tienes. Dos clases en vivo semanales y biblioteca flexible para mujeres.',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Home offer={offer} />
    </>
  );
}
