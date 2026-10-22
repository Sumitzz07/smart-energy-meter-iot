-- ============================================================
-- 006_grants.sql
-- Minimum Required Table, View, Sequence, and Function Grants
-- ============================================================
-- Grants precise, least-privilege permissions to:
--   1. service_role: administrative backend & simulator
--   2. anon: public web dashboard & ESP32 client (under RLS)
--   3. authenticated: logged-in dashboard & future mobile users (under RLS)
--
-- Row Level Security (RLS) remains enabled on all tables.
-- ============================================================

-- 1. SCHEMA USAGE
-- Required for PostgREST database roles to resolve objects in public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;


-- 2. SERVICE ROLE GRANTS (Simulator & Backend Admin)
-- Full data management on energy meter tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.devices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_devices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.energy_readings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meter_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_status TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.alerts TO service_role;


-- 3. ANON & AUTHENTICATED ROLES (Dashboard & Device Clients under RLS)
-- Only grant the exact operations needed by the frontend and IoT telemetry:

-- Devices: Read device metadata, allow initial device registration
GRANT SELECT, INSERT ON TABLE public.devices TO anon, authenticated;

-- User Devices: Read device-user mapping
GRANT SELECT ON TABLE public.user_devices TO anon, authenticated;

-- Energy Readings: Read history and insert new sensor telemetry (No DELETE / UPDATE)
GRANT SELECT, INSERT ON TABLE public.energy_readings TO anon, authenticated;

-- Meter Settings: Read thresholds and update settings from dashboard
GRANT SELECT, INSERT, UPDATE ON TABLE public.meter_settings TO anon, authenticated;

-- Device Status: Read heartbeat/relays and upsert connectivity state (No DELETE)
GRANT SELECT, INSERT, UPDATE ON TABLE public.device_status TO anon, authenticated;

-- Alerts: Read alert logs, insert trip alerts, update acknowledgment state (No DELETE)
GRANT SELECT, INSERT, UPDATE ON TABLE public.alerts TO anon, authenticated;


-- 4. ANALYTICS VIEWS GRANTS
-- Allow read access to aggregated reporting views
GRANT SELECT ON TABLE public.daily_energy_summary TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.monthly_energy_summary TO anon, authenticated, service_role;


-- 5. FUNCTION EXECUTION GRANTS
-- Only get_dashboard_stats is a callable RPC routine.
-- Trigger functions (calculate_reading_cost, set_updated_at) execute internally and do not need API grants.
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(TEXT) TO anon, authenticated, service_role;


-- 6. SEQUENCE GRANTS
-- Allow usage of sequences for auto-generated identifiers
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
