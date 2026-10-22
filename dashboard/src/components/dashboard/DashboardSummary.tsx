'use client';

import React from 'react';
import { Cpu, Wifi, AlertTriangle, ShieldCheck, Zap, Activity, Gauge } from 'lucide-react';
import { DeviceStatus, EnergyReading } from '@/lib/types';

interface DashboardSummaryProps {
  deviceCount: number;
  onlineCount: number;
  offlineCount?: number;
  activeAlertCount: number;
  totalPower?: number;
  currentDeviceStatus: DeviceStatus | null;
  latestReading: EnergyReading | null;
  isStale: boolean;
  isAllDevices?: boolean;
}

export default function DashboardSummary({
  deviceCount,
  onlineCount,
  offlineCount = 0,
  activeAlertCount,
  totalPower = 0,
  currentDeviceStatus,
  latestReading,
  isStale,
  isAllDevices = false,
}: DashboardSummaryProps) {
  const isRelayTripped = currentDeviceStatus?.relay1_status === false;

  return (
    <div
      className="card-modern"
      style={{
        background: 'linear-gradient(135deg, hsl(222, 22%, 12%) 0%, hsl(222, 20%, 15%) 100%)',
        border: '1px solid var(--color-border)',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Top Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Zap size={20} color="var(--color-accent)" />
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              SMART ENERGY METER
            </h1>
          </div>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
              margin: 0,
            }}
          >
            {isAllDevices
              ? 'All Devices Overview — Fleet monitoring, aggregate load metrics, and node contactor states.'
              : `Live hardware telemetry, dynamic relay protection, and load analytics for ${currentDeviceStatus?.device_id || 'active device'}.`}
          </p>
        </div>

        {/* Overall System Health Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            className={`badge ${
              !isAllDevices && isRelayTripped
                ? 'badge-danger'
                : !isAllDevices && isStale
                ? 'badge-warning'
                : 'badge-success'
            }`}
            style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
          >
            <span className="badge-dot" />
            {isAllDevices
              ? `${onlineCount}/${deviceCount} NODES ONLINE`
              : isRelayTripped
              ? 'PROTECTION TRIPPED'
              : isStale
              ? 'DEVICE OFFLINE'
              : 'SYSTEM HEALTHY'}
          </div>
        </div>
      </div>

      {/* Quick Summary Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isAllDevices
            ? 'repeat(auto-fit, minmax(160px, 1fr))'
            : 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          paddingTop: '8px',
          borderTop: '1px solid var(--color-border-subtle)',
        }}
      >
        {/* Total Devices */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent)',
            }}
          >
            <Cpu size={17} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total Devices</div>
            <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {deviceCount}
            </div>
          </div>
        </div>

        {/* Online Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-success-bg)',
              border: '1px solid var(--color-success-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-success)',
            }}
          >
            <Wifi size={17} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Online</div>
            <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-success)' }}>
              {onlineCount}
            </div>
          </div>
        </div>

        {/* Offline Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: offlineCount > 0 ? 'var(--color-danger-bg)' : 'var(--color-bg-secondary)',
              border: `1px solid ${offlineCount > 0 ? 'var(--color-danger-border)' : 'var(--color-border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: offlineCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)',
            }}
          >
            <Wifi size={17} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Offline</div>
            <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 700, color: offlineCount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
              {offlineCount}
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: activeAlertCount > 0 ? 'var(--color-danger-bg)' : 'var(--color-bg-secondary)',
              border: `1px solid ${activeAlertCount > 0 ? 'var(--color-danger-border)' : 'var(--color-border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: activeAlertCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)',
            }}
          >
            <Activity size={17} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Active Alerts</div>
            <div
              className="font-mono"
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: activeAlertCount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)',
              }}
            >
              {activeAlertCount}
            </div>
          </div>
        </div>

        {/* Total Power */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-warning)',
            }}
          >
            <Gauge size={17} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total Power</div>
            <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-warning)' }}>
              {totalPower.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>W</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
