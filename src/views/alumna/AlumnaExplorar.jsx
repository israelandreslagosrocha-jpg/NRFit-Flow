import React, { useState } from 'react';
import { useUserData } from '../../context/UserDataContext';
import WorkoutCard from '../../components/ui/WorkoutCard';
import VideoPlayerModal from '../../components/ui/VideoPlayerModal';
import { Search, Filter, Sparkles, Flame, Clock } from 'lucide-react';
import './AlumnaExplorar.css';

export default function AlumnaExplorar() {
  const { workouts } = useUserData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedDuration, setSelectedDuration] = useState('Todas');
  const [activeVideo, setActiveVideo] = useState(null);

  const categories = ['Todos', 'GAP', 'Cardio & Fuerza', 'Post-Parto', 'Flexibilidad'];
  const durations = ['Todas', '< 25 min', '25-35 min', '> 35 min'];

  const filteredWorkouts = workouts.filter(w => {
    const matchesSearch = w.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          w.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || w.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="alumna-explorar-page animate-fade-in">
      <div className="explorar-header">
        <h1 className="explorar-title">Explorar Biblioteca de Clases</h1>
        <p className="explorar-subtitle">Encuentra la rutina perfecta según tu tiempo disponible, intensidad y objetivo de hoy.</p>
      </div>

      {/* Search & Filter Bar */}
      <div className="filter-bar glass-card">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar rutinas por nombre, zona muscular o equipo..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-pills-row">
          <span className="filter-label"><Filter size={14} /> Categoría:</span>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`pill-btn ${selectedCategory === cat ? 'active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Series Collections (Apple Fitness+ style) */}
      <div className="series-collections-row">
        <div className="collection-card col-gap">
          <Sparkles size={20} className="col-icon" />
          <h3>Especial Glúteos & Abdomen</h3>
          <p>4 rutinas de alta tensión muscular</p>
        </div>
        <div className="collection-card col-metodo">
          <Flame size={20} className="col-icon" />
          <h3>Fuerza & Movilidad Exprés</h3>
          <p>Rutinas de 20 a 35 minutos de alta efectividad</p>
        </div>
        <div className="collection-card col-postparto">
          <Clock size={20} className="col-icon" />
          <h3>Post-Parto Suave</h3>
          <p>Reconexión pélvica y respiración</p>
        </div>
      </div>

      {/* Workouts Grid */}
      <div className="dashboard-section">
        <h2 className="section-title">
          {selectedCategory === 'Todos' ? 'Todas las Rutinas Disponibles' : `Rutinas de ${selectedCategory}`} 
          <span className="results-count">({filteredWorkouts.length})</span>
        </h2>

        <div className="workout-grid-responsive">
          {filteredWorkouts.map(workout => (
            <WorkoutCard key={workout.id} workout={workout} onPlay={(w) => setActiveVideo(w)} />
          ))}
        </div>
      </div>

      {/* Video Modal Player */}
      {activeVideo && (
        <VideoPlayerModal workout={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </div>
  );
}
