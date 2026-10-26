'use client';

import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardSummary from '@/components/dashboard/DashboardSummary';
import DeviceOverviewGrid from '@/components/dashboard/DeviceOverviewGrid';
import AlertSummaryWidget from '@/components/dashboard/AlertSummaryWidget';
import ReadingsGrid from '@/components/readings/ReadingsGrid';
import RealtimeCharts from '@/components/charts/RealtimeCharts';
import DeviceStatusPanel from '@/components/status/DeviceStatusPanel';
import AlertsList from '@/components/alerts/AlertsList';
import { useRealtimeReadings } from '@/hooks/useRealtimeReadings';
import { useAlerts } from '@/hooks/useAlerts';
import { useDevices } from '@/context/DeviceContext';
import { AlertTriangle, Power, Zap, Activity } from 'lucide-react';
import { isDeviceOnline } from '@/lib/device-status';

export default function DashboardPage() {
  const { devices, selectedDeviceId, currentDeviceStatus, latestReadingsMap, isStale } = useDevices();
  const isAllDevices = selectedDeviceId === 'all';

  // Target device ID for detailed hooks
  const activeDeviceId = isAllDevices ? (devices[0]?.device_id || 'esp32-meter-001') : selectedDeviceId;
  const { latestReading, chartBuffer, lastSuccessfulFetch, fetchError } = useRealtimeReadings(activeDeviceId);
  const { alerts, unacknowledgedCount, acknowledgeAlert } = useAlerts(activeDeviceId);

  // Authoritative Relay state for active device
  const isRelayOff = currentDeviceStatus?.relay1_status === false;
  const readingFault =
    latestReading?.protection_status && latestReading.protection_status !== 'normal';
  const showFaultBanner = !isAllDevices && (isRelayOff || readingFault);
  const faultLabel = (
    readingFault ? latestReading.protection_status : 'protection_fault'
  ).toUpperCase();

  // Fleet aggregate statistics
  const onlineCount = devices.filter((d) => isDeviceOnline(d.last_seen)).length;

  const offlineCount = Math.max(0, devices.length - onlineCount);

  // Total aggregated active power across all devices
  const totalPower = Object.values(latestReadingsMap).reduce((sum, r) => sum + (Number(r.power) || 0), 0);

  return (
    <DashboardLayout>
      {/* Top Summary Banner */}
      <DashboardSummary
        isAllDevices={isAllDevices}
        deviceCount={devices.length}
        onlineCount={onlineCount}
        offlineCount={offlineCount}
        activeAlertCount={unacknowledgedCount}
        totalPower={totalPower}
        currentDeviceStatus={currentDeviceStatus}
        latestReading={latestReading}
        isStale={isStale}
      />

      {isAllDevices ? (
        /* ═══════════════════════════════════════════════════════════════
           ALL DEVICES OVERVIEW: Fleet Grid & Fleet Incident Summary
           ═══════════════════════════════════════════════════════════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <DeviceOverviewGrid />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            <AlertSummaryWidget alerts={alerts} />
            <AlertsList alerts={alerts.slice(0, 5)} onAcknowledge={acknowledgeAlert} />
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════
           SINGLE DEVICE DETAILED VIEW: Telemetry Cards, Charts & Panels
           ═══════════════════════════════════════════════════════════════ */
        <>
          {/* Active Fault Alert Banner */}
          {showFaultBanner && (
            <div
              className="animate-pulse-glow"
              style={{
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: 'var(--shadow-glow-danger)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-danger)',
                  }}
                >
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4
                    style={{
                      margin: 0,
                      color: 'var(--color-danger)',
                      fontSize: '1rem',
                      fontWeight: 700,
                      letterSpacing: '0.01em',
                    }}
                  >
                    {isRelayOff && (latestReading?.current_amps ?? 0) > 0.05
                      ? `CRITICAL: CONTACTOR FAILED TO OPEN (${(latestReading?.current_amps ?? 0).toFixed(2)} A DETECTED)`
                      : `PROTECTION FAULT ACTIVE: ${faultLabel}`}
                  </h4>
                  <p
                    style={{
                      margin: '4px 0 0',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {isRelayOff && (latestReading?.current_amps ?? 0) > 0.05 ? (
                      <span>
                        Relay 1 was commanded <strong>OFF</strong> due to <strong>{faultLabel}</strong>, but CT sensor detects{' '}
                        <strong className="font-mono" style={{ color: 'var(--color-danger)' }}>
                          {(latestReading?.current_amps ?? 0).toFixed(3)} A
                        </strong>{' '}
                        still flowing through the load! Verify AC Live is wired to <strong>NO (Normally Open)</strong>, not <strong>NC</strong>, or inspect for welded contacts.
                      </span>
                    ) : (
                      <span>
                        Threshold violation detected on <strong className="font-mono">{selectedDeviceId}</strong>. Relay contactor tripped to protect connected load.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '4px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--color-danger)',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    letterSpacing: '0.02em',
                  }}
                >
                  <Power size={16} />
                  <span>CMD: RELAY 1 OFF</span>
                </div>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: (latestReading?.current_amps ?? 0) > 0.05 ? '#fca5a5' : 'var(--color-success)',
                  }}
                >
                  {(latestReading?.current_amps ?? 0) > 0.05
                    ? `⚠️ CT: ${(latestReading?.current_amps ?? 0).toFixed(3)} A (STILL FLOWING)`
                    : '✅ CT: 0.00 A (ISOLATED)'}
                </span>
              </div>
            </div>
          )}

          {/* Live Reading Cards */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="var(--color-accent)" />
                <h2
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    letterSpacing: '-0.01em',
                    margin: 0,
                    textTransform: 'uppercase',
                  }}
                >
                  Live Telemetry Readings ({selectedDeviceId})
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {fetchError && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-warning)',
                      backgroundColor: 'rgba(234, 179, 8, 0.15)',
                      border: '1px solid var(--color-warning)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    Reconnecting... Showing cached data
                  </span>
                )}
                {lastSuccessfulFetch && (
                  <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Refreshed: {lastSuccessfulFetch.toLocaleTimeString('en-IN')}
                  </span>
                )}
                {latestReading?.timestamp && (
                  <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>
                    Sensor: {new Date(latestReading.timestamp).toLocaleTimeString('en-IN')}
                  </span>
                )}
              </div>
            </div>
            <ReadingsGrid reading={latestReading} />
          </section>

          {/* Real-time Charts */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="var(--color-info)" />
              <h2
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.01em',
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                Real-time Continuous Monitoring
              </h2>
            </div>
            <RealtimeCharts chartBuffer={chartBuffer} />
          </section>

          {/* Bottom Grid: Status + Incident Overview + Recent Alerts */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {/* Device Status */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <DeviceStatusPanel
                status={currentDeviceStatus}
                isStale={isStale}
                protectionStatus={latestReading?.protection_status}
                currentAmps={latestReading?.current_amps}
              />
            </section>

            {/* Incidents Summary Widget */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <AlertSummaryWidget alerts={alerts} />
              <AlertsList alerts={alerts.slice(0, 5)} onAcknowledge={acknowledgeAlert} />
            </section>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
