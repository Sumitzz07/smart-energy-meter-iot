// ============================================================
// dispatcher.ts — Gmail SMTP Alert Notification Dispatcher & Deduplication
// ============================================================

import { supabaseServer } from '../supabase-server';
import { sendGmailAlert, GmailAlertPayload, NotificationResult, getSmtpBackoffStatus } from './gmail-smtp';
import { Alert } from '../types';

export interface DispatchOptions {
  force?: boolean; // Bypass cooldown (e.g. for user-initiated manual test)
}

export interface DispatchResult {
  alertId: string;
  cooldownSkipped: boolean;
  email: {
    status: 'sent' | 'failed' | 'skipped';
    id?: string;
    error?: string;
  };
  errorSummary?: string | null;
}

// Global in-flight lock to guarantee that concurrent triggers (e.g. Webhook + Poller/Worker)
// never send duplicate emails for the same alert record.
const globalDispatcher = globalThis as unknown as {
  __activeDispatches?: Set<string>;
};

if (!globalDispatcher.__activeDispatches) {
  globalDispatcher.__activeDispatches = new Set<string>();
}
const activeDispatches = globalDispatcher.__activeDispatches;

/**
 * Dispatch Gmail SMTP alert notification with idempotency check and cooldown deduplication.
 */
export async function dispatchAlertNotification(
  alert: Partial<Alert> & { id: string; device_id: string; alert_type: string },
  options: DispatchOptions = {}
): Promise<DispatchResult> {
  const alertId = alert.id;
  const deviceId = alert.device_id;
  const alertType = alert.alert_type;

  // 0. Concurrency Guard: Prevent overlapping dispatches for the exact same alert ID
  if (activeDispatches.has(alertId)) {
    return {
      alertId,
      cooldownSkipped: true,
      email: { status: 'skipped', error: 'Dispatch already in-flight for this alert.' },
      errorSummary: 'Dispatch already in-flight for this alert ID.',
    };
  }

  activeDispatches.add(alertId);

  try {
    return await executeDispatch(alert, options);
  } finally {
    activeDispatches.delete(alertId);
  }
}

