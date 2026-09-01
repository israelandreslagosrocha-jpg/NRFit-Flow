'use client';

import React, { createContext, useContext, useState } from 'react';

const UserDataContext = createContext();

export function UserDataProvider({ children }) {
  // Favorites / Saved videos
  const [favorites, setFavorites] = useState(['w_01', 'w_03']);

  // Completed workouts IDs
  const [completedWorkouts, setCompletedWorkouts] = useState(['w_02']);

  // Alumna Progress Data (Weight & Measurements)
  const [progressData, setProgressData] = useState([
    { date: '2026-05-01', weight: 64.5, waist: 72, hips: 98, chest: 88, notes: 'Inicio de programa' },
    { date: '2026-06-01', weight: 63.2, waist: 70, hips: 96, chest: 87, notes: 'Mes 1 completado' },
    { date: '2026-07-01', weight: 62.0, waist: 68.5, hips: 95, chest: 86, notes: 'Sintiendo más energía' },
    { date: '2026-08-01', weight: 61.1, waist: 67, hips: 94, chest: 85, notes: 'Excelente definición' }
  ]);

  // Today's Tip from Naty
  const [tipOfTheDay] = useState({
    id: 'tip_today',
    date: '10 de Agosto, 2026',
    title: 'La clave para activar glúteos sin recargar lumbar',
    description: 'Hoy Naty te enseña cómo mantener la pelvis neutra durante las patadas de glúteo y puentes para una activación 100% enfocada.',
    duration: '2:45 min',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop&q=80',
    category: 'Técnica & Postura'
  });

  // Mock Workouts Library (Apple Fitness+ style rich metadata)
  const [workouts] = useState([
    {
      id: 'w_01',
      title: 'GAP Intenso: Glúteos de Acero & Abdomen',
      trainer: 'Naty Entrenadora',
      duration: '35 min',
      level: 'Intermedio',
      system: 'gap-en-casa',
      category: 'GAP',
      calories: 320,
      thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&auto=format&fit=crop&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      isHero: true,
      description: 'Sesión enfocada en hipertrofia de glúteo mayor y medio combinada con circuitos metabólicos de abdomen.',
      equipment: 'Bandas elásticas y tobilleras'
    },
    {
      id: 'w_02',
      title: 'Fuerza Funcional & Core Full Body',
      trainer: 'Naty Entrenadora',
      duration: '35 min',
      level: 'Intermedio',
      system: 'team-naty',
      category: 'Cardio & Fuerza',
      calories: 320,
      thumbnail: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      isHero: false,
      description: 'Sesión integral de fuerza funcional y estabilidad de core. Adaptada a diferentes niveles de intensidad.',
      equipment: 'Mancuernas ligeras o peso corporal'
    },
    {
      id: 'w_03',
      title: 'Post-Parto: Recuperación Suave de Suelo Pélvico',
      trainer: 'Naty Entrenadora',
      duration: '25 min',
      level: 'Principiante',
      system: 'post-parto',
      category: 'Post-Parto',
      calories: 180,
      thumbnail: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      isHero: false,
      description: 'Ejercicios de respiración hipopresiva y reconexión profunda del core para mamás en etapa de posparto.',
      equipment: 'Mat de yoga y cojín'
    },
    {
      id: 'w_04',
      title: 'GAP Escultura: Piernas & Core Firme',
      trainer: 'Naty Entrenadora',
      duration: '30 min',
      level: 'Intermedio',
      system: 'gap-en-casa',
      category: 'GAP',
      calories: 290,
      thumbnail: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      isHero: false,
      description: 'Moldea cuadriceps, isquiotibiales y zona media con repeticiones controladas y tensión muscular constante.',
      equipment: 'Banda elástica media'
    },
    {
      id: 'w_05',
      title: 'Stretching & Movilidad con Naty',
      trainer: 'Naty Entrenadora',
      duration: '20 min',
      level: 'Todos los niveles',
      system: 'gap-en-casa',
      category: 'Flexibilidad',
      calories: 120,
      thumbnail: 'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=800&auto=format&fit=crop&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnTheLoose.mp4',
      isHero: false,
      description: 'Sesión regenerativa para aliviar tensión muscular, mejorar rango articular y acelerar la recuperación.',
      equipment: 'Mat de yoga'
    }
  ]);

  // Admin Data Summary
  const [adminMetrics] = useState({
    mrr: '$3.750.000 CLP',
    mrrGrowth: '+14.2%',
    activeStudents: 150,
    studentsGrowth: '+22 este mes',
    activeSubscriptions: 150,
    pendingPaymentsCount: 3,
    pendingPaymentsTotal: '$75.000 CLP',
    liveClassesThisWeek: 2,
    retentionRate: '95.4%'
  });

  // Admin Students List
  const [studentsList, setStudentsList] = useState([
    { id: 's_01', name: 'Carolina Martínez', email: 'carolina@ejemplo.com', plan: 'Team Naty Online', status: 'Activa', renewalDate: '2026-08-25', totalPaid: '$25.000 CLP', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
    { id: 's_02', name: 'Valentina Silva', email: 'valentina@ejemplo.com', plan: 'Team Naty Online', status: 'Activa', renewalDate: '2026-08-28', totalPaid: '$25.000 CLP', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100' },
    { id: 's_03', name: 'Camila Rojas', email: 'camila@ejemplo.com', plan: 'Team Naty Online', status: 'Pago Pendiente', renewalDate: '2026-08-10', totalPaid: '$25.000 CLP', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' },
    { id: 's_04', name: 'Mariana Gómez', email: 'mariana@ejemplo.com', plan: 'Team Naty Online', status: 'Activa', renewalDate: '2026-09-01', totalPaid: '$25.000 CLP', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
    { id: 's_05', name: 'Lucía Fernández', email: 'lucia@ejemplo.com', plan: 'Team Naty Online', status: 'Activa', renewalDate: '2026-08-30', totalPaid: '$25.000 CLP', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100' }
  ]);

  const toggleFavorite = (workoutId) => {
    setFavorites(prev => 
      prev.includes(workoutId) 
        ? prev.filter(id => id !== workoutId) 
        : [...prev, workoutId]
    );
  };

  const markWorkoutCompleted = (workoutId) => {
    if (!completedWorkouts.includes(workoutId)) {
      setCompletedWorkouts(prev => [...prev, workoutId]);
    }
  };

  const addProgressEntry = (entry) => {
    setProgressData(prev => [entry, ...prev]);
  };

  return (
    <UserDataContext.Provider value={{
      favorites,
      toggleFavorite,
      completedWorkouts,
      markWorkoutCompleted,
      progressData,
      addProgressEntry,
      tipOfTheDay,
      workouts,
      adminMetrics,
      studentsList,
      setStudentsList
    }}>
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserData() {
  return useContext(UserDataContext);
}
