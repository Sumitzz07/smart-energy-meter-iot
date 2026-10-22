'use client';

import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SettingsForm from '@/components/settings/SettingsForm';
import SimulatorPanel from '@/components/simulator/SimulatorPanel';
import AlertsList from '@/components/alerts/AlertsList';
import { useDevices } from '@/context/DeviceContext';
import { useSettings } from '@/hooks/useSettings';
import { useAlerts } from '@/hooks/useAlerts';
import { useRealtimeReadings } from '@/hooks/useRealtimeReadings';
import { Zap, Activity, ShieldAlert, Power, Sliders } from 'lucide-react';

export default function SettingsPage() {
  const { devices, selectedDeviceId, currentDeviceStatus: status, isStale } = useDevices();
  const activeDeviceId = selectedDeviceId === 'all' ? (devices[0]?.device_id || 'esp32-meter-001') : selectedDeviceId;
  const { latestReading } = useRealtimeReadings(activeDeviceId);
  const { settings, updateSettings, isSaving } = useSettings(activeDeviceId);
  const { alerts, acknowledgeAlert } = useAlerts(activeDeviceId);

  // Relay state: authoritative from currentDeviceStatus?.relay1_status
  const relayActive = status?.relay1_status === true;
  const isFaultActive =
    !relayActive ||
    Boolean(latestReading?.protection_status && latestReading.protection_status !== 'normal');

  return (
    <DashboardLayout>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={22} color="var(--color-accent)" />
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Hardware Thresholds & System Settings
            </h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Configure auto-trip thresholds, power limits, and energy tariff rates for{' '}
            <strong className="font-mono" style={{ color: 'var(--color-accent)' }}>
              {activeDeviceId}
            </strong>
          </p>
        </div>

        {/* Live Status Ribbon */}
        <div
          className="card-modern"
          style={{
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            borderColor: isFaultActive ? 'var(--color-danger-border)' : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
            <Zap size={15} color="var(--color-info)" />
            <span style={{ color: 'var(--color-text-muted)' }}>Live V:</span>
            <strong className="font-mono" style={{ color: 'var(--color-text-primary)' }}>
              {latestReading ? `${latestReading.voltage.toFixed(1)}V` : '--'}
            </strong>
          </div>

          <span style={{ color: 'var(--color-border)' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
            <Activity size={15} color="var(--color-warning)" />
            <span style={{ color: 'var(--color-text-muted)' }}>Live P:</span>
            <strong className="font-mono" style={{ color: 'var(--color-text-primary)' }}>
              {latestReading ? `${latestReading.power.toFixed(1)}W` : '--'}
            </strong>
          </div>

          <span style={{ color: 'var(--color-border)' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
            <ShieldAlert size={15} color={isFaultActive ? 'var(--color-danger)' : 'var(--color-success)'} />
            <span style={{ color: 'var(--color-text-muted)' }}>Status:</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                backgroundColor: isFaultActive ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                color: isFaultActive ? 'var(--color-danger)' : 'var(--color-success)',
                textTransform: 'uppercase',
              }}
            >
              {latestReading?.protection_status || 'normal'}
            </span>
          </div>

          <span style={{ color: 'var(--color-border)' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
            <Power size={15} color={relayActive ? 'var(--color-success)' : 'var(--color-danger)'} />
            <span style={{ color: 'var(--color-text-muted)' }}>Relay:</span>
            <strong style={{ color: relayActive ? 'var(--color-success)' : 'var(--color-danger)', fontSize: '0.8125rem' }}>
              {relayActive ? 'ON' : 'OFF'}
            </strong>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Column 1: Settings Form */}
        <div>
          <SettingsForm settings={settings} onSave={updateSettings} isSaving={isSaving} />
        </div>

        {/* Column 2: Live Alerts & Simulator Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--color-text-secondary)',
                marginBottom: '12px',
              }}
            >
              Live Incident Log
            </h2>
            <AlertsList alerts={alerts} onAcknowledge={acknowledgeAlert} />
          </div>

          <SimulatorPanel connectionType={status?.connection_type || 'simulation'} />
        </div>
      </div>
    </DashboardLayout>
  );
}
