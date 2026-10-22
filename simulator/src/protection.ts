// ============================================================
// protection.ts — Fault State Machine & Protection Manager
// ============================================================
// Manages independent fault states:
//   - Over Voltage  (voltage > over_voltage_threshold)
//   - Under Voltage (voltage < under_voltage_threshold)
//   - Over Power    (power > power_limit)
//
// State transitions:
//   SAFE  -> FAULT: Emits a new AlertPayload, trips relay to OFF
//   FAULT -> FAULT: Suppresses duplicate alert generation
//   FAULT -> SAFE:  Resets fault state, restores relay to ON when clear
// ============================================================

import { AlertPayload } from './supabase-writer';

export interface ProtectionState {
  overVoltageActive: boolean;
  underVoltageActive: boolean;
  overPowerActive: boolean;
}

export interface Thresholds {
  overVoltage: number;
  underVoltage: number;
  powerLimit: number;
}

export interface EvaluationResult {
  alertsToEmit: AlertPayload[];
  protectionStatus: 'normal' | 'over_voltage' | 'under_voltage' | 'over_power';
  relayOn: boolean;
  recoveredFaults: string[];
}

export class FaultProtectionManager {
  private state: ProtectionState = {
    overVoltageActive: false,
    underVoltageActive: false,
    overPowerActive: false,
  };

  /**
   * Evaluates the current sensor reading against the active thresholds.
   * Emits alerts ONLY on state transitions (SAFE -> FAULT) to prevent spam.
   */
  evaluate(
    reading: { voltage: number; power: number; timestamp: string },
    thresholds: Thresholds,
    deviceId: string
  ): EvaluationResult {
    const alertsToEmit: AlertPayload[] = [];
    const recoveredFaults: string[] = [];

    const isOverVoltage = reading.voltage > thresholds.overVoltage;
    const isUnderVoltage = reading.voltage < thresholds.underVoltage;
    const isOverPower = reading.power > thresholds.powerLimit;

    // 1. Over-Voltage State Transition
    if (isOverVoltage) {
      if (!this.state.overVoltageActive) {
        this.state.overVoltageActive = true;
        alertsToEmit.push({
          device_id: deviceId,
          timestamp: reading.timestamp,
          alert_type: 'over_voltage',
          value: reading.voltage,
          message: `Over-voltage detected: ${reading.voltage.toFixed(1)}V exceeds threshold (${thresholds.overVoltage}V)`,
          relay_status: 'off',
        });
      }
    } else {
      if (this.state.overVoltageActive) {
        this.state.overVoltageActive = false;
        recoveredFaults.push('over_voltage');
      }
    }

    // 2. Under-Voltage State Transition
    if (isUnderVoltage) {
      if (!this.state.underVoltageActive) {
        this.state.underVoltageActive = true;
        alertsToEmit.push({
          device_id: deviceId,
          timestamp: reading.timestamp,
          alert_type: 'under_voltage',
          value: reading.voltage,
          message: `Under-voltage detected: ${reading.voltage.toFixed(1)}V below threshold (${thresholds.underVoltage}V)`,
          relay_status: 'off',
        });
      }
    } else {
      if (this.state.underVoltageActive) {
        this.state.underVoltageActive = false;
        recoveredFaults.push('under_voltage');
      }
    }

    // 3. Over-Power State Transition
    if (isOverPower) {
      if (!this.state.overPowerActive) {
        this.state.overPowerActive = true;
        alertsToEmit.push({
          device_id: deviceId,
          timestamp: reading.timestamp,
          alert_type: 'over_power',
          value: reading.power,
          message: `Power limit exceeded: ${reading.power.toFixed(1)}W exceeds threshold (${thresholds.powerLimit}W)`,
          relay_status: 'off',
        });
      }
    } else {
      if (this.state.overPowerActive) {
        this.state.overPowerActive = false;
        recoveredFaults.push('over_power');
      }
    }

    const anyFaultActive =
      this.state.overVoltageActive ||
      this.state.underVoltageActive ||
      this.state.overPowerActive;

    const relayOn = !anyFaultActive;

    let protectionStatus: 'normal' | 'over_voltage' | 'under_voltage' | 'over_power' = 'normal';
    if (this.state.overVoltageActive) {
      protectionStatus = 'over_voltage';
    } else if (this.state.underVoltageActive) {
      protectionStatus = 'under_voltage';
    } else if (this.state.overPowerActive) {
      protectionStatus = 'over_power';
    }

    return {
      alertsToEmit,
      protectionStatus,
      relayOn,
      recoveredFaults,
    };
  }

  /**
   * Reset all fault states.
   */
  reset(): void {
    this.state = {
      overVoltageActive: false,
      underVoltageActive: false,
      overPowerActive: false,
    };
  }

  getState(): ProtectionState {
    return { ...this.state };
  }
}
