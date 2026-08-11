'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Roles: 'alumna' | 'admin'
  const [role, setRole] = useState('alumna');
  
  // Active training system for student: 'gap-en-casa' | 'metodo-40-3' | 'post-parto' | 'presencial'
  const [activeSystem, setActiveSystem] = useState('gap-en-casa');

  // Simulated or Supabase user
  const [user, setUser] = useState({
    id: 'usr_001',
    name: 'Carolina Martínez',
    email: 'carolina@ejemplo.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    systemName: 'GAP en Casa Mujeres',
    startDate: '2026-01-15',
    streakDays: 14,
    level: 'Intermedio'
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(prev => ({ ...prev, email: session.user.email, id: session.user.id }));
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser(prev => ({ ...prev, email: session.user.email, id: session.user.id }));
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const toggleRole = (newRole) => {
    setRole(newRole || (role === 'alumna' ? 'admin' : 'alumna'));
  };

  const changeSystem = (systemKey) => {
    const systemNames = {
      'gap-en-casa': 'GAP en Casa Mujeres',
      'metodo-40-3': 'Método 40/3',
      'post-parto': 'Programa Post-Parto',
      'presencial': 'Entrenamiento Presencial'
    };
    setActiveSystem(systemKey);
    setUser(prev => ({ ...prev, systemName: systemNames[systemKey] || 'GAP en Casa Mujeres' }));
  };

  return (
    <AuthContext.Provider value={{
      role,
      setRole,
      toggleRole,
      activeSystem,
      changeSystem,
      user,
      setUser,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
