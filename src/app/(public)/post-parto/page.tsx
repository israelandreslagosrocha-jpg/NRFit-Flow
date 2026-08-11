import React from 'react';
import type { Metadata } from 'next';
import PostParto from '../../../views/PostParto';

export const metadata: Metadata = {
  title: 'Post Parto Seguro | Recuperación de Suelo Pélvico y Abdomen | Naty Entrenadora',
  description: 'Programa especializado de ejercicio post parto online. Recupera tu suelo pélvico, abdomen y postura de forma segura y progresiva tras el embarazo.',
  alternates: {
    canonical: 'https://natyentrenadora.cl/post-parto',
  },
  openGraph: {
    title: 'Post Parto Seguro | Entrenamiento Progresivo | Naty Entrenadora',
    description: 'Rutinas guiadas de 20-30 min para mamás. Reeducación del core y suelo pélvico con acompañamiento profesional.',
    url: 'https://natyentrenadora.cl/post-parto',
    siteName: 'Naty Entrenadora',
    images: ['https://res.cloudinary.com/dhgifjpkh/image/upload/v1769188879/NR_logo_zluqwc.png'],
    type: 'website',
  },
};

export default function PostPartoPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    'name': 'Programa Post Parto Seguro',
    'provider': {
      '@type': 'Person',
      'name': 'Natalia Riquelme',
      'jobTitle': 'Preparadora Física Especialista en Post Parto',
      'worksFor': {
        '@type': 'Organization',
        'name': 'Naty Entrenadora',
      },
    },
    'serviceType': 'Postpartum Exercise & Rehabilitation',
    'description': 'Entrenamiento de respiración hipopresiva y reconexión profunda del core para mujeres en periodo postparto.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PostParto />
    </>
  );
}
