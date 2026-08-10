import React from 'react';
import './StatCard.css';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'pink' }) {
  return (
    <div className={`stat-card glass-card color-${color}`}>
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        {Icon && (
          <div className="stat-icon-wrapper">
            <Icon size={20} />
          </div>
        )}
      </div>

      <div className="stat-value">{value}</div>

      {(subtitle || trend) && (
        <div className="stat-footer">
          {trend && <span className="stat-trend">{trend}</span>}
          {subtitle && <span className="stat-subtitle">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
