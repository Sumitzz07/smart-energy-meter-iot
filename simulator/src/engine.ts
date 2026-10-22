// ============================================================
// engine.ts — Realistic PZEM-004T reading generator
// ============================================================
// Generates physically plausible AC mains readings with natural
// noise, drift, and correlated values (power = V * I * PF).
// ============================================================

export interface SimulatedReading {
  device_id: string;
  timestamp: string; // ISO 8601 UTC
  voltage: number;
  current_amps: number;
  power: number;
  energy_kwh: number;
  frequency: number;
  power_factor: number;
  cost: number;
  protection_status: string;
}

export interface SimulatorState {
  cumulativeEnergyKwh: number;
  cumulativeCost: number;
  tickCount: number;
  lastVoltage: number;
  lastCurrent: number;
}

export interface EngineConfig {
  deviceId: string;
  baseVoltage: number;      // Nominal voltage (e.g. 230)
  baseCurrent: number;      // Nominal load current (e.g. 2.0)
  baseFrequency: number;    // Nominal frequency (e.g. 50.0)
  basePowerFactor: number;  // Nominal PF (e.g. 0.95)
  overVoltage: number;      // Over-voltage threshold (V)
  underVoltage: number;     // Under-voltage threshold (V)
  powerLimit: number;       // Power limit threshold (W)
  costPerKwh: number;       // INR per kWh
  intervalMs: number;       // Milliseconds between readings
}

const DEFAULT_CONFIG: EngineConfig = {
  deviceId: 'esp32-meter-001',
  baseVoltage: 230.0,
  baseCurrent: 2.0,
  baseFrequency: 50.0,
  basePowerFactor: 0.95,
  overVoltage: 260.0,
  underVoltage: 180.0,
  powerLimit: 2000.0,
  costPerKwh: 6.0,
  intervalMs: 5000,
};

/**
 * Adds Gaussian noise to a value.
 * Uses Box-Muller transform for normally distributed randomness.
 */
