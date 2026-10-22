'use client';

import React from 'react';

interface ConnectionBadgeProps {
  type: string;
  isStale: boolean;
}

export default function ConnectionBadge({ type, isStale }: ConnectionBadgeProps) {
  let color = 'var(--color-text-muted)';
  let label = type || 'Unknown';
  let pulsing = false;

  if (isStale || !type) {
    color = 'var(--color-danger)';
    label = 'Offline';
  } else {
    pulsing = true;
    switch (type.toLowerCase()) {
      case 'wifi':
      case 'hardware':
        color = 'var(--color-success)';
        label = type.toLowerCase() === 'hardware' ? 'Hardware Live' : 'Wi-Fi Online';
        break;
      case 'gsm':
        color = 'var(--color-info)';
        label = 'Cellular GSM';
        break;
      case 'simulation':
        color = 'var(--color-accent)';
        label = 'Simulation Node';
        break;
      default:
        color = 'var(--color-text-secondary)';
        label = type;
        pulsing = false;
        break;
    }
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-full)',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
      }}
    >
      <div style={{ position: 'relative', width: '6px', height: '6px' }}>
        {pulsing && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              left: '-3px',
              right: '-3px',
              bottom: '-3px',
              backgroundColor: color,
              borderRadius: '50%',
              opacity: 0.35,
              animation: 'pulseGlow 2s infinite',
            }}
          />
        )}
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: color,
            borderRadius: '50%',
          }}
        />
      </div>
      <span>{label}</span>
    </div>
  );
}
