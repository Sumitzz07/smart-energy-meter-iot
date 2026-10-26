// ============================================================
// background-worker.ts — In-Process Node.js Alert & Offline Worker
// ============================================================
// Runs automatically on server startup in Node.js runtime.
// Ensures alerts inserted directly into Supabase (via ESP32 REST API,
// SQL editor, or simulator) are processed and notified automatically
// without requiring browser tabs or manual user clicks.
// ============================================================

import { supabaseServer } from './supabase-server';
import { dispatchAlertNotification } from './notifications/dispatcher';
import { getSmtpBackoffStatus } from './notifications/gmail-smtp';
import { STALE_THRESHOLD_SECONDS } from './constants';

interface GlobalWorkerState {
  isStarted: boolean;
  pollTimer?: NodeJS.Timeout;
  recentlyProcessedAlerts: Map<string, number>;
  lastOfflineCheck: number;
}

const globalWorker = globalThis as unknown as {
  __energyMeterWorkerState?: GlobalWorkerState;
};

if (!globalWorker.__energyMeterWorkerState) {
  globalWorker.__energyMeterWorkerState = {
    isStarted: false,
    recentlyProcessedAlerts: new Map<string, number>(),
    lastOfflineCheck: 0,
  };
}

const workerState = globalWorker.__energyMeterWorkerState;
const recentlyProcessedAlerts = workerState.recentlyProcessedAlerts;

/**
 * Start the in-process background worker (singleton guarded across Fast Refresh / module reloads).
 */
export function startBackgroundWorker() {
  if (workerState.isStarted) return;
  workerState.isStarted = true;

  console.log('[BackgroundWorker] Initialized server-side alert dispatcher and offline monitor.');

  // Run initial sweep after 5 seconds to allow server to stabilize
  setTimeout(() => {
    runWorkerCycle().catch((err) => {
      console.warn('[BackgroundWorker] Initial cycle error:', err?.message || err);
    });
  }, 5000);

  // Sweep every 60 seconds (conservative interval to prevent SMTP login flooding)
  workerState.pollTimer = setInterval(() => {
    runWorkerCycle().catch((err) => {
      console.warn('[BackgroundWorker] Interval cycle error:', err?.message || err);
    });
  }, 60000);

  // Unref timer so it does not block Node process exit if shutting down
  if (workerState.pollTimer.unref) {
    workerState.pollTimer.unref();
  }
}

/**
 * Stop the background worker cleanly.
 */
export function stopBackgroundWorker() {
  if (workerState.pollTimer) {
    clearInterval(workerState.pollTimer);
    workerState.pollTimer = undefined;
  }
  workerState.isStarted = false;
}

/**
 * Sweep pending un-notified alerts from public.alerts and dispatch notifications.
 * Exported for explicit unit testing and verification.
 */
export async function sweepPendingAlerts(now: number = Date.now()): Promise<number> {
  // 1. Circuit Breaker Check: If SMTP is currently throttled, skip sweeping
  const backoff = getSmtpBackoffStatus();
  if (backoff.isThrottled) {
    console.log(
      `[BackgroundWorker] Alert sweep paused: SMTP in rate-limit cooldown (${backoff.remainingSeconds}s remaining).`
    );
    return 0;
  }

  try {
    const { data: pendingAlerts, error: pollErr } = await supabaseServer
      .from('alerts')
      .select('*')
      .eq('email_status', 'pending')
      .is('notification_sent_at', null)
      .order('timestamp', { ascending: true })
      .limit(10);

    if (pollErr) {
      console.warn('[BackgroundWorker] Error querying pending alerts:', pollErr.message);
      return 0;
    }

    if (!pendingAlerts || pendingAlerts.length === 0) {
      return 0;
    }

    // Filter out any alert attempted within the last 15 minutes
    const unattemptedAlerts = pendingAlerts.filter((a) => {
      const lastAttempt = recentlyProcessedAlerts.get(a.id);
      return !lastAttempt || now - lastAttempt > 15 * 60 * 1000;
    });

    if (unattemptedAlerts.length === 0) {
      return 0;
    }

    console.log(
      `[BackgroundWorker] Detected ${unattemptedAlerts.length} pending alert(s). Dispatching notifications...`
    );

    let dispatchedCount = 0;
    for (const alert of unattemptedAlerts) {
      recentlyProcessedAlerts.set(alert.id, now);
      await dispatchAlertNotification(alert);
      dispatchedCount++;

      // Re-check backoff after each alert to abort sweep if rate limit is encountered
      if (getSmtpBackoffStatus().isThrottled) {
        console.warn('[BackgroundWorker] Throttling encountered during sweep. Aborting remainder of cycle.');
        break;
      }
    }
    return dispatchedCount;
  } catch (err: any) {
    console.warn('[BackgroundWorker] Sweep exception:', err?.message || err);
    return 0;
  }
}

