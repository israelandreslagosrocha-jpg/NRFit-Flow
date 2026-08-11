'use client';

import React from 'react';
import './ProgressRing.css';

export default function ProgressRing({ percentage = 75, size = 120, strokeWidth = 10, label = 'Progreso', valueText = '75%' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="progress-ring-container" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="progress-ring-svg">
        {/* Background track */}
        <circle
          className="progress-ring-track"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Animated Progress Ring */}
        <circle
          className="progress-ring-circle"
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E91E63" />
            <stop offset="100%" stopColor="#FF80AB" />
          </linearGradient>
        </defs>
      </svg>

      <div className="progress-ring-text">
        <span className="ring-val">{valueText}</span>
        <span className="ring-lbl">{label}</span>
      </div>
    </div>
  );
}
