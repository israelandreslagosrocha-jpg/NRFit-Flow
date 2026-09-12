'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Roles: strictly 'alumna' for student portal; admin is verified via server RLS
  const role = 'alumna';
  
  // Active training system for student: 'team-naty'
  const [activeSystem, setActiveSystem] = useState('team-naty');

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

  const [loading] = useState(false);

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

  const changeSystem = (systemKey) => {
    const systemNames = {
      'team-naty': 'Team Naty Online'
    };
    setActiveSystem(systemKey);
    setUser(prev => ({ ...prev, systemName: systemNames[systemKey] || 'Team Naty Online' }));
  };

  return (
    <AuthContext.Provider value={{
      role,
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
