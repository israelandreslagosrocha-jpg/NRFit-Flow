import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { UserDataProvider } from '../context/UserDataContext';
import Analytics from '../components/analytics/Analytics';

export const metadata: Metadata = {
  metadataBase: new URL('https://natyentrenadora.com'),
  title: 'Naty Entrenadora | Entrena para la vida que tienes',
  description: 'Entrenamiento online continuo para mujeres que quieren recuperar fuerza, energía, movilidad y constancia.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <Analytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''} />
        <AuthProvider>
          <UserDataProvider>
            {children}
          </UserDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
