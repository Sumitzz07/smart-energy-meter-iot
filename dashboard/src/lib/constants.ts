// ============================================================
// constants.ts — Dashboard constants, labels, units, and colors
// ============================================================

export const DEVICE_ID = 'esp32-meter-001';

// Reading card definitions
export const READING_CARDS = [
  { key: 'voltage',      label: 'Voltage',      unit: 'V',    decimals: 1, icon: 'Zap'        },
  { key: 'current_amps', label: 'Current',      unit: 'A',    decimals: 3, icon: 'Activity'   },
  { key: 'power',        label: 'Power',        unit: 'W',    decimals: 1, icon: 'Gauge'      },
  { key: 'energy_kwh',   label: 'Energy',       unit: 'kWh',  decimals: 4, icon: 'Battery'    },
  { key: 'frequency',    label: 'Frequency',    unit: 'Hz',   decimals: 1, icon: 'Waves'      },
  { key: 'power_factor', label: 'Power Factor', unit: '',     decimals: 2, icon: 'TrendingUp' },
  { key: 'cost',         label: 'Total Cost',   unit: '₹',    decimals: 2, icon: 'IndianRupee'},
] as const;

// Protection status labels and colors
export const PROTECTION_STATUS: Record<string, { label: string; color: string }> = {
  normal:        { label: 'Normal',          color: 'var(--color-success)' },
  over_voltage:  { label: 'Over Voltage',    color: 'var(--color-danger)'  },
  under_voltage: { label: 'Under Voltage',   color: 'var(--color-warning)' },
  over_power:    { label: 'Over Power',      color: 'var(--color-danger)'  },
};

// Connection type labels
export const CONNECTION_TYPES: Record<string, { label: string; color: string }> = {
  wifi:       { label: 'Wi-Fi',       color: 'var(--color-success)' },
  hardware:   { label: 'Hardware',   color: 'var(--color-success)' },
  gsm:        { label: 'GSM',         color: 'var(--color-info)'    },
  offline:    { label: 'Offline',     color: 'var(--color-danger)'  },
  simulation: { label: 'Simulation',  color: 'var(--color-accent)'  },
};

// Alert type labels
export const ALERT_TYPES: Record<string, { label: string; color: string }> = {
  over_voltage:   { label: 'Over Voltage',    color: 'var(--color-danger)'  },
  under_voltage:  { label: 'Under Voltage',   color: 'var(--color-warning)' },
  over_power:     { label: 'Over Power',      color: 'var(--color-danger)'  },
  comm_failure:   { label: 'Comm Failure',    color: 'var(--color-warning)' },
  sensor_failure: { label: 'Sensor Failure',  color: 'var(--color-danger)'  },
};

// Chart buffer size (number of data points to keep in memory)
export const CHART_BUFFER_SIZE = 60; // 60 readings × 5s = 5 minutes

// Stale threshold: ESP32 uploads telemetry & heartbeats every 5-10s.
// Accounting for dual TLS uploads (telemetry + heartbeat taking 3-6s), periodic settings sync (30s),
// and network jitter, standard IoT practice declares offline after 3 missed heartbeat windows (~60s).
export const STALE_THRESHOLD_SECONDS = 60;

// Dashboard telemetry, device heartbeat, and online status refresh interval
export const DASHBOARD_POLL_INTERVAL_MS = 4000;
