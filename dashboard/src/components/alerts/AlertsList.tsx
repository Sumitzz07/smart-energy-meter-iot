'use client';

import React from 'react';
import { Alert } from '@/lib/types';
import { ALERT_TYPES } from '@/lib/constants';
import { AlertTriangle, AlertCircle, Zap, CheckCircle2, ShieldAlert } from 'lucide-react';

interface AlertsListProps {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
}

export default function AlertsList({ alerts, onAcknowledge }: AlertsListProps) {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'over_voltage':
      case 'under_voltage':
        return <AlertTriangle size={18} color="var(--color-warning)" />;
      case 'over_power':
        return <Zap size={18} color="var(--color-danger)" />;
      case 'comm_failure':
      case 'sensor_failure':
        return <ShieldAlert size={18} color="var(--color-danger)" />;
      default:
        return <AlertCircle size={18} color="var(--color-info)" />;
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  if (!alerts || alerts.length === 0) {
    return (
      <div
        className="card-modern"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
          textAlign: 'center',
        }}
      >
        <CheckCircle2 size={44} color="var(--color-success)" style={{ marginBottom: '12px', opacity: 0.8 }} />
        <h4 style={{ margin: '0 0 4px', color: 'var(--color-text-primary)', fontSize: '0.9375rem', fontWeight: 600 }}>
          No Active Alerts
        </h4>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
          Hardware protection status is nominal. No faults detected.
        </p>
      </div>
    );
  }

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div
      className="card-modern"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        maxHeight: '480px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color-bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} color="var(--color-danger)" />
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
            Fault & Event Log
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {unacknowledgedCount > 0 && (
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--color-danger)',
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
              }}
            >
              {unacknowledgedCount} unacknowledged
            </span>
          )}
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-bg-primary)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {alerts.length} total
          </span>
        </div>
      </div>

      {/* Scrollable list */}
      <div
        style={{
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {alerts.map((alert) => (
          <div
            key={alert.id}
            style={{
              display: 'flex',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: alert.acknowledged
                ? '1px solid var(--color-border-subtle)'
                : '1px solid var(--color-danger-border)',
              backgroundColor: alert.acknowledged
                ? 'var(--color-bg-secondary)'
                : 'var(--color-danger-bg)',
              gap: '12px',
              alignItems: 'flex-start',
              transition: 'all var(--transition-fast)',
            }}
          >
            <div style={{ padding: '2px 0', flexShrink: 0 }}>
              {getAlertIcon(alert.alert_type)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    color: alert.acknowledged ? 'var(--color-text-primary)' : 'var(--color-danger)',
                  }}
                >
                  {ALERT_TYPES[alert.alert_type]?.label || alert.alert_type.toUpperCase()}
                </span>
                <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                  {formatDate(alert.timestamp)}
                </span>
              </div>

              <p style={{ margin: '0 0 6px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                {alert.message}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      backgroundColor: 'var(--color-bg-primary)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    VAL: {Number(alert.value).toFixed(1)} | RELAY: {alert.relay_status?.toUpperCase()}
                  </span>

                  {alert.email_status && (
                    <span
                      title={alert.delivery_error ? `Email: ${alert.email_status} (${alert.delivery_error})` : `Email: ${alert.email_status}`}
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor:
                          alert.email_status === 'sent'
                            ? 'var(--color-success-bg)'
                            : alert.email_status === 'failed'
                            ? 'var(--color-danger-bg)'
                            : alert.email_status === 'skipped'
                            ? 'var(--color-warning-bg)'
                            : 'var(--color-bg-primary)',
                        color:
                          alert.email_status === 'sent'
                            ? 'var(--color-success)'
                            : alert.email_status === 'failed'
                            ? 'var(--color-danger)'
                            : alert.email_status === 'skipped'
                            ? 'var(--color-warning)'
                            : 'var(--color-text-muted)',
                        border: `1px solid ${
                          alert.email_status === 'sent'
                            ? 'var(--color-success-border)'
                            : alert.email_status === 'failed'
                            ? 'var(--color-danger-border)'
                            : alert.email_status === 'skipped'
                            ? 'var(--color-warning-border)'
                            : 'var(--color-border)'
                        }`,
                      }}
                    >
                      ✉️ {alert.email_status}
                    </span>
                  )}
                </div>

                {!alert.acknowledged && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="btn btn-secondary"
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.6875rem',
                      height: '24px',
                    }}
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
