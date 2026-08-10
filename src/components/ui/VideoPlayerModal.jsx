import React from 'react';
import { X, CheckCircle, Flame, Clock, Heart } from 'lucide-react';
import { useUserData } from '../../context/UserDataContext';
import './VideoPlayerModal.css';

export default function VideoPlayerModal({ workout, onClose }) {
  const { markWorkoutCompleted, favorites, toggleFavorite } = useUserData();

  if (!workout) return null;

  const isFavorite = favorites.includes(workout.id);

  const handleFinish = () => {
    markWorkoutCompleted(workout.id);
    onClose();
  };

  return (
    <div className="video-modal-backdrop" onClick={onClose}>
      <div className="video-modal-container glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="video-modal-header">
          <div>
            <span className="video-modal-category">{workout.category || 'Entrenamiento'}</span>
            <h3 className="video-modal-title">{workout.title}</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="video-player-wrapper">
          <video 
            src={workout.videoUrl} 
            controls 
            autoPlay 
            poster={workout.thumbnail} 
            className="main-video-element"
          />
        </div>

        <div className="video-modal-footer">
          <div className="video-meta-tags">
            <span className="meta-tag"><Clock size={14} /> {workout.duration}</span>
            <span className="meta-tag"><Flame size={14} /> {workout.calories || 300} kcal</span>
            <span className="meta-tag">Nivel: {workout.level || 'Intermedio'}</span>
          </div>

          <div className="video-modal-actions">
            <button 
              onClick={() => toggleFavorite(workout.id)} 
              className={`fav-action-btn ${isFavorite ? 'active' : ''}`}
            >
              <Heart size={16} fill={isFavorite ? '#E91E63' : 'none'} color={isFavorite ? '#E91E63' : '#fff'} />
              <span>{isFavorite ? 'En favoritos' : 'Favorito'}</span>
            </button>

            <button onClick={handleFinish} className="btn btn-primary btn-sm">
              <CheckCircle size={16} />
              <span>Marcar como completada</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
