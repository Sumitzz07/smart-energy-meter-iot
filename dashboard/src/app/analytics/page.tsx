'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Zap,
  Activity,
  Gauge,
  Battery,
  Waves,
  TrendingUp,
  IndianRupee,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertCircle,
  BarChart3,
  Download,
  FileText,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDevices } from '@/context/DeviceContext';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/lib/supabase-browser';
import type { EnergyReading } from '@/lib/types';

type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all';

interface ProcessedPoint {
  time: string;
  fullDate: string;
  timestamp: number;
  voltage: number;
  current_amps: number;
  power: number;
  energy_kwh: number;
  frequency: number;
  power_factor: number;
  cost: number;
}

export default function AnalyticsPage() {
  const { selectedDeviceId } = useDevices();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [readings, setReadings] = useState<EnergyReading[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportNotice, setExportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Custom date range state
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { settings } = useSettings(selectedDeviceId);
  const tariff = Number(settings?.cost_per_kwh) || 6.0;

  // Handle CSV and PDF export downloads
  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportNotice(null);
    if (format === 'csv') setIsExportingCsv(true);
    if (format === 'pdf') setIsExportingPdf(true);

    try {
      const isCustomActive = showCustomRange && customStartDate && customEndDate;
      const params = new URLSearchParams({
        format,
        device_id: selectedDeviceId,
        range: isCustomActive ? 'custom' : timeRange,
      });

      if (isCustomActive) {
        params.append('start', new Date(customStartDate).toISOString());
        params.append('end', new Date(customEndDate).toISOString());
      }

      const res = await fetch(`/api/telemetry/export?${params.toString()}`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to export ${format.toUpperCase()}`);
      }

      // Extract filename from response header or create fallback
      const disposition = res.headers.get('content-disposition');
      let filename = `energy_telemetry_${selectedDeviceId}_${timeRange}.${format}`;
      if (disposition && disposition.includes('filename=')) {
        const matches = disposition.match(/filename="?([^"]+)"?/);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setExportNotice({
        type: 'success',
        message: `Successfully exported ${filename} (${(blob.size / 1024).toFixed(1)} KB)`,
      });
      setTimeout(() => setExportNotice(null), 6000);
    } catch (err: any) {
      console.error(`Export ${format} error:`, err);
      setExportNotice({
        type: 'error',
        message: err.message || `An error occurred while generating ${format.toUpperCase()} export.`,
      });
    } finally {
      if (format === 'csv') setIsExportingCsv(false);
      if (format === 'pdf') setIsExportingPdf(false);
    }
  };

  // Fetch telemetry from Supabase energy_readings
  const fetchAnalyticsData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const now = new Date();
      let startTime: Date | null = null;
      let endTime: Date | null = null;

      if (showCustomRange && customStartDate && customEndDate) {
        startTime = new Date(customStartDate);
        endTime = new Date(customEndDate);
      } else if (timeRange === '1h') {
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
      } else if (timeRange === '24h') {
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (timeRange === '7d') {
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeRange === '30d') {
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      let query = supabase.from('energy_readings').select('*');
      if (selectedDeviceId !== 'all') {
        query = query.eq('device_id', selectedDeviceId);
      }

      if (startTime) {
        query = query.gte('timestamp', startTime.toISOString());
      }
      if (endTime) {
        query = query.lte('timestamp', endTime.toISOString());
      }

      // Order ascending to build accurate chronological graphs
      query = query.order('timestamp', { ascending: true }).limit(5000);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setReadings((data as EnergyReading[]) || []);
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Failed to fetch analytics data:', err);
      setErrorMsg(err.message || 'Could not load historical energy readings.');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, selectedDeviceId, showCustomRange, customStartDate, customEndDate]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Transform and downsample readings for smooth Recharts visualization
  const chartPoints = useMemo<ProcessedPoint[]>(() => {
    if (!readings || readings.length === 0) return [];

    const isMultiDay = timeRange === '7d' || timeRange === '30d' || timeRange === 'all';

    return readings.map((r) => {
      const date = new Date(r.timestamp);
      const timeStr = isMultiDay
        ? date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit' })
        : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      return {
        time: timeStr,
        fullDate: date.toLocaleString('en-IN'),
        timestamp: date.getTime(),
        voltage: Number(r.voltage) || 0,
        current_amps: Number(r.current_amps) || 0,
        power: Number(r.power) || 0,
        energy_kwh: Number(r.energy_kwh) || 0,
        frequency: Number(r.frequency) || 0,
        power_factor: Number(r.power_factor) || 0,
        cost: Number(r.cost) || 0,
      };
    });
  }, [readings, timeRange]);

  // Aggregate Calculations
  const stats = useMemo(() => {
    if (chartPoints.length === 0) {
      return {
        totalEnergy: 0,
        estimatedCost: 0,
        avgPower: 0,
        peakPower: 0,
        minPower: 0,
        avgVoltage: 0,
        maxVoltage: 0,
        minVoltage: 0,
        avgCurrent: 0,
        maxCurrent: 0,
        avgFrequency: 0,
        avgPowerFactor: 0,
        totalPoints: 0,
      };
    }

    const firstPoint = chartPoints[0];
    const lastPoint = chartPoints[chartPoints.length - 1];

    let totalEnergy = Math.max(0, lastPoint.energy_kwh - firstPoint.energy_kwh);
    if (totalEnergy === 0 && chartPoints.length > 0) {
      totalEnergy = lastPoint.energy_kwh;
    }

    const estimatedCost = totalEnergy * tariff;

    let sumPower = 0;
    let peakPower = 0;
    let minPower = Infinity;

    let sumVoltage = 0;
    let maxVoltage = 0;
    let minVoltage = Infinity;

    let sumCurrent = 0;
    let maxCurrent = 0;

    let sumFreq = 0;
    let sumPf = 0;

    chartPoints.forEach((p) => {
      sumPower += p.power;
      if (p.power > peakPower) peakPower = p.power;
      if (p.power < minPower) minPower = p.power;

      sumVoltage += p.voltage;
      if (p.voltage > maxVoltage) maxVoltage = p.voltage;
      if (p.voltage < minVoltage) minVoltage = p.voltage;

      sumCurrent += p.current_amps;
      if (p.current_amps > maxCurrent) maxCurrent = p.current_amps;

      sumFreq += p.frequency;
      sumPf += p.power_factor;
    });

    const count = chartPoints.length;

    return {
      totalEnergy,
      estimatedCost,
      avgPower: count > 0 ? sumPower / count : 0,
      peakPower: count > 0 ? peakPower : 0,
      minPower: count > 0 && minPower !== Infinity ? minPower : 0,
      avgVoltage: count > 0 ? sumVoltage / count : 0,
      maxVoltage: count > 0 ? maxVoltage : 0,
      minVoltage: count > 0 && minVoltage !== Infinity ? minVoltage : 0,
      avgCurrent: count > 0 ? sumCurrent / count : 0,
      maxCurrent: count > 0 ? maxCurrent : 0,
      avgFrequency: count > 0 ? sumFreq / count : 0,
      avgPowerFactor: count > 0 ? sumPf / count : 0,
      totalPoints: count,
    };
  }, [chartPoints, tariff]);

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: 'hsl(222, 22%, 11%)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    padding: '8px 12px',
    boxShadow: 'var(--shadow-md)',
    color: '#fff',
    fontSize: '0.8125rem',
  };

  return (
    <DashboardLayout>
      {/* Top Header & Range Filters */}
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
            <BarChart3 size={22} color="var(--color-accent)" />
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Telemetry Analytics & Energy Consumption
            </h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Historical power draw, grid quality, and cost analytics for{' '}
            <strong className="font-mono" style={{ color: 'var(--color-accent)' }}>
              {selectedDeviceId}
            </strong>
          </p>
        </div>

        {/* Action controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Time Range Pills */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '3px',
              gap: '2px',
            }}
          >
            {(['1h', '24h', '7d', '30d', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => {
                  setTimeRange(range);
                  setShowCustomRange(false);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: !showCustomRange && timeRange === range ? 700 : 500,
                  backgroundColor: !showCustomRange && timeRange === range ? 'var(--color-accent)' : 'transparent',
                  color: !showCustomRange && timeRange === range ? 'hsl(222, 24%, 8%)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {range.toUpperCase()}
              </button>
            ))}

            <button
              onClick={() => setShowCustomRange(!showCustomRange)}
              style={{
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: showCustomRange ? 700 : 500,
                backgroundColor: showCustomRange ? 'var(--color-accent)' : 'transparent',
                color: showCustomRange ? 'hsl(222, 24%, 8%)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all var(--transition-fast)',
              }}
              title="Filter by custom start and end date"
            >
              <Calendar size={12} />
              <span>CUSTOM</span>
            </button>
          </div>

          <button
            onClick={() => fetchAnalyticsData()}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-pulse' : undefined} />
            <span>Refresh</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={() => handleExport('csv')}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            disabled={isExportingCsv || isExportingPdf || isLoading}
            title="Download historical telemetry records as CSV"
          >
            <Download size={14} className={isExportingCsv ? 'animate-bounce' : undefined} />
            <span>{isExportingCsv ? 'Exporting CSV...' : 'Export CSV'}</span>
          </button>

          {/* Export PDF Button */}
          <button
            onClick={() => handleExport('pdf')}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            disabled={isExportingCsv || isExportingPdf || isLoading}
            title="Generate and download multi-page telemetry PDF report"
          >
            <FileText size={14} className={isExportingPdf ? 'animate-bounce' : undefined} />
            <span>{isExportingPdf ? 'Generating PDF...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Collapsible Bar */}
      {showCustomRange && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>From:</span>
            <input
              type="datetime-local"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="form-input"
              style={{
                backgroundColor: 'hsl(222, 22%, 11%)',
                border: '1px solid var(--color-border)',
                color: '#f8fafc',
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>To:</span>
            <input
              type="datetime-local"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="form-input"
              style={{
                backgroundColor: 'hsl(222, 22%, 11%)',
                border: '1px solid var(--color-border)',
                color: '#f8fafc',
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
            />
          </div>

          <button
            onClick={() => fetchAnalyticsData()}
            className="btn btn-primary"
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            disabled={!customStartDate || !customEndDate || isLoading}
          >
            Apply Range
          </button>

          <button
            onClick={() => {
              setShowCustomRange(false);
              setCustomStartDate('');
              setCustomEndDate('');
            }}
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
          >
            Reset
          </button>
        </div>
      )}

      {/* Export Feedback Notification */}
      {exportNotice && (
        <div
          style={{
            backgroundColor:
              exportNotice.type === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : 'var(--color-danger-bg)',
            border: `1px solid ${
              exportNotice.type === 'success'
                ? 'rgba(16, 185, 129, 0.4)'
                : 'var(--color-danger-border)'
            }`,
            color: exportNotice.type === 'success' ? '#34d399' : 'var(--color-danger)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.8125rem',
          }}
        >
          {exportNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{exportNotice.message}</span>
        </div>
      )}

      {/* Error state */}
      {errorMsg && (
        <div
          style={{
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Total Energy */}
        <div className="card-modern">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Energy Consumed
            </span>
            <Battery size={16} color="var(--color-success)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {stats.totalEnergy.toFixed(4)} <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>kWh</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Across selected {timeRange} window
          </div>
        </div>

        {/* Estimated Tariff Cost */}
        <div className="card-modern">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Estimated Tariff Cost
            </span>
            <IndianRupee size={16} color="var(--color-accent)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            ₹{stats.estimatedCost.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Rate: ₹{tariff.toFixed(2)} / kWh
          </div>
        </div>

        {/* Average Power */}
        <div className="card-modern">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Average Power
            </span>
            <Gauge size={16} color="var(--color-warning)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {stats.avgPower.toFixed(1)} <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>W</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Peak load: {stats.peakPower.toFixed(1)} W
          </div>
        </div>

        {/* Voltage Stability */}
        <div className="card-modern">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Average Voltage
            </span>
            <Zap size={16} color="var(--color-info)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {stats.avgVoltage.toFixed(1)} <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>V</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Range: {stats.minVoltage.toFixed(1)}V – {stats.maxVoltage.toFixed(1)}V
          </div>
        </div>

        {/* Power Factor & Frequency */}
        <div className="card-modern">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Grid Power Factor
            </span>
            <TrendingUp size={16} color="var(--color-success)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {stats.avgPowerFactor.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Frequency: {stats.avgFrequency.toFixed(1)} Hz
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      {chartPoints.length === 0 && !isLoading ? (
        <div
          className="card-modern"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            textAlign: 'center',
          }}
        >
          <Clock size={48} color="var(--color-text-muted)" style={{ marginBottom: '12px', opacity: 0.6 }} />
          <h3 style={{ margin: '0 0 6px', color: 'var(--color-text-primary)', fontSize: '1rem', fontWeight: 600 }}>
            No Data Points for Selected Range
          </h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
            Ensure the device is transmitting telemetry or select a broader time range.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Power Draw Trend (Area Chart) */}
          <div className="card-modern">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                  Active Power Consumption Trend (W)
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Continuous wattage profile across {stats.totalPoints} samples
                </span>
              </div>
              <span className="font-mono" style={{ fontSize: '0.8125rem', color: 'var(--color-warning)' }}>
                ● Power (W)
              </span>
            </div>
            <div style={{ height: '240px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 16%, 18%)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: any) => [`${Number(val).toFixed(1)} W`, 'Power']}
                  />
                  <Area
                    type="monotone"
                    dataKey="power"
                    stroke="hsl(38, 92%, 50%)"
                    strokeWidth={2}
                    fill="url(#powerGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Grid of Two Charts: Voltage Stability & Current Draw */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Voltage Stability Chart */}
            <div className="card-modern">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                    AC Voltage Profile (V)
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Avg: {stats.avgVoltage.toFixed(1)}V | Min: {stats.minVoltage.toFixed(1)}V | Max: {stats.maxVoltage.toFixed(1)}V
                  </span>
                </div>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-info)' }}>● Voltage (V)</span>
              </div>
              <div style={{ height: '200px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 16%, 18%)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: any) => [`${Number(val).toFixed(1)} V`, 'Voltage']}
                    />
                    <Line
                      type="monotone"
                      dataKey="voltage"
                      stroke="hsl(210, 95%, 58%)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Current Draw Chart */}
            <div className="card-modern">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                    Current Draw (A)
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Peak load: {stats.maxCurrent.toFixed(3)}A | Avg: {stats.avgCurrent.toFixed(3)}A
                  </span>
                </div>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>● Current (A)</span>
              </div>
              <div style={{ height: '200px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 16%, 18%)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: any) => [`${Number(val).toFixed(3)} A`, 'Current']}
                    />
                    <Line
                      type="monotone"
                      dataKey="current_amps"
                      stroke="hsl(175, 80%, 46%)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Grid of Two Charts: Frequency & Power Factor */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Frequency Chart */}
            <div className="card-modern">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                    AC Frequency (Hz)
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Target: 50.0 Hz (Grid nominal)
                  </span>
                </div>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'hsl(280, 70%, 60%)' }}>● Frequency (Hz)</span>
              </div>
              <div style={{ height: '180px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 16%, 18%)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: any) => [`${Number(val).toFixed(2)} Hz`, 'Frequency']}
                    />
                    <Line
                      type="monotone"
                      dataKey="frequency"
                      stroke="hsl(280, 70%, 60%)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Power Factor Chart */}
            <div className="card-modern">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                    Power Factor Trend
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Avg: {stats.avgPowerFactor.toFixed(2)} (Unity: 1.00)
                  </span>
                </div>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>● Power Factor</span>
              </div>
              <div style={{ height: '180px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 16%, 18%)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: any) => [`${Number(val).toFixed(2)}`, 'Power Factor']}
                    />
                    <Line
                      type="monotone"
                      dataKey="power_factor"
                      stroke="hsl(145, 68%, 45%)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
