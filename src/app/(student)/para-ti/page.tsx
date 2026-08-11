import React from 'react';
import type { Metadata } from 'next';
import AlumnaParaTi from '../../../views/alumna/AlumnaParaTi';

export const metadata: Metadata = {
  title: 'Para ti | Portal de Alumna | Naty Entrenadora',
  description: 'Tu plan diario de entrenamiento, tip de Naty y avance semanal.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function StudentParaTiPage() {
  return <AlumnaParaTi />;
}
