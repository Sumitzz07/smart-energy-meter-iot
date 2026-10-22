// ============================================================
// supabase-writer.ts — Supabase REST client for the simulator
// ============================================================
// Handles all database writes: readings, device status, and alerts.
// Uses the service_role key (runs locally, never deployed publicly).
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SimulatedReading } from './engine';

export interface AlertPayload {
  device_id: string;
  timestamp: string;
  alert_type: string;
  value: number;
  message: string;
  relay_status: string;
}

export interface DeviceStatusPayload {
  device_id: string;
  connection_type: string;
  wifi_status: boolean;
  gsm_status: boolean;
  pzem_status: boolean;
  relay1_status: boolean;
  relay2_status: boolean;
  last_seen: string;
}

export class SupabaseWriter {
  private client: SupabaseClient;
  private lastAlertType: string | null = null;
  private lastAlertTime: number = 0;
  private readonly ALERT_COOLDOWN_MS = 30_000; // 30 seconds between same alert type

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    });
  }

  /**
   * Insert an energy reading into the energy_readings table.
   */
  async writeReading(reading: SimulatedReading): Promise<boolean> {
    const { error } = await this.client
      .from('energy_readings')
      .insert(reading);

    if (error) {
      console.error(`[Supabase] Failed to write reading: ${error.message}`);
      return false;
    }
    return true;
  }

  /**
   * Upsert device status (insert or update based on device_id PK).
   */
  async updateDeviceStatus(status: DeviceStatusPayload): Promise<boolean> {
    const { error } = await this.client
      .from('device_status')
      .upsert(status, { onConflict: 'device_id' });

    if (error) {
      console.error(`[Supabase] Failed to update device status: ${error.message}`);
      return false;
    }
    return true;
  }

  /**
   * Insert an alert into the alerts table.
   * State transitions and deduplication are governed by the FaultProtectionManager.
   */
  async writeAlert(alert: AlertPayload): Promise<boolean> {
    const { error } = await this.client
      .from('alerts')
      .insert(alert);

    if (error) {
      console.error(`[Supabase] Failed to write alert: ${error.message}`);
      return false;
    }

    return true;
  }

  /**
   * Fetch current meter settings from the database.
   * Used by the simulator to match its protection thresholds to the dashboard settings.
   */
  async fetchSettings(deviceId: string): Promise<{
    over_voltage: number;
    under_voltage: number;
    power_limit: number;
    cost_per_kwh: number;
  } | null> {
    const { data, error } = await this.client
      .from('meter_settings')
      .select('over_voltage, under_voltage, power_limit, cost_per_kwh')
      .eq('device_id', deviceId)
      .single();

    if (error) {
      console.error(`[Supabase] Failed to fetch settings: ${error.message}`);
      return null;
    }
    return data;
  }

  /**
   * Expose the underlying Supabase client for ad-hoc queries if needed.
   */
  getClient(): SupabaseClient {
    return this.client;
  }
}
