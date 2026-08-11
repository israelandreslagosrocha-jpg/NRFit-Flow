import React, { useState } from 'react';
import { useUserData } from '../../context/UserDataContext';
import WorkoutCard from '../../components/ui/WorkoutCard';
import VideoPlayerModal from '../../components/ui/VideoPlayerModal';
import { Film, Heart, CheckCircle, Download } from 'lucide-react';
import './AlumnaBiblioteca.css';

export default function AlumnaBiblioteca() {
  const { workouts, favorites, completedWorkouts } = useUserData();
  const [activeTab, setActiveTab] = useState('favorites'); // 'favorites' | 'completed' | 'all'
  const [activeVideo, setActiveVideo] = useState(null);

  const favoriteWorkouts = workouts.filter(w => favorites.includes(w.id));
  const doneWorkouts = workouts.filter(w => completedWorkouts.includes(w.id));

  const displayWorkouts = activeTab === 'favorites' ? favoriteWorkouts :
                          activeTab === 'completed' ? doneWorkouts : workouts;

  return (
    <div className="alumna-biblioteca-page animate-fade-in">
      <div className="biblioteca-header">
        <h1 className="biblioteca-title">Biblioteca de Clases & Favoritos</h1>
        <p className="biblioteca-subtitle">Guarda tus rutinas preferidas y revisa el historial de tus entrenamientos completados.</p>
      </div>

      {/* Tabs Row */}
      <div className="tab-buttons-row glass-card">
        <button 
          onClick={() => setActiveTab('favorites')}
          className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
        >
          <Heart size={16} />
          <span>Mis Favoritos ({favoriteWorkouts.length})</span>
        </button>

        <button 
          onClick={() => setActiveTab('completed')}
          className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
        >
          <CheckCircle size={16} />
          <span>Completadas ({doneWorkouts.length})</span>
        </button>

        <button 
          onClick={() => setActiveTab('all')}
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
        >
          <Film size={16} />
          <span>Catálogo Completo ({workouts.length})</span>
        </button>
      </div>

      {/* Grid */}
      <div className="dashboard-section">
        {displayWorkouts.length === 0 ? (
          <div className="empty-state glass-card">
            <Heart size={36} className="empty-icon" />
            <h3>No tienes elementos en esta categoría</h3>
            <p>Explora las clases y presiona el corazón para guardar tus rutinas favoritas.</p>
          </div>
        ) : (
          <div className="workout-grid-responsive">
            {displayWorkouts.map(workout => (
              <WorkoutCard key={workout.id} workout={workout} onPlay={(w) => setActiveVideo(w)} />
            ))}
          </div>
        )}
      </div>

      {/* Video Modal Player */}
      {activeVideo && (
        <VideoPlayerModal workout={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </div>
  );
}
