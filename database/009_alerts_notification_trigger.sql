-- ============================================================
-- 009_alerts_notification_trigger.sql
-- Optional Database-Level Trigger for Automated Alert Notifications
-- ============================================================
-- If you have the pg_net extension enabled in Supabase, this trigger
-- will automatically invoke your Next.js webhook on every INSERT into
-- public.alerts, without needing the Supabase Dashboard Webhook UI.
-- ============================================================

-- 1. Enable pg_net extension (if available)
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Trigger function to call Next.js /api/alerts/notify endpoint
CREATE OR REPLACE FUNCTION public.notify_alert_created()
RETURNS TRIGGER AS $$
DECLARE
  dashboard_url text := 'https://your-dashboard-domain.vercel.app'; -- Replace with your deployed URL
  webhook_secret text := 'your-webhook-secret-here';               -- Replace with ALERT_WEBHOOK_SECRET
  payload jsonb;
BEGIN
  -- Build payload matching Supabase webhook structure
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'alerts',
    'schema', 'public',
    'record', to_jsonb(NEW)
  );

  -- Perform non-blocking async HTTP POST request via pg_net
  PERFORM net.http_post(
    url := dashboard_url || '/api/alerts/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := payload,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never abort alert insertion if HTTP notification dispatch fails!
  RAISE WARNING 'notify_alert_created failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop existing trigger if present and recreate
DROP TRIGGER IF EXISTS trg_notify_alert_created ON public.alerts;

-- Note: Uncomment the following line after replacing dashboard_url and webhook_secret above:
-- CREATE TRIGGER trg_notify_alert_created
--   AFTER INSERT ON public.alerts
--   FOR EACH ROW
--   EXECUTE FUNCTION public.notify_alert_created();
