// ============================================================
// scenarios.ts — Predefined abnormal condition presets
// ============================================================
// Each scenario applies overrides to the SimulationEngine to
// produce specific fault conditions that trigger protection logic.
// ============================================================

import { SimulationEngine } from './engine';

export type ScenarioName =
  | 'normal'
  | 'over_voltage'
  | 'under_voltage'
  | 'over_power'
  | 'comm_failure';

export interface ScenarioDefinition {
  name: ScenarioName;
  description: string;
  apply: (engine: SimulationEngine) => void;
}

/**
 * All available simulation scenarios.
 *
 * 'comm_failure' does not modify readings — instead, the index.ts
 * entry point stops sending data for a configurable period to
 * simulate a communication dropout.
 */
export const SCENARIOS: Record<ScenarioName, ScenarioDefinition> = {

  normal: {
    name: 'normal',
    description: 'Normal operating conditions: ~230V, ~2A, PF ~0.95',
    apply: (engine) => {
      engine.clearOverrides();
    },
  },

  over_voltage: {
    name: 'over_voltage',
    description: 'Over-voltage condition: voltage ramps to ~270V, exceeding the 260V threshold',
    apply: (engine) => {
      engine.setOverrides({
        voltage: 270 + Math.random() * 5, // 270–275V
        current: null,
        powerFactor: null,
      });
    },
  },

  under_voltage: {
    name: 'under_voltage',
    description: 'Under-voltage condition: voltage drops to ~165V, below the 180V threshold',
    apply: (engine) => {
      engine.setOverrides({
        voltage: 165 + Math.random() * 10, // 165–175V
        current: null,
        powerFactor: null,
      });
    },
  },

  over_power: {
    name: 'over_power',
    description: 'Over-power condition: high current draws power above 2000W limit',
    apply: (engine) => {
      // At ~230V and PF ~0.95, we need ~9.2A to hit 2000W.
      // Set current to ~10A to clearly exceed the limit.
      engine.setOverrides({
        voltage: null,
        current: 10 + Math.random() * 2, // 10–12A
        powerFactor: null,
      });
    },
  },

  comm_failure: {
    name: 'comm_failure',
    description: 'Communication failure: readings are generated but NOT sent to Supabase for 30+ seconds',
    apply: (engine) => {
      // No override on the engine — comm_failure is handled in the
      // main loop by skipping Supabase writes.
      engine.clearOverrides();
    },
  },
};

/**
 * Lookup a scenario by name. Returns 'normal' if not found.
 */
export function getScenario(name: string): ScenarioDefinition {
  if (name in SCENARIOS) {
    return SCENARIOS[name as ScenarioName];
  }
  console.warn(`Unknown scenario "${name}", falling back to "normal"`);
  return SCENARIOS.normal;
}
