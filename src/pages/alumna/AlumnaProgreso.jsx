import React, { useState } from 'react';
import { useUserData } from '../../context/UserDataContext';
import StatCard from '../../components/ui/StatCard';
import { TrendingUp, Plus, Award, Scale, Ruler, Camera, Check } from 'lucide-react';
import './AlumnaProgreso.css';

export default function AlumnaProgreso() {
  const { progressData, addProgressEntry } = useUserData();

  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const latest = progressData[0] || { weight: 62.0, waist: 68, hips: 95 };
  const initial = progressData[progressData.length - 1] || { weight: 64.5, waist: 72, hips: 98 };

  const weightDiff = (latest.weight - initial.weight).toFixed(1);
  const waistDiff = (latest.waist - initial.waist).toFixed(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!weight) return;

    addProgressEntry({
      date: new Date().toISOString().split('T')[0],
      weight: parseFloat(weight),
      waist: waist ? parseFloat(waist) : latest.waist,
      hips: hips ? parseFloat(hips) : latest.hips,
      notes: 'Registro manual'
    });

    setWeight('');
    setWaist('');
    setHips('');
    setShowForm(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="alumna-progreso-page animate-fade-in">
      <div className="progreso-header">
        <div>
          <h1 className="progreso-title">Mi Progreso & Transformación</h1>
          <p className="progreso-subtitle">Monitorea la evolución de tu peso, medidas corporales y logros con Naty.</p>
        </div>

        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm">
          <Plus size={16} />
          <span>{showForm ? 'Cerrar Registro' : 'Registrar Medidas de Hoy'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="alert-success-banner glass-card">
          <Check size={18} />
          <span>¡Nuevo registro de peso y medidas guardado con éxito!</span>
        </div>
      )}

      {/* Form modal/inline */}
      {showForm && (
        <form onSubmit={handleSubmit} className="entry-form-card glass-card">
          <h3>Nuevo Registro de Progreso</h3>
          <div className="form-grid-3">
            <div className="form-group">
              <label>Peso Actual (kg)</label>
              <input 
                type="number" 
                step="0.1" 
                placeholder="ej: 61.5" 
                value={weight} 
                onChange={(e) => setWeight(e.target.value)}
                className="form-control"
                required
              />
            </div>
            <div className="form-group">
              <label>Cintura (cm)</label>
              <input 
                type="number" 
                step="0.5" 
                placeholder="ej: 67" 
                value={waist} 
                onChange={(e) => setWaist(e.target.value)}
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label>Cadera (cm)</label>
              <input 
                type="number" 
                step="0.5" 
                placeholder="ej: 94" 
                value={hips} 
                onChange={(e) => setHips(e.target.value)}
                className="form-control"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm">
            Guardar Medidas
          </button>
        </form>
      )}

      {/* Metrics Row */}
      <div className="grid-3">
        <StatCard 
          title="Peso Actual" 
          value={`${latest.weight} kg`} 
          subtitle="Variación total" 
          trend={`${weightDiff} kg`} 
          icon={Scale} 
          color="pink" 
        />
        <StatCard 
          title="Cintura" 
          value={`${latest.waist} cm`} 
          subtitle="Reducción total" 
          trend={`${waistDiff} cm`} 
          icon={Ruler} 
          color="purple" 
        />
        <StatCard 
          title="Cadera" 
          value={`${latest.hips} cm`} 
          subtitle="Tensión muscular" 
          trend="Firmes" 
          icon={TrendingUp} 
          color="orange" 
        />
      </div>

      {/* Evolution History Table */}
      <div className="dashboard-section">
        <h2 className="section-title">Historial de Registros</h2>
        
        <div className="table-responsive-wrapper glass-card">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Peso (kg)</th>
                <th>Cintura (cm)</th>
                <th>Cadera (cm)</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {progressData.map((row, idx) => (
                <tr key={idx}>
                  <td className="font-weight-600">{row.date}</td>
                  <td className="text-highlight">{row.weight} kg</td>
                  <td>{row.waist} cm</td>
                  <td>{row.hips} cm</td>
                  <td className="text-muted-cell">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Achievement Badges (Gamification) */}
      <div className="dashboard-section">
        <h2 className="section-title">Medallas & Logros Desbloqueados</h2>

        <div className="badges-grid">
          <div className="achievement-card glass-card unlocked">
            <Award size={32} className="badge-icon gold" />
            <h4>Racha de 14 Días</h4>
            <p>Constancia imparable en el programa</p>
          </div>
          <div className="achievement-card glass-card unlocked">
            <TrendingUp size={32} className="badge-icon pink" />
            <h4>Primeros -2kg</h4>
            <p>Meta alcanzada con éxito</p>
          </div>
          <div className="achievement-card glass-card locked">
            <Camera size={32} className="badge-icon muted" />
            <h4>30 Días de Fotos</h4>
            <p>Por desbloquear el día 30</p>
          </div>
        </div>
      </div>
    </div>
  );
}
