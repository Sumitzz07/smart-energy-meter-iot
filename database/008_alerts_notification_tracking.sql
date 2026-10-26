-- ==========================================
-- 008_alerts_notification_tracking.sql
-- Add notification delivery tracking (Email & SMS) and expand alert types
-- ==========================================

-- 1. Expand alert_type check constraint to include 'device_offline' and 'recovery'
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_alert_type_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_alert_type_check 
  CHECK (alert_type IN ('over_voltage', 'under_voltage', 'over_power', 'comm_failure', 'sensor_failure', 'device_offline', 'recovery'));

-- 2. Add notification delivery tracking columns
ALTER TABLE public.alerts 
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'pending' 
  CHECK (email_status IN ('pending', 'sent', 'failed', 'skipped'));

ALTER TABLE public.alerts 
  ADD COLUMN IF NOT EXISTS sms_status TEXT NOT NULL DEFAULT 'pending' 
  CHECK (sms_status IN ('pending', 'sent', 'failed', 'skipped'));

ALTER TABLE public.alerts 
  ADD COLUMN IF NOT EXISTS delivery_error TEXT;

ALTER TABLE public.alerts 
  ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;

-- 3. Composite index for fast alert cooldown deduplication queries
CREATE INDEX IF NOT EXISTS idx_alerts_device_type_time 
  ON public.alerts (device_id, alert_type, timestamp DESC);

-- ============================================================
-- 4. HARDENED LEAST-PRIVILEGE PERMISSIONS FOR ALERTS
-- ============================================================

-- Ensure service_role has full management privileges (bypasses RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.alerts TO service_role;

-- Revoke broad table-level UPDATE from public and authenticated client roles
REVOKE UPDATE ON TABLE public.alerts FROM anon, authenticated;

-- Allow reading alerts (for dashboard display) and inserting alerts (for ESP32 and simulator)
GRANT SELECT, INSERT ON TABLE public.alerts TO anon, authenticated;

-- Restrict client-side updates ONLY to the 'acknowledged' column
-- Prevents clients from tampering with email_status, sms_status, values, or timestamps!
GRANT UPDATE (acknowledged) ON TABLE public.alerts TO anon, authenticated;
