import React from 'react';
import type { Metadata } from 'next';
import './auth.css';

export const metadata: Metadata = {
  title: 'Acceso Alumna | Naty Entrenadora',
  description: 'Inicia sesión o regístrate en Team Naty Entrenadora.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-wrapper">
      {children}
    </div>
  );
}
