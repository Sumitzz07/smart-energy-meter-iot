'use client';

import React from 'react';
import { DeviceStatus } from '@/lib/types';
import { Wifi, Radio, Server, Activity, Power, Zap, ShieldAlert, Cpu } from 'lucide-react';

interface DeviceStatusPanelProps {
  status: DeviceStatus | null;
  isStale: boolean;
  protectionStatus?: string;
  currentAmps?: number;
}

export default function DeviceStatusPanel({ status, isStale, protectionStatus, currentAmps }: DeviceStatusPanelProps) {
  const getStatusColor = (isOk: boolean | null | undefined) => {
    if (isOk === undefined || isOk === null) return 'var(--color-text-muted)';
    return isOk ? 'var(--color-success)' : 'var(--color-danger)';
  };

  // ═══════════════════════════════════════════════════════════════
  // RELAY & CONTACTOR FEEDBACK ARCHITECTURE:
  // 1. Commanded state: status?.relay1_status
  // 2. Physical CT verification: currentAmps > 0.05A while commanded OFF
  // ═══════════════════════════════════════════════════════════════
  const isRelay1On = status?.relay1_status === true;
  const isContactorFailed = !isRelay1On && currentAmps !== undefined && currentAmps > 0.05;
  const hasFault = !isRelay1On || (protectionStatus != null && protectionStatus !== 'normal') || isContactorFailed;
  const faultLabel = isContactorFailed
    ? 'contactor_stuck_or_nc_wiring'
    : (protectionStatus && protectionStatus !== 'normal')
      ? protectionStatus
      : (!isRelay1On ? 'protection_fault' : null);

  return (
    <div
      className="card-modern"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        borderColor: hasFault && !isStale ? 'var(--color-danger)' : undefined,
        boxShadow: hasFault && !isStale ? 'var(--shadow-glow-danger)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={18} color="var(--color-accent)" />
          <h3
            style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              color: 'var(--color-text-secondary)',
            }}
          >
            Hardware Status
          </h3>
        </div>
        <span
          className="font-mono"
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            backgroundColor: 'var(--color-bg-secondary)',
            padding: '2px 8px',
            borderRadius: '4px',
          }}
        >
          {status?.device_id || 'esp32-meter-001'}
        </span>
      </div>

      {isStale && (
        <div
          style={{
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}
        >
          HARDWARE DISCONNECTED / OFFLINE
        </div>
      )}

      {isContactorFailed && !isStale && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '2px solid var(--color-danger)',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-glow-danger)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
            <ShieldAlert size={18} color="var(--color-danger)" />
            <span>⚠️ CRITICAL: CONTACTOR FAILED TO OPEN</span>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Relay commanded <strong>OFF</strong>, but CT sensor detects <strong>{currentAmps?.toFixed(3)} A</strong> still flowing through load!
            Check AC wiring: wire must connect to <strong>NO (Normally Open)</strong>, not <strong>NC</strong>.
          </span>
        </div>
      )}

      {hasFault && !isContactorFailed && !isStale && faultLabel && (
        <div
          style={{
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ShieldAlert size={18} />
          <span>Fault: {faultLabel.toUpperCase()} (Relay Tripped)</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {/* Connection Type */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <Radio size={15} color="var(--color-text-muted)" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Connection</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', textTransform: 'uppercase' }}>
              {status?.connection_type || 'Simulation'}
            </span>
          </div>
        </div>

        {/* WiFi Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <Wifi size={15} color={getStatusColor(status?.wifi_status)} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Wi-Fi Link</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {status?.wifi_status ? 'Active' : 'Offline'}
            </span>
          </div>
        </div>

        {/* GSM Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <Server size={15} color={getStatusColor(status?.gsm_status)} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Cellular GSM</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {status?.gsm_status ? 'Ready' : 'Standby'}
            </span>
          </div>
        </div>

        {/* PZEM Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <Zap size={15} color={getStatusColor(status?.pzem_status)} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>PZEM Sensor</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {status?.pzem_status ? 'OK (Online)' : 'No Signal'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '2px 0' }} />

      {/* Relays & Physical Contact Verification */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Power size={16} color={isRelay1On ? 'var(--color-success)' : 'var(--color-danger)'} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Main Relay 1:
            </span>
            <span
              className="font-mono"
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: isRelay1On ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                color: isRelay1On ? 'var(--color-success)' : 'var(--color-danger)',
                border: `1px solid ${isRelay1On ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
              }}
            >
              {isRelay1On ? 'CMD: CLOSED (ON)' : 'CMD: OPEN (OFF)'}
            </span>
          </div>

          <div>
            {isContactorFailed ? (
              <span
                className="font-mono"
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-danger)',
                  color: '#ffffff',
                }}
              >
                ⚠️ CT: {currentAmps?.toFixed(3)} A FLOWING
              </span>
            ) : !isRelay1On ? (
              <span
                className="font-mono"
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-success-bg)',
                  color: 'var(--color-success)',
                  border: '1px solid var(--color-success-border)',
                }}
              >
                ✅ CT: ISOLATED (0.00 A)
              </span>
            ) : (
              <span
                className="font-mono"
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--color-info)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                ⚡ CT: {currentAmps !== undefined ? `${currentAmps.toFixed(2)} A` : 'CONDUCTING'}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Aux Relay 2:
            </span>
            <span
              className="font-mono"
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: status?.relay2_status ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)',
                color: status?.relay2_status ? 'var(--color-success)' : 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              {status?.relay2_status ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
