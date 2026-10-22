-- ==========================================
-- 007_add_hardware_connection.sql
-- Update constraints to support real ESP32 hardware payloads
-- ==========================================

-- 1. Add 'hardware' to connection_type in device_status
ALTER TABLE public.device_status DROP CONSTRAINT IF EXISTS device_status_connection_type_check;
ALTER TABLE public.device_status ADD CONSTRAINT device_status_connection_type_check 
  CHECK (connection_type IN ('wifi', 'gsm', 'offline', 'simulation', 'hardware'));

-- 2. Add 'sensor_failure' to protection_status in energy_readings
ALTER TABLE public.energy_readings DROP CONSTRAINT IF EXISTS energy_readings_protection_status_check;
ALTER TABLE public.energy_readings ADD CONSTRAINT energy_readings_protection_status_check 
  CHECK (protection_status IN ('normal', 'over_voltage', 'under_voltage', 'over_power', 'sensor_failure'));
