import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUserData } from '../../context/UserDataContext';
import WorkoutCard from '../../components/ui/WorkoutCard';
import TipOfDayCard from '../../components/ui/TipOfDayCard';
import ProgressRing from '../../components/ui/ProgressRing';
import StatCard from '../../components/ui/StatCard';
import VideoPlayerModal from '../../components/ui/VideoPlayerModal';
import { Sparkles, Calendar, Flame, Trophy, Play, Video } from 'lucide-react';
import './AlumnaParaTi.css';

export default function AlumnaParaTi() {
  const { user, activeSystem } = useAuth();
  const { workouts, tipOfTheDay } = useUserData();
  const [activeVideo, setActiveVideo] = useState(null);

  // Filter workouts for current system or fallback
  const heroWorkout = workouts.find(w => w.system === activeSystem || w.isHero) || workouts[0];
  const recommendedSeries = workouts.filter(w => w.id !== heroWorkout.id);

  return (
    <div className="alumna-para-ti-page animate-fade-in">
      {/* Welcome Hero Banner */}
      <section className="hero-banner glass-card">
        <div className="hero-banner-text">
          <div className="system-pill-badge">
            <Sparkles size={14} />
            <span>SISTEMA: {user.systemName}</span>
          </div>
          <h1 className="hero-greeting">¡Hola, {user.name.split(' ')[0]}! 👋</h1>
          <p className="hero-subtext">
            Hoy es un gran día para moverte. Naty preparó una rutina especial enfocada en activación muscular y quema metabólica.
          </p>
        </div>

        <div className="hero-stats-row">
          <ProgressRing percentage={75} size={110} strokeWidth={9} label="Semana 3" valueText="14 Días" />
          <div className="hero-quick-metrics">
            <div className="metric-box">
              <Flame size={18} className="icon-orange" />
              <div>
                <span className="metric-val">1,840</span>
                <span className="metric-lbl">kcal este mes</span>
              </div>
            </div>
            <div className="metric-box">
              <Trophy size={18} className="icon-gold" />
              <div>
                <span className="metric-val">12</span>
                <span className="metric-lbl">Clases completadas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tip of the Day from Naty */}
      <TipOfDayCard tip={tipOfTheDay} onPlayTip={(t) => setActiveVideo(t)} />

      {/* Hero Recommendation / Clase de Hoy */}
      <section className="dashboard-section">
        <div className="section-header-flex">
          <div>
            <h2 className="section-title">Tu Clase de Hoy</h2>
            <p className="section-subtitle">Programada especialmente según tu evolución en {user.systemName}</p>
          </div>
        </div>

        <WorkoutCard workout={heroWorkout} onPlay={(w) => setActiveVideo(w)} isHero={true} />
      </section>

      {/* Próxima Clase en Vivo Módulo */}
      <section className="live-class-banner glass-card">
        <div className="live-banner-content">
          <div className="live-badge">
            <Video size={16} />
            <span>CLASE EN VIVO CON NATY</span>
          </div>
          <h3 className="live-title">Sesión Especial GAP & Preguntas en Vivo</h3>
          <p className="live-time">Jueves, 18:30 hrs • Transmisión exclusiva Zoom</p>
        </div>
        <button className="btn btn-primary btn-sm">
          <span>Unirme al Live</span>
        </button>
      </section>

      {/* Recomendados para ti */}
      <section className="dashboard-section">
        <div className="section-header-flex">
          <div>
            <h2 className="section-title">Recomendados para ti</h2>
            <p className="section-subtitle">Basado en tus preferencias y nivel {user.level}</p>
          </div>
        </div>

        <div className="workout-grid-responsive">
          {recommendedSeries.map(workout => (
            <WorkoutCard key={workout.id} workout={workout} onPlay={(w) => setActiveVideo(w)} />
          ))}
        </div>
      </section>

      {/* Video Modal Player */}
      {activeVideo && (
        <VideoPlayerModal workout={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </div>
  );
}
