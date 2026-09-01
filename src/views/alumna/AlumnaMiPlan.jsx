import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUserData } from '../../context/UserDataContext';
import WorkoutCard from '../../components/ui/WorkoutCard';
import VideoPlayerModal from '../../components/ui/VideoPlayerModal';
import { Calendar as CalendarIcon, CheckCircle, Clock, ShieldCheck, Flame, ChevronRight } from 'lucide-react';
import './AlumnaMiPlan.css';

export default function AlumnaMiPlan() {
  const { user } = useAuth();
  const { workouts, completedWorkouts } = useUserData();
  const [activeVideo, setActiveVideo] = useState(null);

  const daysOfWeek = [
    { day: 'Lun', date: '10 Ago', title: 'Entrenamiento Grabado Semanal', workoutId: 'w_01', isToday: true, status: 'Disponible' },
    { day: 'Mar', date: '11 Ago', title: 'Clase LIVE con Natalia (20:00)', workoutId: 'w_02', isToday: false, status: 'En Vivo' },
    { day: 'Mié', date: '12 Ago', title: 'Descanso Activo & Movilidad', workoutId: 'w_05', isToday: false, status: 'Opcional' },
    { day: 'Jue', date: '13 Ago', title: 'Clase LIVE con Natalia (20:00)', workoutId: 'w_04', isToday: false, status: 'En Vivo' },
    { day: 'Vie', date: '14 Ago', title: 'Videoteca & Práctica Libre', workoutId: 'w_02', isToday: false, status: 'Disponible' },
    { day: 'Sáb', date: '15 Ago', title: 'Descanso & Recuperación', workoutId: null, isToday: false, status: 'Descanso' },
    { day: 'Dom', date: '16 Ago', title: 'Planificación de la Semana', workoutId: null, isToday: false, status: 'Descanso' }
  ];

  const selectedTodayWorkout = workouts.find(w => w.id === 'w_01') || workouts[0];

  return (
    <div className="alumna-mi-plan-page animate-fade-in">
      <div className="plan-header">
        <h1 className="plan-title">Mi Plan: {user.systemName}</h1>
        <p className="plan-subtitle">Tu estructura semanal personalizada para lograr resultados visibles semana a semana.</p>
      </div>

      {/* Subscription Status Card */}
      <div className="subscription-card glass-card">
        <div className="sub-card-left">
          <div className="sub-badge">
            <ShieldCheck size={18} />
            <span>Suscripción Activa</span>
          </div>
          <h3 className="sub-plan-name">Plan Trimestral {user.systemName}</h3>
          <p className="sub-renewal-info">Próxima renovación: 25 de Agosto, 2026 • Acceso ilimitado a biblioteca y lives</p>
        </div>

        <div className="sub-card-right">
          <div className="plan-metric">
            <span className="p-lbl">Progreso del Programa</span>
            <span className="p-val">Semana 3 de 12</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: '25%' }}></div>
          </div>
        </div>
      </div>

      {/* Weekly Schedule Row */}
      <div className="dashboard-section">
        <h2 className="section-title">Calendario de la Semana</h2>

        <div className="weekly-schedule-grid">
          {daysOfWeek.map((item, idx) => {
            const isDone = item.workoutId && completedWorkouts.includes(item.workoutId);

            return (
              <div 
                key={idx} 
                className={`schedule-day-card glass-card ${item.isToday ? 'is-today' : ''} ${isDone ? 'is-completed' : ''}`}
              >
                <div className="day-card-header">
                  <span className="day-name">{item.day}</span>
                  <span className="day-date">{item.date}</span>
                </div>

                <div className="day-card-body">
                  <span className="day-workout-title">{item.title}</span>
                  {isDone ? (
                    <span className="status-badge done"><CheckCircle size={12} /> Completada</span>
                  ) : item.status === 'Descanso' ? (
                    <span className="status-badge rest">Descanso</span>
                  ) : (
                    <span className="status-badge pending">{item.status}</span>
                  )}
                </div>

                {item.workoutId && (
                  <button 
                    onClick={() => {
                      const w = workouts.find(x => x.id === item.workoutId);
                      if (w) setActiveVideo(w);
                    }} 
                    className="day-card-action"
                  >
                    <span>Ver clase</span>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Workout Spotlight for Today */}
      <div className="dashboard-section">
        <h2 className="section-title">Entrenamiento de Hoy</h2>
        <WorkoutCard workout={selectedTodayWorkout} onPlay={(w) => setActiveVideo(w)} isHero={true} />
      </div>

      {/* Video Modal Player */}
      {activeVideo && (
        <VideoPlayerModal workout={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </div>
  );
}
