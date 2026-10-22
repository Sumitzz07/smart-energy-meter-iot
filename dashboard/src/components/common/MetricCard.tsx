'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as LucideIcons from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: number | null | undefined;
  unit?: string;
  decimals?: number;
  icon?: string;
  isWarning?: boolean;
  statusText?: string;
  subtext?: string;
  accentColor?: string;
  badge?: string;
}

export default function MetricCard({
  label,
  value,
  unit = '',
  decimals = 2,
  icon = 'Activity',
  isWarning = false,
  statusText = 'Normal',
  subtext,
  accentColor,
  badge,
}: MetricCardProps) {
  const [pulse, setPulse] = useState(false);
  const prevValue = useRef<number | null | undefined>(value);

  useEffect(() => {
    if (value !== undefined && value !== null && prevValue.current !== value) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 350);
      prevValue.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  const IconComponent = (LucideIcons as any)[icon] || LucideIcons.Activity;

  const formattedValue =
    value !== null && value !== undefined
      ? value.toLocaleString('en-IN', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : null;

  const isCurrency = unit === '₹';

  // Dynamic accent color based on metric label if not explicitly provided
  const metricColor = (() => {
    if (accentColor) return accentColor;
    switch (label.toLowerCase()) {
      case 'voltage':
        return 'hsl(210, 95%, 58%)';
      case 'current':
        return 'hsl(175, 80%, 46%)';
      case 'power':
        return 'hsl(38, 92%, 50%)';
      case 'energy':
        return 'hsl(145, 68%, 45%)';
      case 'frequency':
        return 'hsl(280, 75%, 65%)';
      case 'power factor':
        return 'hsl(165, 75%, 45%)';
      case 'total cost':
        return 'hsl(45, 95%, 55%)';
      default:
        return 'var(--color-accent)';
    }
  })();

  return (
    <div
      className="card-modern"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '18px 20px',
        borderColor: isWarning
          ? 'var(--color-danger)'
          : pulse
          ? 'var(--color-accent-border)'
          : undefined,
        boxShadow: isWarning
          ? 'var(--shadow-glow-danger)'
          : pulse
          ? 'var(--shadow-glow)'
          : undefined,
        transition: 'all var(--transition-normal)',
      }}
    >
      {/* Top Header: [ICON] METRIC NAME + Optional Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: isWarning ? 'var(--color-danger-bg)' : 'var(--color-bg-secondary)',
              color: isWarning ? 'var(--color-danger)' : metricColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${isWarning ? 'var(--color-danger-border)' : 'var(--color-border)'}`,
              flexShrink: 0,
            }}
          >
            <IconComponent size={17} />
          </div>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        </div>

        {badge && (
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Center: Large Animated Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '2px 0 10px' }}>
        {formattedValue === null ? (
          <div
            className="skeleton-shimmer"
            style={{ height: '36px', width: '130px', borderRadius: '6px' }}
          />
        ) : (
          <>
            {isCurrency && (
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginRight: '1px',
                }}
              >
                ₹
              </span>
            )}
            <span
              className="value-display font-mono"
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: isWarning
                  ? 'var(--color-danger)'
                  : pulse
                  ? 'var(--color-accent)'
                  : 'var(--color-text-primary)',
              }}
            >
              {formattedValue}
            </span>
            {!isCurrency && unit && (
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  marginLeft: '3px',
                }}
              >
                {unit}
              </span>
            )}
          </>
        )}
      </div>

      {/* Bottom Row: Status / Trend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: '8px',
          marginTop: '2px',
        }}
      >
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
          {subtext || 'Telemetry'}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: isWarning ? 'var(--color-danger)' : 'var(--color-success)',
            fontWeight: 700,
            fontSize: '0.75rem',
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: isWarning ? 'var(--color-danger)' : 'var(--color-success)',
            }}
          />
          {statusText}
        </span>
      </div>
    </div>
  );
}
