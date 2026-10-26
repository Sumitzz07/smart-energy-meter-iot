'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Zap,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Clock,
  Power,
  Server,
  Activity,
  CheckCheck,
  Send,
  Mail,
  RefreshCw,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDevices } from '@/context/DeviceContext';
import { useAlerts } from '@/hooks/useAlerts';
import { useSettings } from '@/hooks/useSettings';
import { ALERT_TYPES } from '@/lib/constants';
import type { Alert } from '@/lib/types';

type StatusFilter = 'all' | 'active' | 'acknowledged';
type TypeFilter = 'all' | 'over_voltage' | 'under_voltage' | 'over_power' | 'comm_failure' | 'sensor_failure' | 'device_offline' | 'recovery';

export default function AlertsPage() {
  const { selectedDeviceId } = useDevices();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);
  const [testCooldown, setTestCooldown] = useState(0);
  const [testFeedback, setTestFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (testCooldown <= 0) return;
    const timer = setInterval(() => {
      setTestCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [testCooldown]);

  const { alerts, unacknowledgedCount, acknowledgeAlert, acknowledgeAll, isLoading } = useAlerts(selectedDeviceId);
  const { settings } = useSettings(selectedDeviceId);

  const handleRunTestAlert = async () => {
    if (isTesting || testCooldown > 0) return;
    setIsTesting(true);
    setTestFeedback(null);
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: selectedDeviceId === 'all' ? 'esp32-meter-001' : selectedDeviceId,
          alert_type: 'over_voltage',
          value: 254.2,
          message: '[TEST] Simulated 254.2V overvoltage spike. Testing Gmail SMTP notification.',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const emailSt = data.dispatch?.email?.status || 'unknown';
        const err = data.dispatch?.errorSummary;
        setTestCooldown(30); // 30s standard client backoff between tests
        setTestFeedback({
          type: 'success',
          message: `Simulated alert generated! Email Delivery: ${emailSt.toUpperCase()}${err ? ` (${err})` : ''}`,
        });
      } else {
        if (data.retryAfterSeconds) {
          setTestCooldown(Math.min(data.retryAfterSeconds, 600));
        }
        setTestFeedback({
          type: 'error',
          message: data.error || 'Failed to dispatch test alert.',
        });
      }
    } catch (err: any) {
      setTestFeedback({
        type: 'error',
        message: err.message || 'Network error triggering test alert.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Helper to determine threshold based on alert type
  const getThresholdForAlert = (alertType: string): string => {
    if (!settings) return '--';
    switch (alertType) {
      case 'over_voltage':
        return `${settings.over_voltage} V`;
      case 'under_voltage':
        return `${settings.under_voltage} V`;
      case 'over_power':
        return `${settings.power_limit} W`;
      default:
        return 'N/A';
    }
  };

  // Helper to format values with units
  const formatAlertValue = (alertType: string, value: number): string => {
    if (value === null || value === undefined) return '--';
    switch (alertType) {
      case 'over_voltage':
      case 'under_voltage':
        return `${Number(value).toFixed(1)} V`;
      case 'over_power':
        return `${Number(value).toFixed(1)} W`;
      default:
        return `${Number(value).toFixed(1)}`;
    }
  };

  // Helper for Severity
  const getSeverity = (alertType: string): { label: 'CRITICAL' | 'WARNING' | 'INFO' | 'RESOLVED'; color: string; bg: string; border: string } => {
    switch (alertType) {
      case 'over_voltage':
      case 'over_power':
      case 'sensor_failure':
      case 'device_offline':
        return { label: 'CRITICAL', color: 'var(--color-danger)', bg: 'var(--color-danger-bg)', border: 'var(--color-danger-border)' };
      case 'under_voltage':
      case 'comm_failure':
        return { label: 'WARNING', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', border: 'var(--color-warning-border)' };
      case 'recovery':
        return { label: 'RESOLVED', color: 'var(--color-success)', bg: 'var(--color-success-bg)', border: 'var(--color-success-border)' };
      default:
        return { label: 'INFO', color: 'var(--color-info)', bg: 'var(--color-info-bg)', border: 'var(--color-info-border)' };
    }
  };

  // Helper for Icon
  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'over_voltage':
        return <Zap size={18} color="var(--color-danger)" />;
      case 'under_voltage':
        return <AlertTriangle size={18} color="var(--color-warning)" />;
      case 'over_power':
        return <Activity size={18} color="var(--color-danger)" />;
      case 'comm_failure':
        return <Server size={18} color="var(--color-warning)" />;
      case 'device_offline':
        return <Power size={18} color="var(--color-danger)" />;
      case 'recovery':
        return <CheckCircle2 size={18} color="var(--color-success)" />;
      default:
        return <AlertCircle size={18} color="var(--color-info)" />;
    }
  };

  const formatTimestamp = (dateString: string) => {
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

  // Filtered and searched alerts list
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Status filter
      if (statusFilter === 'active' && alert.acknowledged) return false;
      if (statusFilter === 'acknowledged' && !alert.acknowledged) return false;

      // Type filter
      if (typeFilter !== 'all' && alert.alert_type !== typeFilter) return false;

      // Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const msg = (alert.message || '').toLowerCase();
        const typeLabel = (ALERT_TYPES[alert.alert_type]?.label || alert.alert_type).toLowerCase();
        const id = (alert.device_id || '').toLowerCase();
        return msg.includes(query) || typeLabel.includes(query) || id.includes(query);
      }

      return true;
    });
  }, [alerts, statusFilter, typeFilter, searchQuery]);

  // Statistics
  const activeAlerts = useMemo(() => alerts.filter((a) => !a.acknowledged), [alerts]);
  const criticalCount = useMemo(
    () => activeAlerts.filter((a) => a.alert_type === 'over_voltage' || a.alert_type === 'over_power' || a.alert_type === 'sensor_failure').length,
    [activeAlerts]
  );
  const warningCount = useMemo(
    () => activeAlerts.filter((a) => a.alert_type === 'under_voltage' || a.alert_type === 'comm_failure').length,
    [activeAlerts]
  );

  return (
    <DashboardLayout>
      {/* Top Bar: Title & Bulk Actions */}
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
            <ShieldAlert size={22} color="var(--color-danger)" />
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Alerts & Fault Protection Log
            </h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Real-time threshold violation logs, contactor trip events, and hardware incident audit for{' '}
            <strong className="font-mono" style={{ color: 'var(--color-accent)' }}>
              {selectedDeviceId === 'all' ? 'All Fleet Devices' : selectedDeviceId}
            </strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleRunTestAlert}
            disabled={isTesting || testCooldown > 0}
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem' }}
            title={
              testCooldown > 0
                ? `Please wait ${testCooldown}s before sending another test email.`
                : 'Simulate an electrical fault to test Gmail SMTP email delivery safely without high voltage'
            }
          >
            {isTesting ? (
              <RefreshCw size={15} className="spin" />
            ) : (
              <Send size={15} />
            )}
            <span>
              {isTesting
                ? 'Sending Test...'
                : testCooldown > 0
                ? `Wait ${testCooldown}s`
                : 'Test Email Alert'}
            </span>
          </button>

          {unacknowledgedCount > 0 && (
            <button
              onClick={() => acknowledgeAll()}
              className="btn btn-primary"
              style={{ fontSize: '0.8125rem' }}
            >
              <CheckCheck size={16} />
              <span>Acknowledge All ({unacknowledgedCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Test Alert Feedback Banner */}
      {testFeedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: testFeedback.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            border: `1px solid ${testFeedback.type === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
            color: testFeedback.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {testFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{testFeedback.message}</span>
          </div>
          <button
            onClick={() => setTestFeedback(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.75rem',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Total Active */}
        <div className="card-modern">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Active Faults
            </span>
            <ShieldAlert size={16} color={unacknowledgedCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'} />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: unacknowledgedCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
            {unacknowledgedCount}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {unacknowledgedCount === 0 ? 'All incidents acknowledged' : 'Requires operator attention'}
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="card-modern">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Critical Protection Trips
            </span>
            <Zap size={16} color="var(--color-danger)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: criticalCount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
            {criticalCount}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Over Voltage / Over Power trips
          </div>
        </div>

        {/* Warnings */}
        <div className="card-modern">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Operating Warnings
            </span>
            <AlertTriangle size={16} color="var(--color-warning)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: warningCount > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
            {warningCount}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Under Voltage & Comm failures
          </div>
        </div>

        {/* Total Historical */}
        <div className="card-modern">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Logged Incidents
            </span>
            <Clock size={16} color="var(--color-info)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {alerts.length}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Last 50 events in telemetry buffer
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card-modern"
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 12px',
            flex: '1 1 240px',
            maxWidth: '360px',
          }}
        >
          <Search size={16} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search message, event type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              color: 'var(--color-text-primary)',
              width: '100%',
              outline: 'none',
              fontSize: '0.8125rem',
            }}
          />
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '3px',
              gap: '2px',
            }}
          >
            {(['all', 'active', 'acknowledged'] as StatusFilter[]).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: statusFilter === st ? 700 : 500,
                  backgroundColor: statusFilter === st ? 'var(--color-bg-card-hover)' : 'transparent',
                  color: statusFilter === st ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {st === 'all' ? 'All Status' : st === 'active' ? 'Active' : 'Acknowledged'}
              </button>
            ))}
          </div>

          {/* Type Filter dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
            }}
          >
            <Filter size={14} color="var(--color-text-muted)" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-primary)',
                fontSize: '0.75rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>All Fault Types</option>
              <option value="over_voltage" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>Over Voltage</option>
              <option value="under_voltage" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>Under Voltage</option>
              <option value="over_power" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>Over Power</option>
              <option value="comm_failure" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>Comm Failure</option>
              <option value="sensor_failure" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>Sensor Failure</option>
              <option value="device_offline" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>Device Offline</option>
              <option value="recovery" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>System Restored</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="card-modern" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredAlerts.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <CheckCircle2 size={44} color="var(--color-success)" style={{ marginBottom: '12px', opacity: 0.8 }} />
            <h3 style={{ margin: '0 0 4px', color: 'var(--color-text-primary)', fontSize: '0.9375rem', fontWeight: 600 }}>
              No Incidents Match Selected Filter
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
              System is operating within configured safety thresholds.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderBottom: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Incident Type</th>
                  <th style={{ padding: '12px 16px' }}>Measured</th>
                  <th style={{ padding: '12px 16px' }}>Threshold</th>
                  <th style={{ padding: '12px 16px' }}>Description / Root Cause</th>
                  <th style={{ padding: '12px 16px' }}>Relay Contactor</th>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px' }}>Email Delivery</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert) => {
                  const severity = getSeverity(alert.alert_type);

                  return (
                    <tr
                      key={alert.id}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        backgroundColor: alert.acknowledged ? 'transparent' : 'hsla(0, 78%, 56%, 0.04)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Incident Type */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flexShrink: 0 }}>{getAlertIcon(alert.alert_type)}</div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                              {ALERT_TYPES[alert.alert_type]?.label || alert.alert_type}
                            </div>
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                color: severity.color,
                              }}
                            >
                              {severity.label}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Measured Value */}
                      <td className="font-mono" style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {formatAlertValue(alert.alert_type, alert.value)}
                      </td>

                      {/* Configured Threshold */}
                      <td className="font-mono" style={{ padding: '12px 16px', color: 'var(--color-accent)', fontWeight: 600 }}>
                        {getThresholdForAlert(alert.alert_type)}
                      </td>

                      {/* Description */}
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', maxWidth: '280px' }}>
                        {alert.message}
                      </td>

                      {/* Relay Contactor */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          className="font-mono"
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            backgroundColor: alert.relay_status === 'off' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                            color: alert.relay_status === 'off' ? 'var(--color-danger)' : 'var(--color-success)',
                            border: `1px solid ${alert.relay_status === 'off' ? 'var(--color-danger-border)' : 'var(--color-success-border)'}`,
                          }}
                        >
                          {alert.relay_status ? alert.relay_status.toUpperCase() : 'OFF'}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="font-mono" style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {formatTimestamp(alert.timestamp)}
                      </td>

                      {/* Email Delivery Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          title={alert.delivery_error ? `Email: ${alert.email_status || 'pending'} (${alert.delivery_error})` : `Email: ${alert.email_status || 'pending'}`}
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor:
                              alert.email_status === 'sent'
                                ? 'var(--color-success-bg)'
                                : alert.email_status === 'failed'
                                ? 'var(--color-danger-bg)'
                                : alert.email_status === 'skipped'
                                ? 'var(--color-warning-bg)'
                                : 'var(--color-bg-secondary)',
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
                          <Mail size={13} />
                          {alert.email_status || 'pending'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          className={`badge ${alert.acknowledged ? 'badge-success' : 'badge-danger'}`}
                          style={{ fontSize: '0.6875rem' }}
                        >
                          <span className="badge-dot" />
                          {alert.acknowledged ? 'Resolved' : 'Active'}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {!alert.acknowledged ? (
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="btn btn-secondary"
                            style={{
                              padding: '3px 10px',
                              fontSize: '0.75rem',
                              height: '26px',
                            }}
                          >
                            Acknowledge
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
