'use client';

import React, { useEffect, useState } from 'react';
import {
  Cpu,
  Radio,
  Wifi,
  Server,
  Zap,
  Power,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Gauge,
  Battery,
  Waves,
  TrendingUp,
  HardDrive,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDevices } from '@/context/DeviceContext';
import { useRealtimeReadings } from '@/hooks/useRealtimeReadings';
import { STALE_THRESHOLD_SECONDS } from '@/lib/constants';
import { getDeviceSecondsAgo } from '@/lib/device-status';

export default function DevicePage() {
  const { devices, selectedDeviceId, currentDeviceStatus: status, isStale } = useDevices();
  const activeDeviceId = selectedDeviceId === 'all' ? (devices[0]?.device_id || 'esp32-meter-001') : selectedDeviceId;
  const { latestReading } = useRealtimeReadings(activeDeviceId);
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // Live second-by-second "Last seen X seconds ago" ticker
  useEffect(() => {
    if (!status?.last_seen) return;

    const updateTicker = () => {
      setSecondsAgo(getDeviceSecondsAgo(status.last_seen));
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [status?.last_seen]);

  // Overall Health Calculation
  const healthStatus = (() => {
    if (isStale || !status) {
      return {
        label: 'OFFLINE',
        color: 'var(--color-danger)',
        bg: 'var(--color-danger-bg)',
        border: 'var(--color-danger-border)',
        desc: 'Device has not transmitted a heartbeat within the stale threshold.',
      };
    }
    if (!status.pzem_status) {
      return {
        label: 'WARNING',
        color: 'var(--color-warning)',
        bg: 'var(--color-warning-bg)',
        border: 'var(--color-warning-border)',
        desc: 'PZEM sensor communication fault or reading parity error.',
      };
    }
    return {
      label: 'HEALTHY',
      color: 'var(--color-success)',
      bg: 'var(--color-success-bg)',
      border: 'var(--color-success-border)',
      desc: 'All telemetry channels, Modbus registers, and contactors operational.',
    };
  })();

  const formatTimestamp = (dateString?: string) => {
    if (!dateString) return 'Never';
    try {
      const d = new Date(dateString);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return dateString;
    }
  };

  return (
    <DashboardLayout>
      {/* Top Bar: Title + Health Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={22} color="var(--color-accent)" />
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Device Health & Subsystem Diagnostics
            </h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Hardware diagnostics, peripheral status, and live telemetry health for{' '}
            <strong className="font-mono" style={{ color: 'var(--color-accent)' }}>
              {activeDeviceId}
            </strong>
          </p>
        </div>

        {/* Overall Device Health Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: healthStatus.bg,
            border: `1px solid ${healthStatus.border}`,
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {healthStatus.label === 'HEALTHY' ? (
            <ShieldCheck size={20} color={healthStatus.color} />
          ) : healthStatus.label === 'WARNING' ? (
            <AlertTriangle size={20} color={healthStatus.color} />
          ) : (
            <ShieldAlert size={20} color={healthStatus.color} />
          )}
          <div>
            <div
              style={{
                fontSize: '0.6875rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Hardware Health
            </div>
            <strong style={{ color: healthStatus.color, fontSize: '0.875rem' }}>
              {healthStatus.label}
            </strong>
          </div>
        </div>
      </div>

      {/* 1. Device Information & Identity Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Identity Card */}
        <div className="card-modern">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <HardDrive size={18} color="var(--color-accent)" />
            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
              Hardware Identity
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Device Identifier:</span>
              <strong className="font-mono" style={{ color: 'var(--color-accent)' }}>{activeDeviceId}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>MCU Platform:</span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>ESP32-WROOM-32</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Power Sensor:</span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>PZEM-004T (UART Modbus)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>RTOS Kernel:</span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>FreeRTOS v1.2.0</span>
            </div>
          </div>
        </div>

        {/* Connection & Mode Card */}
        <div className="card-modern">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Radio size={18} color="var(--color-info)" />
            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
              Connectivity Link
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Link State:</span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: isStale ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                  color: isStale ? 'var(--color-danger)' : 'var(--color-success)',
                }}
              >
                {isStale ? 'OFFLINE' : 'ONLINE'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Active Transport:</span>
              <strong style={{ color: 'var(--color-text-primary)', textTransform: 'uppercase' }}>
                {status?.connection_type || 'Unknown'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Heartbeat Period:</span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>5,000 ms (5s)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Stale Watchdog:</span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{STALE_THRESHOLD_SECONDS}s</span>
            </div>
          </div>
        </div>

        {/* Live Activity & Telemetry Heartbeat */}
        <div className="card-modern">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Clock size={18} color="var(--color-warning)" />
            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
              Heartbeat Stream
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Last Pulse:</span>
              <strong className="font-mono" style={{ color: 'var(--color-text-primary)' }}>
                {secondsAgo === 0 ? 'Just now' : `${secondsAgo}s ago`}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Packet Time:</span>
              <span className="font-mono" style={{ color: 'var(--color-text-primary)', fontSize: '0.75rem' }}>
                {formatTimestamp(status?.last_seen)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Sync Protocol:</span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Supabase Realtime (WS)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Diagnostic Assessment:</span>
              <span style={{ color: healthStatus.color, fontWeight: 700 }}>{healthStatus.desc}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Peripheral Status & Hardware Channels */}
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
          Peripheral Subsystems & Output Contactors
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px',
          }}
        >
          {/* PZEM Sensor Status */}
          <div className="card-modern">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color={status?.pzem_status ? 'var(--color-success)' : 'var(--color-danger)'} />
                <strong style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>PZEM-004T</strong>
              </div>
              {status?.pzem_status ? (
                <CheckCircle2 size={16} color="var(--color-success)" />
              ) : (
                <XCircle size={16} color="var(--color-danger)" />
              )}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: status?.pzem_status ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {status?.pzem_status ? 'ACTIVE / OK' : 'SENSOR ERROR'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Voltage, current, power measurement IC
            </div>
          </div>

          {/* Wi-Fi Radio Status */}
          <div className="card-modern">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wifi size={16} color={status?.wifi_status ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                <strong style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Wi-Fi Radio</strong>
              </div>
              {status?.wifi_status ? (
                <CheckCircle2 size={16} color="var(--color-success)" />
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Off</span>
              )}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: status?.wifi_status ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
              {status?.wifi_status ? 'CONNECTED' : 'STANDBY'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              2.4 GHz 802.11 b/g/n primary transceiver
            </div>
          </div>

          {/* GSM / Cellular Status */}
          <div className="card-modern">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={16} color={status?.gsm_status ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                <strong style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>GSM / SIM800L</strong>
              </div>
              {status?.gsm_status ? (
                <CheckCircle2 size={16} color="var(--color-success)" />
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Standby</span>
              )}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: status?.gsm_status ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
              {status?.gsm_status ? 'ONLINE / READY' : 'STANDBY'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Cellular failover transport channel
            </div>
          </div>

          {/* Relay 1 Output Channel */}
          <div className="card-modern">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Power size={16} color={status?.relay1_status ? 'var(--color-success)' : 'var(--color-danger)'} />
                <strong style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Contactor Relay 1</strong>
              </div>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: status?.relay1_status ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  color: status?.relay1_status ? 'var(--color-success)' : 'var(--color-danger)',
                }}
              >
                AUTHORITATIVE
              </span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: status?.relay1_status ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {status?.relay1_status ? 'COMMAND: CLOSED (ON)' : 'COMMAND: TRIPPED (OFF)'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Automatic load protection interlock
            </div>

            {/* Live CT Contact Verification */}
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Contact CT Feedback:</span>
                {!status?.relay1_status ? (
                  (latestReading?.current_amps ?? 0) > 0.05 ? (
                    <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
                      ⚠️ FAIL: {(latestReading?.current_amps ?? 0).toFixed(3)} A
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                      ✅ Isolated (0.000 A)
                    </span>
                  )
                ) : (
                  <span style={{ color: 'var(--color-info)', fontWeight: 600 }}>
                    Conducting ({(latestReading?.current_amps ?? 0).toFixed(3)} A)
                  </span>
                )}
              </div>
              {!status?.relay1_status && (latestReading?.current_amps ?? 0) > 0.05 && (
                <div style={{ color: 'var(--color-danger)', fontSize: '0.6875rem', marginTop: '4px', fontWeight: 600 }}>
                  Contactor failed to open! Check for NC terminal wiring or stuck contacts.
                </div>
              )}
            </div>
          </div>

          {/* Relay 2 Output Channel */}
          <div className="card-modern">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Power size={16} color={status?.relay2_status ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                <strong style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Aux Contactor 2</strong>
              </div>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-muted)',
                }}
              >
                SECONDARY
              </span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: status?.relay2_status ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
              {status?.relay2_status ? 'CLOSED (ON)' : 'OPEN (OFF)'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Auxiliary branch circuit switch
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Telemetry Snapshot */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: 0 }}>
            Live Telemetry Snapshot
          </h2>
          <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Packet: {latestReading ? formatTimestamp(latestReading.timestamp) : 'Waiting for packet...'}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '14px',
          }}
        >
          {/* Voltage */}
          <div className="card-modern">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Zap size={15} color="var(--color-info)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Voltage</span>
            </div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {latestReading ? `${latestReading.voltage.toFixed(1)} V` : '--'}
            </div>
          </div>

          {/* Current */}
          <div className="card-modern">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Activity size={15} color="var(--color-accent)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Current</span>
            </div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {latestReading ? `${latestReading.current_amps.toFixed(3)} A` : '--'}
            </div>
          </div>

          {/* Power */}
          <div className="card-modern">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Gauge size={15} color="var(--color-warning)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Active Power</span>
            </div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {latestReading ? `${latestReading.power.toFixed(1)} W` : '--'}
            </div>
          </div>

          {/* Energy */}
          <div className="card-modern">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Battery size={15} color="var(--color-success)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total Energy</span>
            </div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {latestReading ? `${latestReading.energy_kwh.toFixed(4)} kWh` : '--'}
            </div>
          </div>

          {/* Frequency */}
          <div className="card-modern">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Waves size={15} color="hsl(280, 70%, 60%)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>AC Frequency</span>
            </div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {latestReading ? `${latestReading.frequency.toFixed(1)} Hz` : '--'}
            </div>
          </div>

          {/* Power Factor */}
          <div className="card-modern">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <TrendingUp size={15} color="var(--color-success)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Power Factor</span>
            </div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {latestReading ? `${latestReading.power_factor.toFixed(2)}` : '--'}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
