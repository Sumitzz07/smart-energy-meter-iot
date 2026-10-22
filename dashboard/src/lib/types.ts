// ============================================================
// types.ts — TypeScript types mirroring the Supabase schema
// ============================================================
// These types are the single source of truth for all dashboard
// components, hooks, and API interactions. They mirror the
// database schema defined in 001_schema.sql.
// ============================================================

export interface EnergyReading {
  id: string;
  device_id: string;
  timestamp: string;
  voltage: number;
  current_amps: number;
  power: number;
  energy_kwh: number;
  frequency: number;
  power_factor: number;
  cost: number;
  protection_status: 'normal' | 'over_voltage' | 'under_voltage' | 'over_power' | 'sensor_failure';
}

export interface MeterSettings {
  device_id: string;
  over_voltage: number;
  under_voltage: number;
  power_limit: number;
  cost_per_kwh: number;
  updated_at: string;
}

export interface DeviceStatus {
  device_id: string;
  connection_type: 'wifi' | 'hardware' | 'gsm' | 'offline' | 'simulation';
  wifi_status: boolean;
  gsm_status: boolean;
  pzem_status: boolean;
  relay1_status: boolean;
  relay2_status: boolean;
  last_seen: string;
}

export interface Alert {
  id: string;
  device_id: string;
  timestamp: string;
  alert_type: 'over_voltage' | 'under_voltage' | 'over_power' | 'comm_failure' | 'sensor_failure';
  value: number;
  message: string;
  relay_status: 'on' | 'off';
  acknowledged: boolean;
}

export interface DailyEnergySummary {
  device_id: string;
  summary_date: string;
  avg_voltage: number;
  max_voltage: number;
  min_voltage: number;
  max_current: number;
  avg_power_watts: number;
  energy_consumed_kwh: number;
  daily_cost: number;
  reading_count: number;
}

export interface MonthlyEnergySummary {
  device_id: string;
  summary_month: string;
  avg_voltage: number;
  max_voltage: number;
  min_voltage: number;
  max_current: number;
  avg_power_watts: number;
  energy_consumed_kwh: number;
  monthly_cost: number;
  reading_count: number;
}

// Chart data point for realtime graph buffering
export interface ChartDataPoint {
  time: string;       // HH:MM:SS for x-axis label
  timestamp: number;  // epoch ms for sorting
  voltage: number;
  current_amps: number;
  power: number;
}
