'use client';

import React, { useState, useEffect } from 'react';
import { MeterSettings } from '@/lib/types';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SettingsFormProps {
  settings: MeterSettings | null;
  onSave: (settings: Partial<MeterSettings>) => Promise<{ error: Error | null } | void> | void;
  isSaving: boolean;
}

export default function SettingsForm({ settings, onSave, isSaving }: SettingsFormProps) {
  const [formData, setFormData] = useState({
    over_voltage: 260,
    under_voltage: 180,
    power_limit: 2000,
    cost_per_kwh: 6.0
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        over_voltage: settings.over_voltage || 260,
        under_voltage: settings.under_voltage || 180,
        power_limit: settings.power_limit || 2000,
        cost_per_kwh: settings.cost_per_kwh || 6.0
      });
    }
  }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const validate = () => {
    if (formData.over_voltage <= 0 || formData.under_voltage <= 0 || formData.power_limit <= 0 || formData.cost_per_kwh <= 0) {
      return "All values must be positive numbers greater than 0.";
    }
    if (formData.over_voltage <= formData.under_voltage) {
      return `Over-voltage limit (${formData.over_voltage}V) must be greater than under-voltage limit (${formData.under_voltage}V).`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }
    setError(null);
    setSuccess(null);

    const result = await onSave(formData);
    if (result && result.error) {
      setError(`Failed to save settings: ${result.error.message}`);
    } else {
      setSuccess('Settings saved to database and synchronized live!');
      setTimeout(() => setSuccess(null), 4000);
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
  };

  const titleStyle: React.CSSProperties = {
    margin: '0 0 16px',
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '16px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  };

  const inputWrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--color-bg-primary)',
    overflow: 'hidden',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px 14px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary)',
    fontSize: '1rem',
    outline: 'none',
  };

  const unitStyle: React.CSSProperties = {
    padding: '10px 16px',
    backgroundColor: 'var(--color-bg-secondary)',
    borderLeft: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
    fontWeight: 500,
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: 'var(--color-accent)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: isSaving ? 'not-allowed' : 'pointer',
    opacity: isSaving ? 0.7 : 1,
    width: '100%',
    transition: 'background-color 0.2s',
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>Threshold Protection Settings</h2>
        
        <div style={formGroupStyle}>
          <label style={labelStyle}>Over Voltage Threshold</label>
          <div style={inputWrapperStyle}>
            <input
              type="number"
              name="over_voltage"
              value={formData.over_voltage}
              onChange={handleChange}
              step="1"
              style={inputStyle}
            />
            <span style={unitStyle}>V</span>
          </div>
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Under Voltage Threshold</label>
          <div style={inputWrapperStyle}>
            <input
              type="number"
              name="under_voltage"
              value={formData.under_voltage}
              onChange={handleChange}
              step="1"
              style={inputStyle}
            />
            <span style={unitStyle}>V</span>
          </div>
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Power Limit (Over-Power)</label>
          <div style={inputWrapperStyle}>
            <input
              type="number"
              name="power_limit"
              value={formData.power_limit}
              onChange={handleChange}
              step="10"
              style={inputStyle}
            />
            <span style={unitStyle}>W</span>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>Tariff Rate</h2>
        
        <div style={formGroupStyle}>
          <label style={labelStyle}>Cost per kWh (Tariff)</label>
          <div style={inputWrapperStyle}>
            <span style={{...unitStyle, borderLeft: 'none', borderRight: '1px solid var(--color-border)'}}>₹</span>
            <input
              type="number"
              name="cost_per_kwh"
              value={formData.cost_per_kwh}
              onChange={handleChange}
              step="0.1"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--color-danger)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--color-danger)',
          fontSize: '0.875rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid var(--color-success)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--color-success)',
          fontSize: '0.875rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      <button type="submit" disabled={isSaving} style={buttonStyle}>
        <Save size={18} />
        {isSaving ? 'Saving Settings...' : 'Save Settings'}
      </button>
    </form>
  );
}
