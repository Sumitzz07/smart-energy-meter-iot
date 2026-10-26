-- ============================================================
-- 010_alerts_notification_indexing.sql
-- Performance Optimization: Partial index for pending alert sweeps
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_alerts_pending_notifications
  ON public.alerts (email_status, timestamp ASC)
  WHERE email_status = 'pending';
