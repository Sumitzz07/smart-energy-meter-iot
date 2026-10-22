-- ==========================================
-- 005_seed.sql
-- Seed default mock device and default settings for prototyping
-- ==========================================

-- Insert the default prototype smart meter device
INSERT INTO public.devices (device_id, name, location)
VALUES (
    'esp32-meter-001',
    'Main Smart Meter',
    'Main Distribution Board'
)
ON CONFLICT (device_id) DO NOTHING;

-- Insert default settings for the prototype device
INSERT INTO public.meter_settings (device_id, over_voltage, under_voltage, power_limit, cost_per_kwh)
VALUES (
    'esp32-meter-001',
    260.0, -- Over-voltage threshold (V)
    180.0, -- Under-voltage threshold (V)
    2000.0, -- Power limit threshold (W)
    6.0  -- Cost per kWh (INR ₹)
)
ON CONFLICT (device_id) DO NOTHING;

-- Insert default device status for the prototype device
INSERT INTO public.device_status (
    device_id, 
    connection_type, 
    wifi_status, 
    gsm_status, 
    pzem_status, 
    relay1_status, 
    relay2_status, 
    last_seen
)
VALUES (
    'esp32-meter-001',
    'offline',
    false,
    false,
    false,
    false, -- Relay 1 OFF (Disconnected or Safe state)
    false, -- Relay 2 OFF
    NOW()
)
ON CONFLICT (device_id) DO NOTHING;
