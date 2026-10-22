'use client';

import React, { useState } from 'react';
import { Terminal, Copy, Check, Activity, Server } from 'lucide-react';

interface SimulatorPanelProps {
  connectionType?: string;
}

export default function SimulatorPanel({ connectionType = 'simulation' }: SimulatorPanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const commands = [
    { label: 'Normal Operation', cmd: 'npm run dev' },
    { label: 'Trigger Over-voltage', cmd: 'npm run sim:overvoltage' },
    { label: 'Trigger Under-voltage', cmd: 'npm run sim:undervoltage' },
    { label: 'Trigger Over-power', cmd: 'npm run sim:overpower' },
    { label: 'Trigger Comm Fault', cmd: 'npm run sim:fault' },
  ];

  const handleCopy = (cmd: string, index: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: '12px',
    padding: '24px',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const isSim = connectionType === 'simulation';

  const modeBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    backgroundColor: isSim ? 'rgba(20, 184, 166, 0.15)' : 'rgba(34, 197, 94, 0.15)',
    color: isSim ? 'var(--color-accent)' : 'var(--color-success)',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
  };

  const infoStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    marginBottom: '20px',
    lineHeight: 1.5,
  };

  const commandListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const commandItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    padding: '12px 16px',
  };

  const cmdLabelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    display: 'block',
    marginBottom: '4px',
  };

  const codeStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: 'var(--color-accent)',
  };

  const copyButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>
          <Terminal size={20} />
          Simulator Controls
        </h2>
        <span style={modeBadgeStyle}>
          <Activity size={14} />
          {connectionType} mode
        </span>
      </div>

      <p style={infoStyle}>
        The standalone simulation engine simulates live PZEM-004T readings and fault scenarios directly to Supabase. Run these commands from the <code style={{ color: 'var(--color-accent)' }}>simulator/</code> directory:
      </p>

      <div style={commandListStyle}>
        {commands.map((item, index) => (
          <div key={item.cmd} style={commandItemStyle}>
            <div>
              <span style={cmdLabelStyle}>{item.label}</span>
              <code style={codeStyle}>{item.cmd}</code>
            </div>
            <button
              onClick={() => handleCopy(item.cmd, index)}
              style={copyButtonStyle}
              title="Copy to clipboard"
            >
              {copiedIndex === index ? (
                <Check size={18} color="var(--color-success)" />
              ) : (
                <Copy size={18} />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
