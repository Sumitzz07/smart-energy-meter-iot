// ============================================================
// /api/devices/check-offline — Scheduled Server-side Offline & Recovery Monitor
// ============================================================
// Periodically checks device heartbeats in public.device_status.
// 1. If a device has missed heartbeats (>60s), generates a 'device_offline'
//    alert and dispatches a Gmail SMTP notification.
// 2. If a previously offline device resumes communication, generates a
//    'recovery' alert and dispatches a restoration notification.
// 3. Sweeps and dispatches any pending un-notified alerts.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { dispatchAlertNotification } from '@/lib/notifications/dispatcher';
import { STALE_THRESHOLD_SECONDS } from '@/lib/constants';

export async function GET(req: NextRequest) {
  return handleCheckOffline(req);
}

export async function POST(req: NextRequest) {
  return handleCheckOffline(req);
}

async function handleCheckOffline(req: NextRequest) {
  try {
    // 0. Authorization check for production / scheduled environments
    const configuredSecret = process.env.ALERT_WEBHOOK_SECRET || process.env.CRON_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && configuredSecret && !configuredSecret.startsWith('your-')) {
      const authHeader = req.headers.get('authorization') || '';
      const secretHeader = req.headers.get('x-webhook-secret') || req.headers.get('x-cron-secret') || '';
      const querySecret = req.nextUrl.searchParams.get('secret') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');

      const isAuthorized =
        secretHeader === configuredSecret ||
        token === configuredSecret ||
        querySecret === configuredSecret;

      if (!isAuthorized) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid cron / webhook authentication token' },
          { status: 401 }
        );
      }
    }

    const staleThresholdMs = (STALE_THRESHOLD_SECONDS || 60) * 1000;
    const now = Date.now();
    const cutoffTime = new Date(now - staleThresholdMs).toISOString();

    // 1. Fetch all devices from device_status
    const { data: allDevices, error: devError } = await supabaseServer
      .from('device_status')
      .select('device_id, last_seen, connection_type, wifi_status');

    if (devError) {
      return NextResponse.json({ error: devError.message }, { status: 500 });
    }

    const offlineResults = [];
    const recoveryResults = [];

    for (const dev of allDevices || []) {
      const lastSeenMs = dev.last_seen ? new Date(dev.last_seen).getTime() : 0;
      const isStale = lastSeenMs < now - staleThresholdMs;

      if (isStale) {
        // --- CASE A: DEVICE IS OFFLINE ---
        // Check if an unrecovered device_offline alert already exists in the last 15 minutes
        const fifteenMinsAgo = new Date(now - 15 * 60 * 1000).toISOString();

        const { data: recentOfflineAlerts } = await supabaseServer
          .from('alerts')
          .select('id, timestamp')
          .eq('device_id', dev.device_id)
          .eq('alert_type', 'device_offline')
          .gte('timestamp', fifteenMinsAgo)
          .limit(1);

        if (recentOfflineAlerts && recentOfflineAlerts.length > 0) {
          offlineResults.push({
            deviceId: dev.device_id,
            status: 'offline_already_alerted',
            lastSeen: dev.last_seen,
          });
          continue;
        }

        // Generate one device_offline incident
        const offlineAlert = {
          device_id: dev.device_id,
          timestamp: new Date().toISOString(),
          alert_type: 'device_offline' as const,
          value: 0,
          message: `Hardware heartbeat lost. Device '${dev.device_id}' has not reported since ${dev.last_seen || 'never'} (>60s timeout). Inspect physical power supply or Wi-Fi connectivity.`,
          relay_status: 'off' as const,
          acknowledged: false,
          email_status: 'pending' as const,
        };

        const { data: inserted, error: insertErr } = await supabaseServer
          .from('alerts')
          .insert(offlineAlert)
          .select('*')
          .single();

        if (insertErr) {
          console.error(`Failed to insert offline alert for ${dev.device_id}:`, insertErr);
          continue;
        }

        const dispatch = await dispatchAlertNotification(inserted);

        offlineResults.push({
          deviceId: dev.device_id,
          status: 'offline_alert_created',
          dispatch,
        });
      } else {
        // --- CASE B: DEVICE IS ONLINE ---
        // Check if the most recent alert for this device was a 'device_offline' that hasn't been recovered yet
        const { data: latestAlerts } = await supabaseServer
          .from('alerts')
          .select('id, alert_type, timestamp')
          .eq('device_id', dev.device_id)
          .order('timestamp', { ascending: false })
          .limit(1);

        const latestAlert = latestAlerts?.[0];
        if (latestAlert && latestAlert.alert_type === 'device_offline') {
          // Device has genuinely returned online after being offline!
          const recoveryAlert = {
            device_id: dev.device_id,
            timestamp: new Date().toISOString(),
            alert_type: 'recovery' as const,
            value: 0,
            message: `Hardware heartbeat restored. Device '${dev.device_id}' has reconnected to Wi-Fi and resumed telemetry transmission (heartbeat active at ${dev.last_seen}).`,
            relay_status: 'on' as const,
            acknowledged: false,
            email_status: 'pending' as const,
          };

          const { data: insertedRecovery, error: recInsertErr } = await supabaseServer
            .from('alerts')
            .insert(recoveryAlert)
            .select('*')
            .single();

          if (!recInsertErr && insertedRecovery) {
            const dispatch = await dispatchAlertNotification(insertedRecovery);
            recoveryResults.push({
              deviceId: dev.device_id,
              status: 'recovery_alert_created',
              dispatch,
            });
          }
        }
      }
    }

    // 2. Sweeps any stranded pending alerts (older than 10 seconds)
    const tenSecsAgo = new Date(now - 10 * 1000).toISOString();
    const { data: strandedAlerts } = await supabaseServer
      .from('alerts')
      .select('*')
      .eq('email_status', 'pending')
      .lte('timestamp', tenSecsAgo)
      .limit(5);

    const sweptDispatches = [];
    for (const alert of strandedAlerts || []) {
      const res = await dispatchAlertNotification(alert);
      sweptDispatches.push(res);
    }

    return NextResponse.json({
      status: 'complete',
      timestamp: new Date().toISOString(),
      staleCutoff: cutoffTime,
      totalMonitoredDevices: allDevices?.length || 0,
      offlineEvents: offlineResults,
      recoveryEvents: recoveryResults,
      sweptPendingAlerts: sweptDispatches.length,
    });
  } catch (err: any) {
    console.error('[/api/devices/check-offline] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Error executing device offline check' },
      { status: 500 }
    );
  }
}
