'use client';

import React from 'react';
import { useDevices } from '@/context/DeviceContext';
import {
  Cpu,
  Zap,
  Activity,
  Gauge,
  Battery,
  Waves,
  TrendingUp,
  Power,
  Clock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import ConnectionBadge from '../status/ConnectionBadge';
import { STALE_THRESHOLD_SECONDS } from '@/lib/constants';
import { isDeviceStale, getDeviceSecondsAgo } from '@/lib/device-status';

export default function DeviceOverviewGrid() {
  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    latestReadingsMap,
    connectionError,
    isLoading,
    refreshDevices,
  } = useDevices();

  if (connectionError && (!devices || devices.length === 0)) {
    return (
      <div
        className="card-modern"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '36px 20px',
          textAlign: 'center',
          borderColor: 'var(--color-danger-border)',
          backgroundColor: 'var(--color-danger-bg)',
          gap: '12px',
        }}
      >
        <AlertTriangle size={36} color="var(--color-danger)" />
        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-danger)' }}>
          Supabase Connection / DNS Failure
        </h4>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-primary)', maxWidth: '560px' }}>
          Your browser cannot resolve or reach <strong className="font-mono">lfjhyfnwhqwemnyxlfba.supabase.co</strong>.
          This occurs when your local Wi-Fi router DNS fails to resolve Supabase domains.
        </p>
        <div
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem',
            color: 'var(--color-text-secondary)',
            maxWidth: '540px',
            textAlign: 'left',
          }}
        >
          <strong>Quick Fix:</strong> In Chrome/Edge/Brave, go to <em>Settings → Privacy & Security → Use secure DNS</em> and select <strong>Cloudflare (1.1.1.1)</strong> or <strong>Google (Public DNS)</strong>, or configure your Wi-Fi IPv4 DNS to <code>8.8.8.8</code>.
        </div>
        <button
          onClick={() => refreshDevices()}
          className="btn btn-secondary"
          style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={15} />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  if (!devices || devices.length === 0) {
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
        <Cpu size={40} color="var(--color-text-muted)" style={{ marginBottom: '12px' }} />
        <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {isLoading ? 'Checking for Registered Devices...' : 'No Devices Registered'}
        </h4>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          {isLoading ? 'Connecting to Supabase...' : 'Waiting for hardware heartbeat on device_status table...'}
        </p>
      </div>
    );
  }

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Never';
    const seconds = getDeviceSecondsAgo(lastSeen);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={18} color="var(--color-accent)" />
          <h2
            style={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '0.02em',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            Registered Hardware Nodes ({devices.length})
          </h2>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Click any card to open detailed telemetry
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {devices.map((device) => {
          const isSelected = device.device_id === selectedDeviceId;
          const stale = isDeviceStale(device.last_seen);
          const isRelay1On = device.relay1_status === true;
          const reading = latestReadingsMap[device.device_id] || null;

          return (
            <div
              key={device.device_id}
              onClick={() => setSelectedDeviceId(device.device_id)}
              className="card-modern card-interactive"
              style={{
                borderColor: isSelected
                  ? 'var(--color-accent)'
                  : !isRelay1On
                  ? 'var(--color-danger-border)'
                  : undefined,
                boxShadow: isSelected
                  ? 'var(--shadow-glow)'
                  : !isRelay1On
                  ? 'var(--shadow-glow-danger)'
                  : undefined,
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                cursor: 'pointer',
              }}
            >
              {/* Card Top: Identity & Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: isSelected
                        ? 'var(--color-accent-transparent)'
                        : 'var(--color-bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)',
                      border: `1px solid ${isSelected ? 'var(--color-accent-border)' : 'var(--color-border)'}`,
                    }}
                  >
                    <Cpu size={18} />
                  </div>
                  <div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {device.device_id}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                      ESP32 Smart Meter
                    </div>
                  </div>
                </div>

                <ConnectionBadge type={device.connection_type || 'simulation'} isStale={stale} />
              </div>

              {/* Contactor Relay State Ribbon */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isRelay1On ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  border: `1px solid ${isRelay1On ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Power size={14} color={isRelay1On ? 'var(--color-success)' : 'var(--color-danger)'} />
                  <span style={{ color: isRelay1On ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                    Relay 1: {isRelay1On ? 'CLOSED (ON)' : 'TRIPPED (OFF)'}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: isRelay1On ? 'var(--color-success)' : 'var(--color-danger)',
                    fontWeight: 600,
                  }}
                >
                  {isRelay1On ? 'Active Load' : 'Protection Active'}
                </span>
              </div>

              {/* 6 Key Telemetry Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {/* Voltage */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    <Zap size={12} color="hsl(210, 95%, 58%)" />
                    <span>Voltage</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                    {reading?.voltage ? `${Number(reading.voltage).toFixed(1)} V` : '--'}
                  </div>
                </div>

                {/* Current */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    <Activity size={12} color="hsl(175, 80%, 46%)" />
                    <span>Current</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                    {reading?.current_amps ? `${Number(reading.current_amps).toFixed(3)} A` : '--'}
                  </div>
                </div>

                {/* Power */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    <Gauge size={12} color="hsl(38, 92%, 50%)" />
                    <span>Power</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                    {reading?.power ? `${Number(reading.power).toFixed(1)} W` : '--'}
                  </div>
                </div>

                {/* Energy */}
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    <Battery size={12} color="hsl(145, 68%, 45%)" />
                    <span>Energy</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                    {reading?.energy_kwh ? `${Number(reading.energy_kwh).toFixed(4)} kWh` : '--'}
                  </div>
                </div>

                {/* Frequency */}
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    <Waves size={12} color="hsl(280, 75%, 65%)" />
                    <span>Frequency</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                    {reading?.frequency ? `${Number(reading.frequency).toFixed(1)} Hz` : '--'}
                  </div>
                </div>

                {/* Power Factor */}
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    <TrendingUp size={12} color="hsl(165, 75%, 45%)" />
                    <span>PF</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                    {reading?.power_factor ? Number(reading.power_factor).toFixed(2) : '--'}
                  </div>
                </div>
              </div>

              {/* Card Bottom: Last Seen & Enter Dashboard CTA */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  borderTop: '1px solid var(--color-border-subtle)',
                  paddingTop: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)' }}>
                  <Clock size={13} />
                  <span>Last seen: {formatLastSeen(device.last_seen)}</span>
                </div>

                <span
                  style={{
                    color: isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isSelected ? 'Active Device' : 'Open Telemetry'} <ArrowRight size={13} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
