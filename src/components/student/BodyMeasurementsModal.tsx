'use client';

import React, { useState } from 'react';
import { recordMeasurementAction } from '../../actions/measurements';
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import './BodyMeasurementsModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  lastWeight?: number | null;
  lastWaist?: number | null;
  lastHips?: number | null;
}

export default function BodyMeasurementsModal({
  isOpen,
  onClose,
  onSaved,
  lastWeight,
  lastWaist,
  lastHips,
}: Props) {
  const [weight, setWeight] = useState<string>(lastWeight ? String(lastWeight) : '');
  const [waist, setWaist] = useState<string>(lastWaist ? String(lastWaist) : '');
  const [hips, setHips] = useState<string>(lastHips ? String(lastHips) : '');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage(null);
    setLoading(true);

    const res = await recordMeasurementAction({
      weight_kg: parseFloat(weight),
      waist_cm: waist ? parseFloat(waist) : null,
      hips_cm: hips ? parseFloat(hips) : null,
      notes: notes.trim() || null,
    });

    setLoading(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: res.message });
      if (onSaved) onSaved();
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setStatusMessage({ type: 'error', text: res.message });
    }
  }

  return (
    <div className="measurements-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="measurements-modal-card">
        <div className="measurements-modal-header">
          <div>
            <h3 id="modal-title">Registrar Medidas</h3>
            <p>Registra tu peso y circunferencias para monitorear tu evolución semanal.</p>
          </div>
          <button className="measurements-close-btn" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        {statusMessage && (
          <div className={`measurements-alert ${statusMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="measurements-form">
          <div className="measurements-input-group">
            <label htmlFor="weight_kg">Peso actual (kg) *</label>
            <input
              id="weight_kg"
              type="number"
              step="0.1"
              min="30"
              max="250"
              required
              placeholder="Ej: 64.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>

          <div className="measurements-row">
            <div className="measurements-input-group">
              <label htmlFor="waist_cm">Cintura (cm)</label>
              <input
                id="waist_cm"
                type="number"
                step="0.5"
                min="40"
                max="200"
                placeholder="Ej: 72.0"
                value={waist}
                onChange={(e) => setWaist(e.target.value)}
              />
            </div>
            <div className="measurements-input-group">
              <label htmlFor="hips_cm">Cadera (cm)</label>
              <input
                id="hips_cm"
                type="number"
                step="0.5"
                min="40"
                max="220"
                placeholder="Ej: 98.0"
                value={hips}
                onChange={(e) => setHips(e.target.value)}
              />
            </div>
          </div>

          <div className="measurements-input-group">
            <label htmlFor="notes">Notas o sensaciones de hoy (opcional)</label>
            <input
              id="notes"
              type="text"
              maxLength={200}
              placeholder="Ej: Me sentí con más energía en la clase de hoy."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="measurements-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" /> Guardando...
                </>
              ) : (
                'Guardar medidas'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
