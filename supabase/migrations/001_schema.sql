-- ==========================================
-- 001_schema.sql
-- Create core tables, relationships, constraints, and indexes
-- ==========================================

-- Enable pgcrypto extension if not already enabled (for UUID generation)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. DEVICES TABLE
-- Stores metadata of the physical smart meters
CREATE TABLE IF NOT EXISTS public.devices (
    device_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. USER DEVICES TABLE
-- Maps users (from Supabase auth.users) to their authorized devices
-- Supports multi-user, multi-device ownership
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- references auth.users(id) - will link in foreign key below if schema public/auth are both ready.
    device_id TEXT NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

-- Note: We add user_id foreign key reference after auth schema is populated. 
-- Since auth.users is managed by Supabase, we can safely create this link:
ALTER TABLE public.user_devices 
  ADD CONSTRAINT fk_user_devices_user_id 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. ENERGY READINGS TABLE
-- Time-series historical data of PZEM sensor parameters
CREATE TABLE IF NOT EXISTS public.energy_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    voltage REAL NOT NULL CHECK (voltage >= 0),
    current_amps REAL NOT NULL CHECK (current_amps >= 0),
    power REAL NOT NULL CHECK (power >= 0),
    energy_kwh REAL NOT NULL CHECK (energy_kwh >= 0),
    frequency REAL NOT NULL CHECK (frequency >= 0),
    power_factor REAL NOT NULL CHECK (power_factor >= 0 AND power_factor <= 1),
    cost REAL NOT NULL CHECK (cost >= 0),
    protection_status TEXT NOT NULL DEFAULT 'normal' CHECK (protection_status IN ('normal', 'over_voltage', 'under_voltage', 'over_power'))
);

-- 4. METER SETTINGS TABLE
-- Device configurations, thresholds, and tariff pricing
CREATE TABLE IF NOT EXISTS public.meter_settings (
    device_id TEXT PRIMARY KEY REFERENCES public.devices(device_id) ON DELETE CASCADE,
    over_voltage REAL NOT NULL DEFAULT 260.0 CHECK (over_voltage > 0),
    under_voltage REAL NOT NULL DEFAULT 180.0 CHECK (under_voltage > 0),
    power_limit REAL NOT NULL DEFAULT 2000.0 CHECK (power_limit > 0),
    cost_per_kwh REAL NOT NULL DEFAULT 6.0 CHECK (cost_per_kwh >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. DEVICE STATUS TABLE
-- Heartbeat and live connection details
CREATE TABLE IF NOT EXISTS public.device_status (
    device_id TEXT PRIMARY KEY REFERENCES public.devices(device_id) ON DELETE CASCADE,
    connection_type TEXT NOT NULL DEFAULT 'offline' CHECK (connection_type IN ('wifi', 'gsm', 'offline', 'simulation')),
    wifi_status BOOLEAN NOT NULL DEFAULT false,
    gsm_status BOOLEAN NOT NULL DEFAULT false,
    pzem_status BOOLEAN NOT NULL DEFAULT false,
    relay1_status BOOLEAN NOT NULL DEFAULT false,
    relay2_status BOOLEAN NOT NULL DEFAULT false,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ALERTS TABLE
-- Historical log of tripped states and system alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('over_voltage', 'under_voltage', 'over_power', 'comm_failure', 'sensor_failure')),
    value REAL NOT NULL,
    message TEXT NOT NULL,
    relay_status TEXT NOT NULL CHECK (relay_status IN ('on', 'off')),
    acknowledged BOOLEAN NOT NULL DEFAULT false
);

-- ==========================================
-- CREATE INDEXES FOR OPTIMAL QUERY PERFORMANCE
-- ==========================================

-- For energy readings timeseries queries (sorting and filtering by device and time)
CREATE INDEX IF NOT EXISTS idx_energy_readings_device_timestamp 
ON public.energy_readings (device_id, timestamp DESC);

-- For retrieving recent alerts by device and time
CREATE INDEX IF NOT EXISTS idx_alerts_device_timestamp 
ON public.alerts (device_id, timestamp DESC);

-- For quick device ownership lookup
CREATE INDEX IF NOT EXISTS idx_user_devices_user 
ON public.user_devices (user_id);
