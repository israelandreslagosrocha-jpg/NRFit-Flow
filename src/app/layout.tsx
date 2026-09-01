import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { UserDataProvider } from '../context/UserDataContext';

export const metadata: Metadata = {
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
        <AuthProvider>
          <UserDataProvider>
            {children}
          </UserDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
