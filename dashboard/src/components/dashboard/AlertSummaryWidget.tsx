'use client';

import React from 'react';
import Link from 'next/link';
import { Alert } from '@/lib/types';
import { AlertTriangle, Zap, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';

interface AlertSummaryWidgetProps {
  alerts: Alert[];
}

export default function AlertSummaryWidget({ alerts }: AlertSummaryWidgetProps) {
  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  const ovCount = unacknowledged.filter((a) => a.alert_type === 'over_voltage').length;
  const uvCount = unacknowledged.filter((a) => a.alert_type === 'under_voltage').length;
  const opCount = unacknowledged.filter((a) => a.alert_type === 'over_power').length;
  const commCount = unacknowledged.filter(
    (a) => a.alert_type === 'comm_failure' || a.alert_type === 'sensor_failure'
  ).length;

  return (
    <div
      className="card-modern"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert
            size={18}
            color={unacknowledged.length > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
          />
          <h3
            style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            Active Incident Summary
          </h3>
        </div>

        <Link
          href="/alerts"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            color: 'var(--color-accent)',
            fontWeight: 600,
          }}
        >
          View All <ArrowRight size={12} />
        </Link>
      </div>

      {unacknowledged.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <CheckCircle2 size={20} color="var(--color-success)" />
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-success)' }}>
              All Clear — Nominal Conditions
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              No unresolved protection faults or telemetry anomalies.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          <div
            style={{
              backgroundColor: ovCount > 0 ? 'var(--color-danger-bg)' : 'var(--color-bg-secondary)',
              border: `1px solid ${ovCount > 0 ? 'var(--color-danger-border)' : 'var(--color-border-subtle)'}`,
              padding: '8px 10px',
              borderRadius: '6px',
            }}
          >
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Over Voltage</div>
            <div
              className="font-mono"
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: ovCount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)',
              }}
            >
              {ovCount}
            </div>
          </div>

          <div
            style={{
              backgroundColor: uvCount > 0 ? 'var(--color-warning-bg)' : 'var(--color-bg-secondary)',
              border: `1px solid ${uvCount > 0 ? 'var(--color-warning-border)' : 'var(--color-border-subtle)'}`,
              padding: '8px 10px',
              borderRadius: '6px',
            }}
          >
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Under Voltage</div>
            <div
              className="font-mono"
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: uvCount > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)',
              }}
            >
              {uvCount}
            </div>
          </div>

          <div
            style={{
              backgroundColor: opCount > 0 ? 'var(--color-danger-bg)' : 'var(--color-bg-secondary)',
              border: `1px solid ${opCount > 0 ? 'var(--color-danger-border)' : 'var(--color-border-subtle)'}`,
              padding: '8px 10px',
              borderRadius: '6px',
            }}
          >
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Over Power</div>
            <div
              className="font-mono"
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: opCount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)',
              }}
            >
              {opCount}
            </div>
          </div>

          <div
            style={{
              backgroundColor: commCount > 0 ? 'var(--color-warning-bg)' : 'var(--color-bg-secondary)',
              border: `1px solid ${commCount > 0 ? 'var(--color-warning-border)' : 'var(--color-border-subtle)'}`,
              padding: '8px 10px',
              borderRadius: '6px',
            }}
          >
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Comm / Sensor</div>
            <div
              className="font-mono"
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: commCount > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)',
              }}
            >
              {commCount}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