function gaussianNoise(stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return stddev * Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Clamps a number between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Rounds a number to a fixed number of decimal places.
 */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export class SimulationEngine {
  private config: EngineConfig;
  private state: SimulatorState;

  // Override targets for scenario injection
  private voltageOverride: number | null = null;
  private currentOverride: number | null = null;
  private powerFactorOverride: number | null = null;

  constructor(config?: Partial<EngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      cumulativeEnergyKwh: 0,
      cumulativeCost: 0,
      tickCount: 0,
      lastVoltage: this.config.baseVoltage,
      lastCurrent: this.config.baseCurrent,
    };
  }

  /**
   * Inject voltage/current/PF overrides for scenario testing.
   * Pass null to clear an override and return to normal behavior.
   */
  setOverrides(overrides: {
    voltage?: number | null;
    current?: number | null;
    powerFactor?: number | null;
  }): void {
    if (overrides.voltage !== undefined) this.voltageOverride = overrides.voltage;
    if (overrides.current !== undefined) this.currentOverride = overrides.current;
    if (overrides.powerFactor !== undefined) this.powerFactorOverride = overrides.powerFactor;
  }

  /**
   * Clear all overrides — return to normal simulation.
   */
  clearOverrides(): void {
    this.voltageOverride = null;
    this.currentOverride = null;
    this.powerFactorOverride = null;
  }

  /**
   * Generate a single simulated reading.
   * Values are physically correlated: Power = V * I * PF.
   * Energy accumulates over time.
   */
  generateReading(): SimulatedReading {
    const tick = this.state.tickCount++;
    const intervalHours = this.config.intervalMs / 3_600_000;

    // --- Voltage ---
    // Slow sinusoidal drift (simulates grid fluctuation over minutes)
    // plus fast Gaussian noise (simulates measurement jitter)
    const voltageDrift = 4 * Math.sin(tick * 0.05) + 2 * Math.sin(tick * 0.17);
    const voltageTarget = this.voltageOverride ?? (this.config.baseVoltage + voltageDrift);
    // Smooth transition: 80% toward target, 20% inertia from last reading
    const voltage = round(
      clamp(0.8 * voltageTarget + 0.2 * this.state.lastVoltage + gaussianNoise(0.8), 0, 300),
      1
    );
    this.state.lastVoltage = voltage;

    // --- Current ---
    // Simulates load switching: occasional step changes + noise
    const loadSwitchNoise = (Math.random() < 0.03) ? (Math.random() * 2 - 1) : 0;
    const currentTarget = this.currentOverride ?? (this.config.baseCurrent + loadSwitchNoise);
    const currentAmps = round(
      clamp(0.85 * currentTarget + 0.15 * this.state.lastCurrent + gaussianNoise(0.05), 0, 100),
      3
    );
    this.state.lastCurrent = currentAmps;

    // --- Power Factor ---
    const powerFactor = round(
      clamp(
        (this.powerFactorOverride ?? this.config.basePowerFactor) + gaussianNoise(0.01),
        0,
        1
      ),
      2
    );

    // --- Power (derived) ---
    const power = round(voltage * currentAmps * powerFactor, 1);

    // --- Energy (cumulative) ---
    const energyIncrement = (power / 1000) * intervalHours;
    this.state.cumulativeEnergyKwh = round(this.state.cumulativeEnergyKwh + energyIncrement, 4);

    // --- Cost (cumulative) ---
    this.state.cumulativeCost = round(
      this.state.cumulativeEnergyKwh * this.config.costPerKwh,
      2
    );

    // --- Frequency ---
    const frequency = round(
      clamp(this.config.baseFrequency + gaussianNoise(0.1), 45, 55),
      1
    );

    // --- Protection Status ---
    const protectionStatus = this.evaluateProtection(voltage, power);

    return {
      device_id: this.config.deviceId,
      timestamp: new Date().toISOString(),
      voltage,
      current_amps: currentAmps,
      power,
      energy_kwh: this.state.cumulativeEnergyKwh,
      frequency,
      power_factor: powerFactor,
      cost: this.state.cumulativeCost,
      protection_status: protectionStatus,
    };
  }

  /**
   * Dynamically update protection thresholds and tariff rate (from Supabase meter_settings).
   */
  updateThresholds(thresholds: {
    overVoltage?: number;
    underVoltage?: number;
    powerLimit?: number;
    costPerKwh?: number;
  }): void {
    if (thresholds.overVoltage !== undefined && !isNaN(thresholds.overVoltage) && thresholds.overVoltage > 0) {
      this.config.overVoltage = thresholds.overVoltage;
    }
    if (thresholds.underVoltage !== undefined && !isNaN(thresholds.underVoltage) && thresholds.underVoltage > 0) {
      this.config.underVoltage = thresholds.underVoltage;
    }
    if (thresholds.powerLimit !== undefined && !isNaN(thresholds.powerLimit) && thresholds.powerLimit > 0) {
      this.config.powerLimit = thresholds.powerLimit;
    }
    if (thresholds.costPerKwh !== undefined && !isNaN(thresholds.costPerKwh) && thresholds.costPerKwh > 0) {
      this.config.costPerKwh = thresholds.costPerKwh;
    }
  }

  /**
   * Evaluate protection status based on thresholds loaded from meter_settings.
   */
  private evaluateProtection(voltage: number, power: number): string {
    if (voltage > this.config.overVoltage) return 'over_voltage';
    if (voltage < this.config.underVoltage) return 'under_voltage';
    if (power > this.config.powerLimit) return 'over_power';
    return 'normal';
  }

  /**
   * Get the current active configuration (including thresholds and tariff).
   */
  getConfig(): EngineConfig {
    return { ...this.config };
  }

  /**
   * Get the current cumulative state (for logging/debugging).
   */
  getState(): SimulatorState {
    return { ...this.state };
  }

  /**
   * Reset the engine state.
   */
  reset(): void {
    this.state = {
      cumulativeEnergyKwh: 0,
      cumulativeCost: 0,
      tickCount: 0,
      lastVoltage: this.config.baseVoltage,
      lastCurrent: this.config.baseCurrent,
    };
    this.clearOverrides();
  }
}
