import React from 'react';
import { Play, Heart, Clock, Flame, CheckCircle } from 'lucide-react';
import { useUserData } from '../../context/UserDataContext';
import './WorkoutCard.css';

export default function WorkoutCard({ workout, onPlay, isHero = false }) {
  const { favorites, toggleFavorite, completedWorkouts } = useUserData();

  const isFavorite = favorites.includes(workout.id);
  const isCompleted = completedWorkouts.includes(workout.id);

  return (
    <div className={`workout-card glass-card ${isHero ? 'is-hero' : ''}`}>
      <div className="workout-thumbnail-container">
        <img 
          src={workout.thumbnail} 
          alt={workout.title} 
          className="workout-thumbnail"
        />
        <div className="thumbnail-overlay"></div>

        {/* Top Badges */}
        <div className="card-top-badges">
          <span className="badge category-badge">{workout.category}</span>
          <button 
            onClick={(e) => { e.stopPropagation(); toggleFavorite(workout.id); }}
            className={`fav-btn ${isFavorite ? 'active' : ''}`}
            title="Guardar en favoritos"
          >
            <Heart size={16} fill={isFavorite ? '#E91E63' : 'none'} color={isFavorite ? '#E91E63' : '#ffffff'} />
          </button>
        </div>

        {/* Play Button Overlay */}
        <button 
          onClick={() => onPlay(workout)} 
          className="play-overlay-btn" 
          title="Iniciar clase"
        >
          <Play size={isHero ? 28 : 22} fill="#ffffff" />
        </button>

        {/* Completed Badge */}
        {isCompleted && (
          <div className="completed-badge">
            <CheckCircle size={14} />
            <span>Completada</span>
          </div>
        )}

        {/* Bottom Duration Badge */}
        <div className="card-bottom-info">
          <div className="meta-pill">
            <Clock size={13} />
            <span>{workout.duration}</span>
          </div>
          <div className="meta-pill">
            <Flame size={13} />
            <span>{workout.calories} kcal</span>
          </div>
        </div>
      </div>

      <div className="workout-card-body">
        <span className="workout-level-tag">{workout.level} • Naty Entrenadora</span>
        <h3 className="workout-title">{workout.title}</h3>
        {workout.description && (
          <p className="workout-description">{workout.description}</p>
        )}

        <div className="workout-card-action">
          <button onClick={() => onPlay(workout)} className="btn btn-primary btn-sm btn-play-now">
            <Play size={16} fill="#ffffff" />
            <span>Entrenar ahora</span>
          </button>
        </div>
      </div>
    </div>
  );
}
