import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { UserDataProvider } from '../context/UserDataContext';

export const metadata: Metadata = {
  title: 'Naty Entrenadora | Plataforma Digital Multiprograma',
  description: 'Entrenamiento que se adapta a tu vida, tu nivel y tus objetivos. Método 40/3, Presencial, Post Parto y Pilates.',
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