/**
 * Full worker cycle: cleans cache, sweeps pending alerts, and checks device heartbeats.
 */
export async function runWorkerCycle() {
  const now = Date.now();

  // Clean up in-memory cache entries older than 30 minutes
  for (const [id, time] of recentlyProcessedAlerts.entries()) {
    if (now - time > 30 * 60 * 1000) {
      recentlyProcessedAlerts.delete(id);
    }
  }

  // 1. Sweep pending alerts
  await sweepPendingAlerts(now);

  // 2. Periodic device offline & recovery check (every 60 seconds)
  if (now - workerState.lastOfflineCheck >= 60000) {
    workerState.lastOfflineCheck = now;
    try {
      await checkDeviceHeartbeats(now);
    } catch (heartbeatErr) {
      // Non-blocking
    }
  }
}

async function checkDeviceHeartbeats(now: number) {
  const staleThresholdMs = (STALE_THRESHOLD_SECONDS || 60) * 1000;

  const { data: devices } = await supabaseServer
    .from('device_status')
    .select('device_id, last_seen');

  if (!devices || devices.length === 0) return;

  for (const dev of devices) {
    const lastSeenMs = dev.last_seen ? new Date(dev.last_seen).getTime() : 0;
    const isStale = lastSeenMs < now - staleThresholdMs;

    if (isStale) {
      // Check if already notified in last 15 minutes
      const fifteenMinsAgo = new Date(now - 15 * 60 * 1000).toISOString();
      const { data: recentOffline } = await supabaseServer
        .from('alerts')
        .select('id')
        .eq('device_id', dev.device_id)
        .eq('alert_type', 'device_offline')
        .gte('timestamp', fifteenMinsAgo)
        .limit(1);

      if (!recentOffline || recentOffline.length === 0) {
        const offlineAlert = {
          device_id: dev.device_id,
          timestamp: new Date().toISOString(),
          alert_type: 'device_offline' as const,
          value: 0,
          message: `Hardware heartbeat lost. Device '${dev.device_id}' has not responded since ${dev.last_seen || 'never'} (>60s timeout).`,
          relay_status: 'off' as const,
          acknowledged: false,
          email_status: 'pending' as const,
        };

        const { data: inserted } = await supabaseServer
          .from('alerts')
          .insert(offlineAlert)
          .select('*')
          .single();

        if (inserted) {
          recentlyProcessedAlerts.set(inserted.id, now);
          if (!getSmtpBackoffStatus().isThrottled) {
            await dispatchAlertNotification(inserted);
          }
        }
      }
    } else {
      // Check if recovering from offline
      const { data: latest } = await supabaseServer
        .from('alerts')
        .select('id, alert_type')
        .eq('device_id', dev.device_id)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (latest && latest[0]?.alert_type === 'device_offline') {
        const recoveryAlert = {
          device_id: dev.device_id,
          timestamp: new Date().toISOString(),
          alert_type: 'recovery' as const,
          value: 0,
          message: `Hardware heartbeat restored. Device '${dev.device_id}' has reconnected to Wi-Fi.`,
          relay_status: 'on' as const,
          acknowledged: false,
          email_status: 'pending' as const,
        };

        const { data: insertedRec } = await supabaseServer
          .from('alerts')
          .insert(recoveryAlert)
          .select('*')
          .single();

        if (insertedRec) {
          recentlyProcessedAlerts.set(insertedRec.id, now);
          if (!getSmtpBackoffStatus().isThrottled) {
            await dispatchAlertNotification(insertedRec);
          }
        }
      }
    }
  }
}
