// ============================================================
// index.ts — Simulator entry point
// ============================================================
// Usage:
//   npm run dev                      → normal simulation
//   npm run dev -- --mode over_voltage  → over-voltage scenario
//   npm run dev -- --iterations 20   → run 20 readings then stop
//   npm run dev -- --dry-run         → print readings, skip Supabase
//
// Environment variables (from .env):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { SimulationEngine, EngineConfig } from './engine';
import { getScenario, ScenarioName } from './scenarios';
import { SupabaseWriter, DeviceStatusPayload } from './supabase-writer';
import { FaultProtectionManager } from './protection';

// ---------- Load .env manually (no dotenv dependency) ----------
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv(): void {
  try {
    const envPath = resolve(__dirname, '..', '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Strip surrounding single/double quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1).trim();
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file not found — rely on already-set environment variables
  }
}

loadEnv();

// ---------- Parse CLI arguments ----------
interface CLIArgs {
  mode: ScenarioName;
  iterations: number; // 0 = infinite
  dryRun: boolean;
  intervalMs: number;
  deviceId: string;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const parsed: CLIArgs = {
    mode: 'normal',
    iterations: 0,
    dryRun: false,
    intervalMs: 5000,
    deviceId: 'esp32-meter-001',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode':
        parsed.mode = (args[++i] || 'normal') as ScenarioName;
        break;
      case '--iterations':
        parsed.iterations = parseInt(args[++i] || '0', 10);
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '--interval':
        parsed.intervalMs = parseInt(args[++i] || '5000', 10);
        break;
      case '--device':
        parsed.deviceId = args[++i] || 'esp32-meter-001';
        break;
    }
  }

  return parsed;
}

