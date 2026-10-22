'use client';

import React from 'react';
import { ChartDataPoint } from '@/lib/types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Zap, Activity, Gauge } from 'lucide-react';

interface RealtimeChartsProps {
  chartBuffer: ChartDataPoint[];
}

export default function RealtimeCharts({ chartBuffer }: RealtimeChartsProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: 'hsl(222, 22%, 11%)',
            border: '1px solid var(--color-border)',
            padding: '8px 12px',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <p style={{ margin: '0 0 4px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
            {label}
          </p>
          <p
            className="font-mono"
            style={{
              margin: 0,
              color: payload[0].color,
              fontWeight: 700,
              fontSize: '0.875rem',
            }}
          >
            {payload[0].name}: {Number(payload[0].value).toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px',
      }}
    >
      {/* Voltage Chart */}
      <div className="card-modern" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} color="var(--color-info)" />
            <h3
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: 0,
              }}
            >
              Voltage (V)
            </h3>
          </div>
          <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-info)' }}>
            {chartBuffer.length > 0 ? `${chartBuffer[chartBuffer.length - 1].voltage.toFixed(1)} V` : '--'}
          </span>
        </div>

        <div style={{ height: '180px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartBuffer} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="hsl(222, 16%, 18%)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} tickMargin={8} minTickGap={40} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="voltage"
                name="Voltage"
                stroke="hsl(210, 95%, 58%)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Current Chart */}
      <div className="card-modern" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} color="var(--color-accent)" />
            <h3
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: 0,
              }}
            >
              Current (A)
            </h3>
          </div>
          <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>
            {chartBuffer.length > 0 ? `${chartBuffer[chartBuffer.length - 1].current_amps.toFixed(3)} A` : '--'}
          </span>
        </div>

        <div style={{ height: '180px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartBuffer} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="hsl(222, 16%, 18%)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} tickMargin={8} minTickGap={40} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="current_amps"
                name="Current"
                stroke="hsl(175, 80%, 46%)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Power Chart */}
      <div className="card-modern" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gauge size={16} color="var(--color-warning)" />
            <h3
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: 0,
              }}
            >
              Active Power (W)
            </h3>
          </div>
          <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-warning)' }}>
            {chartBuffer.length > 0 ? `${chartBuffer[chartBuffer.length - 1].power.toFixed(1)} W` : '--'}
          </span>
        </div>

        <div style={{ height: '180px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartBuffer} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="hsl(222, 16%, 18%)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} tickMargin={8} minTickGap={40} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="power"
                name="Power"
                stroke="hsl(38, 92%, 50%)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
