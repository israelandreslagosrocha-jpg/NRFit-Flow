import React from 'react';
import { Sparkles, Play, MessageSquareHeart } from 'lucide-react';
import './TipOfDayCard.css';

export default function TipOfDayCard({ tip, onPlayTip }) {
  return (
    <div className="tip-of-day-card glass-card">
      <div className="tip-header">
        <div className="tip-badge">
          <MessageSquareHeart size={16} />
          <span>CONSEJO DE NATY</span>
        </div>
        <span className="tip-date">{tip.date}</span>
      </div>

      <div className="tip-content-grid">
        <div className="tip-media-container" onClick={() => onPlayTip(tip)}>
          <img src={tip.thumbnail} alt={tip.title} className="tip-thumbnail" />
          <div className="tip-play-overlay">
            <Play size={20} fill="#ffffff" />
          </div>
          <span className="tip-duration-pill">{tip.duration}</span>
        </div>

        <div className="tip-text-content">
          <span className="tip-category">{tip.category}</span>
          <h4 className="tip-title">{tip.title}</h4>
          <p className="tip-description">{tip.description}</p>
          
          <button onClick={() => onPlayTip(tip)} className="btn btn-secondary btn-sm tip-btn">
            <Sparkles size={14} />
            <span>Escuchar mensaje de Naty</span>
          </button>
        </div>
      </div>
    </div>
  );
}