// ---------- Main loop ----------
async function main(): Promise<void> {
  const args = parseArgs();

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     Smart Energy Meter — Simulator              ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Device:     ${args.deviceId.padEnd(36)}║`);
  console.log(`║  Mode:       ${args.mode.padEnd(36)}║`);
  console.log(`║  Interval:   ${(args.intervalMs + 'ms').padEnd(36)}║`);
  console.log(`║  Iterations: ${(args.iterations === 0 ? '∞ (Ctrl+C to stop)' : String(args.iterations)).padEnd(36)}║`);
  console.log(`║  Dry Run:    ${String(args.dryRun).padEnd(36)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // Validate environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!args.dryRun && (!supabaseUrl || !supabaseKey)) {
    console.error('[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('        Copy .env.example to .env and fill in your credentials.');
    process.exit(1);
  }

  // Initialize engine and protection state machine
  const engineConfig: Partial<EngineConfig> = {
    deviceId: args.deviceId,
    intervalMs: args.intervalMs,
  };
  const engine = new SimulationEngine(engineConfig);
  const protectionManager = new FaultProtectionManager();

  // Apply scenario
  const scenario = getScenario(args.mode);
  console.log(`[Scenario] ${scenario.description}`);
  scenario.apply(engine);

  // Initialize Supabase writer
  let writer: SupabaseWriter | null = null;
  if (!args.dryRun) {
    writer = new SupabaseWriter(supabaseUrl!, supabaseKey!);

    // Fetch live settings from Supabase on startup
    const settings = await writer.fetchSettings(args.deviceId);
    if (settings) {
      console.log(`[Settings] Loaded from Supabase: OV=${settings.over_voltage}V, UV=${settings.under_voltage}V, PL=${settings.power_limit}W, Cost=₹${settings.cost_per_kwh}/kWh`);
      engine.updateThresholds({
        overVoltage: Number(settings.over_voltage),
        underVoltage: Number(settings.under_voltage),
        powerLimit: Number(settings.power_limit),
        costPerKwh: Number(settings.cost_per_kwh),
      });
    } else {
      console.log('[Settings] Using defaults (could not fetch from Supabase)');
    }

    // Subscribe to realtime settings updates from dashboard
    writer.getClient()
      .channel('simulator:meter_settings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meter_settings',
          filter: `device_id=eq.${args.deviceId}`,
        },
        (payload) => {
          const s = payload.new as any;
          if (s) {
            console.log(`\n⚡ [Settings Realtime Update] OV=${s.over_voltage}V, UV=${s.under_voltage}V, PL=${s.power_limit}W, Cost=₹${s.cost_per_kwh}/kWh`);
            engine.updateThresholds({
              overVoltage: Number(s.over_voltage),
              underVoltage: Number(s.under_voltage),
              powerLimit: Number(s.power_limit),
              costPerKwh: Number(s.cost_per_kwh),
            });
          }
        }
      )
      .subscribe();

    // Set initial device status
    const initialStatus: DeviceStatusPayload = {
      device_id: args.deviceId,
      connection_type: 'simulation',
      wifi_status: false,
      gsm_status: false,
      pzem_status: true,    // Simulated sensor is "working"
      relay1_status: true,   // Relay on by default
      relay2_status: false,
      last_seen: new Date().toISOString(),
    };
    await writer.updateDeviceStatus(initialStatus);
    console.log('[Status] Device status set to "simulation"');
  }

  console.log('');
  console.log('[SIM] Starting readings...');
  console.log('─'.repeat(100));

  let iteration = 0;
  let commFailureActive = args.mode === 'comm_failure';
  let commFailureTicks = 0;
  const COMM_FAILURE_DURATION = 6; // 6 ticks × 5s = 30s blackout

  // Run the simulation loop
  const runTick = async (): Promise<boolean> => {
    iteration++;

    // Synchronize latest settings from Supabase on every tick (fast indexed single-row query)
    if (writer) {
      const s = await writer.fetchSettings(args.deviceId);
      if (s) {
        const prev = engine.getConfig();
        const newOV = Number(s.over_voltage);
        const newUV = Number(s.under_voltage);
        const newPL = Number(s.power_limit);
        const newCost = Number(s.cost_per_kwh);

        if (
          newOV !== prev.overVoltage ||
          newUV !== prev.underVoltage ||
          newPL !== prev.powerLimit ||
          newCost !== prev.costPerKwh
        ) {
          console.log(`\n⚡ [Settings Synchronized] OV=${newOV}V, UV=${newUV}V, PL=${newPL}W, Tariff=₹${newCost}/kWh`);
          engine.updateThresholds({
            overVoltage: newOV,
            underVoltage: newUV,
            powerLimit: newPL,
            costPerKwh: newCost,
          });
        }
      }
    }

    const reading = engine.generateReading();
    const config = engine.getConfig();

    // Evaluate protection state machine against latest thresholds
    const evalResult = protectionManager.evaluate(
      reading,
      {
        overVoltage: config.overVoltage,
        underVoltage: config.underVoltage,
        powerLimit: config.powerLimit,
      },
      args.deviceId
    );

    // Sync protection status with state machine evaluation
    reading.protection_status = evalResult.protectionStatus;
    const relayOn = evalResult.relayOn;

    // Handle comm_failure scenario: suppress writes for COMM_FAILURE_DURATION ticks
    if (commFailureActive && commFailureTicks < COMM_FAILURE_DURATION) {
      commFailureTicks++;
      console.log(
        `[TICK ${String(iteration).padStart(4)}] ` +
        `V:${reading.voltage.toFixed(1)}V  I:${reading.current_amps.toFixed(3)}A  ` +
        `P:${reading.power.toFixed(1)}W  E:${reading.energy_kwh.toFixed(4)}kWh  ` +
        `⚠ COMM FAILURE (${commFailureTicks}/${COMM_FAILURE_DURATION} — not sending)`
      );
      return true;
    } else if (commFailureActive && commFailureTicks >= COMM_FAILURE_DURATION) {
      commFailureActive = false;
      console.log('[SIM] Communication restored');
    }

    // Log recovery transitions
    if (evalResult.recoveredFaults.length > 0) {
      console.log(`[RECOVERY] Cleared ${evalResult.recoveredFaults.join(', ')} — Relay restored to ON`);
    }

    // Emit new alerts triggered by SAFE -> FAULT transitions
    if (evalResult.alertsToEmit.length > 0) {
      for (const alert of evalResult.alertsToEmit) {
        console.log(`[PROTECTION TRIP] ${alert.alert_type.toUpperCase()} — Relay OFF`);
        if (writer) {
          const written = await writer.writeAlert(alert);
          if (written) {
            console.log(`[ALERT STORED] ${alert.message}`);
          }
        }
      }
    }

    // Log the reading
    const isTripped = evalResult.protectionStatus !== 'normal';
    const statusIcon = isTripped ? '🔴' : '🟢';
    console.log(
      `[TICK ${String(iteration).padStart(4)}] ${statusIcon} ` +
      `V:${reading.voltage.toFixed(1)}V  I:${reading.current_amps.toFixed(3)}A  ` +
      `P:${reading.power.toFixed(1)}W  E:${reading.energy_kwh.toFixed(4)}kWh  ` +
      `F:${reading.frequency.toFixed(1)}Hz  PF:${reading.power_factor.toFixed(2)}  ` +
      `₹${reading.cost.toFixed(2)} (₹${config.costPerKwh}/u)  [${reading.protection_status}]` +
      `  Relay:${relayOn ? 'ON' : 'OFF'}`
    );

    // Write to Supabase
    // IMPORTANT: Write device_status FIRST so the dashboard receives the authoritative
    // relay state before (or simultaneously with) the energy reading.
    // This prevents the realtime race condition where a reading with protection_status
    // arrives before the device_status update with the correct relay1_status.
    if (writer) {
      // Update device status heartbeat on every tick (every 5s)
      await writer.updateDeviceStatus({
        device_id: args.deviceId,
        connection_type: 'simulation',
        wifi_status: false,
        gsm_status: false,
        pzem_status: true,
        relay1_status: relayOn,
        relay2_status: false,
        last_seen: new Date().toISOString(),
      });

      const ok = await writer.writeReading(reading);
      if (!ok) {
        console.error('[ERROR] Failed to write reading to Supabase');
      }
    }

    // Check iteration limit
    if (args.iterations > 0 && iteration >= args.iterations) {
      return false; // Stop
    }

    return true; // Continue
  };

  // Main interval loop
  const loop = (): void => {
    runTick().then((shouldContinue) => {
      if (shouldContinue) {
        setTimeout(loop, args.intervalMs);
      } else {
        console.log('');
        console.log('─'.repeat(100));
        console.log(`[SIM] Completed ${iteration} iterations.`);
        const state = engine.getState();
        console.log(`[SIM] Final energy: ${state.cumulativeEnergyKwh.toFixed(4)} kWh, cost: ₹${state.cumulativeCost.toFixed(2)}`);
        process.exit(0);
      }
    }).catch((err) => {
      console.error('[FATAL]', err);
      process.exit(1);
    });
  };

  loop();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[SIM] Shutting down...');
    const state = engine.getState();
    console.log(`[SIM] Final energy: ${state.cumulativeEnergyKwh.toFixed(4)} kWh, cost: ₹${state.cumulativeCost.toFixed(2)}`);

    // Set device offline before exiting
    if (writer) {
      writer.updateDeviceStatus({
        device_id: args.deviceId,
        connection_type: 'offline',
        wifi_status: false,
        gsm_status: false,
        pzem_status: false,
        relay1_status: false,
        relay2_status: false,
        last_seen: new Date().toISOString(),
      }).finally(() => {
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
}

main();
