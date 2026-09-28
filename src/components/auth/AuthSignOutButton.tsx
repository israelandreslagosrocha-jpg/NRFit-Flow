"use client";

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';

type AuthSignOutButtonProps = {
  className?: string;
};

/** Cierra la sesión del proyecto Supabase activo y vuelve al acceso. */
export function AuthSignOutButton({ className }: AuthSignOutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await createClient().auth.signOut({ scope: 'local' });
    } finally {
      // La navegación completa obliga a renovar el estado SSR con cookies limpias.
      window.location.assign('/auth/login');
    }
  };

  return (
    <button type="button" className={className} onClick={handleSignOut} disabled={isSigningOut}>
      <LogOut size={16} aria-hidden="true" />
      <span>{isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
    </button>
  );
}