async function executeDispatch(
  alert: Partial<Alert> & { id: string; device_id: string; alert_type: string },
  options: DispatchOptions = {}
): Promise<DispatchResult> {
  const alertId = alert.id;
  const deviceId = alert.device_id;
  const alertType = alert.alert_type;

  // 1. Idempotency / Retry Protection:
  // If this specific alert record has already been notified, intentionally skipped,
  // or previously attempted and failed (when not manually forced), avoid infinite retry loops.
  if (alert.email_status === 'sent' || alert.email_status === 'skipped' || (!options.force && alert.email_status === 'failed')) {
    return {
      alertId,
      cooldownSkipped: true,
      email: { status: alert.email_status, error: alert.delivery_error || undefined },
      errorSummary: `Alert record was previously processed with status '${alert.email_status}'.`,
    };
  }

  // Also query the current database state for this alertId if not fresh
  try {
    const { data: dbAlert } = await supabaseServer
      .from('alerts')
      .select('id, email_status, delivery_error')
      .eq('id', alertId)
      .maybeSingle();

    if (dbAlert && (dbAlert.email_status === 'sent' || dbAlert.email_status === 'skipped' || (!options.force && dbAlert.email_status === 'failed'))) {
      return {
        alertId,
        cooldownSkipped: true,
        email: { status: dbAlert.email_status, error: dbAlert.delivery_error || undefined },
        errorSummary: `Alert record in database already has status '${dbAlert.email_status}'.`,
      };
    }
  } catch (checkErr) {
    console.warn('[Dispatcher] Pre-dispatch database check warning:', checkErr);
  }

  // 1b. Persistent Atomic Claim for Serverless & Multi-Instance Concurrency:
  // Multiple serverless lambdas or simultaneous Webhook + Sweeper instances
  // can attempt to process the exact same pending alert.
  // We atomically set notification_sent_at and a claiming lock in Postgres.
  // If another instance already claimed it, the update matches 0 rows.
  if (!options.force) {
    try {
      const claimTimestamp = new Date().toISOString();
      const { data: claimedRow, error: claimErr } = await supabaseServer
        .from('alerts')
        .update({
          notification_sent_at: claimTimestamp,
          delivery_error: 'Claimed for processing by notification dispatcher',
        })
        .eq('id', alertId)
        .eq('email_status', 'pending')
        .is('notification_sent_at', null)
        .select('id')
        .maybeSingle();

      if (claimErr) {
        console.warn('[Dispatcher] Atomic claim check warning:', claimErr.message);
      } else if (!claimedRow) {
        // Another instance or webhook already claimed this alert record
        return {
          alertId,
          cooldownSkipped: true,
          email: { status: 'skipped', error: 'Alert was already claimed or processed by another instance.' },
          errorSummary: 'Alert was already claimed or processed by another instance.',
        };
      }
    } catch (claimEx) {
      console.warn('[Dispatcher] Atomic claim exception (proceeding safely):', claimEx);
    }
  }

  // 2. Circuit Breaker / Throttling Guard
  // If Gmail SMTP returned 454 rate-limiting or authentication failure,
  // suppress further attempts to let Google's lockout timer expire.
  const backoff = getSmtpBackoffStatus();
  if (backoff.isThrottled) {
    const backoffMsg = `SMTP dispatch suppressed: Google rate-limiting cooldown active (${backoff.remainingSeconds}s remaining). Connection held to allow restriction to clear.`;
    console.warn(`[Dispatcher] Alert ${alertId} deferred: ${backoffMsg}`);

    try {
      await supabaseServer
        .from('alerts')
        .update({
          email_status: 'failed',
          delivery_error: backoffMsg,
          notification_sent_at: new Date().toISOString(),
        })
        .eq('id', alertId);
    } catch (dbErr) {
      console.warn('[Dispatcher] Failed to update backoff status in DB:', dbErr);
    }

    return {
      alertId,
      cooldownSkipped: false,
      email: {
        status: 'failed',
        error: backoffMsg,
      },
      errorSummary: backoffMsg,
    };
  }

  // 2. Cooldown / Deduplication Check (Default: 300 seconds / 5 minutes)
  const cooldownSeconds = process.env.ALERT_COOLDOWN_SECONDS
    ? parseInt(process.env.ALERT_COOLDOWN_SECONDS, 10)
    : 300;

  if (!options.force && cooldownSeconds > 0) {
    try {
      const cutoffDate = new Date(Date.now() - cooldownSeconds * 1000).toISOString();

      const { data: recentAlerts } = await supabaseServer
        .from('alerts')
        .select('id, timestamp, alert_type, email_status')
        .eq('device_id', deviceId)
        .eq('alert_type', alertType)
        .neq('id', alertId)
        .gte('timestamp', cutoffDate)
        .eq('email_status', 'sent')
        .limit(1);

      if (recentAlerts && recentAlerts.length > 0) {
        const cooldownMsg = `Suppressed by 5-minute cooldown (same incident notified within ${Math.round(cooldownSeconds / 60)}m)`;

        const { error: cooldownErr } = await supabaseServer
          .from('alerts')
          .update({
            email_status: 'skipped',
            delivery_error: cooldownMsg,
            notification_sent_at: new Date().toISOString(),
          })
          .eq('id', alertId);

        if (cooldownErr) {
          console.error('[Dispatcher] Failed to record cooldown suppression:', cooldownErr.message);
        }

        return {
          alertId,
          cooldownSkipped: true,
          email: { status: 'skipped', error: cooldownMsg },
          errorSummary: cooldownMsg,
        };
      }
    } catch (err) {
      console.warn('[Dispatcher] Cooldown query warning (proceeding with send):', err);
    }
  }

  // 3. Fetch configured thresholds from meter_settings to provide context in email
  let thresholdStr: string | undefined;
  try {
    const { data: settings } = await supabaseServer
      .from('meter_settings')
      .select('over_voltage, under_voltage, power_limit')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (settings) {
      if (alertType === 'over_voltage') thresholdStr = `${settings.over_voltage} V`;
      if (alertType === 'under_voltage') thresholdStr = `${settings.under_voltage} V`;
      if (alertType === 'over_power') thresholdStr = `${settings.power_limit} W`;
    }
  } catch {
    // Non-blocking: proceed even if meter_settings query fails
  }

  // 4. Prepare payload for Gmail SMTP
  const payload: GmailAlertPayload = {
    deviceId,
    alertType,
    value: Number(alert.value || 0),
    threshold: thresholdStr,
    message: alert.message || `${alertType} triggered on device ${deviceId}`,
    relayStatus: alert.relay_status || 'off',
    timestamp: alert.timestamp || new Date().toISOString(),
  };

  // 5. Dispatch Email via Gmail SMTP (Nodemailer)
  const emailResult: NotificationResult = await sendGmailAlert(payload);
  const emailStatus: 'sent' | 'failed' = emailResult.success ? 'sent' : 'failed';
  const deliveryError = emailResult.success ? null : (emailResult.error || 'SMTP delivery failed');

  // 6. Update the alert record in Supabase
  try {
    const { error: updateErr } = await supabaseServer
      .from('alerts')
      .update({
        email_status: emailStatus,
        delivery_error: deliveryError,
        notification_sent_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (updateErr) {
      console.error(
        `[Dispatcher] Failed to update delivery status in Supabase (${updateErr.code}): ${updateErr.message}`
      );
      if (updateErr.code === '42501' || updateErr.message?.includes('permission denied')) {
        console.warn(
          '[Dispatcher] HINT: Supabase rejected updating email_status. Set SUPABASE_SERVICE_ROLE_KEY in .env.local to permit server-side status updates under migration 008 RLS policies.'
        );
      }
    }
  } catch (dbErr) {
    console.error('[Dispatcher] Failed to update delivery status in Supabase:', dbErr);
  }

  return {
    alertId,
    cooldownSkipped: false,
    email: {
      status: emailStatus,
      id: emailResult.id,
      error: emailResult.error,
    },
    errorSummary: deliveryError,
  };
}
