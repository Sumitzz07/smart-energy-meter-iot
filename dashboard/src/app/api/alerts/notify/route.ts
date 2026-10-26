// ============================================================
// /api/alerts/notify — Webhook & Notification Trigger Endpoint
// ============================================================
// Receives Supabase Database Webhook payloads on public.alerts INSERT
// or direct notification requests, validates security token,
// ensures idempotency, and invokes the notification dispatcher.
// Also supports sweeping pending un-notified alerts.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { dispatchAlertNotification } from '@/lib/notifications/dispatcher';
import { getSmtpBackoffStatus } from '@/lib/notifications/gmail-smtp';

export async function POST(req: NextRequest) {
  try {
    // 0. Circuit Breaker Check: If SMTP is currently throttled, defer sweeping
    const backoff = getSmtpBackoffStatus();
    // 1. Security Check: Validate Webhook Secret
    const configuredSecret = process.env.ALERT_WEBHOOK_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, require ALERT_WEBHOOK_SECRET to be configured and non-placeholder
    if (isProduction && (!configuredSecret || configuredSecret.startsWith('your-'))) {
      return NextResponse.json(
        { error: 'Server misconfiguration: ALERT_WEBHOOK_SECRET must be configured in production.' },
        { status: 500 }
      );
    }

    if (configuredSecret && !configuredSecret.startsWith('your-')) {
      const authHeader = req.headers.get('authorization') || '';
      const secretHeader = req.headers.get('x-webhook-secret') || '';
      const querySecret = req.nextUrl.searchParams.get('secret') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');

      const isAuthorized =
        secretHeader === configuredSecret ||
        token === configuredSecret ||
        querySecret === configuredSecret;

      if (!isAuthorized) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid or missing webhook secret' },
          { status: 401 }
        );
      }
    }

    // 2. Parse payload
    const body = await req.json().catch(() => null);
    const isSweep =
      req.nextUrl.searchParams.get('sweep') === 'true' ||
      body?.sweep === true ||
      body?.type === 'SWEEP';

    // 3. Handle SWEEP mode: Process pending alerts that have not yet been notified
    if (isSweep) {
      if (backoff.isThrottled) {
        return NextResponse.json(
          {
            error: `Sweep deferred: Gmail SMTP is in rate-limit cooldown (${backoff.remainingSeconds}s remaining).`,
            throttled: true,
            retryAfterSeconds: backoff.remainingSeconds,
          },
          { status: 429 }
        );
      }

      const { data: pendingAlerts, error: fetchErr } = await supabaseServer
        .from('alerts')
        .select('*')
        .eq('email_status', 'pending')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (fetchErr) {
        return NextResponse.json(
          { error: `Failed to fetch pending alerts: ${fetchErr.message}` },
          { status: 500 }
        );
      }

      const sweepResults = [];
      for (const alert of pendingAlerts || []) {
        const result = await dispatchAlertNotification(alert);
        sweepResults.push(result);
      }

      return NextResponse.json({
        success: true,
        mode: 'sweep',
        processedCount: sweepResults.length,
        results: sweepResults,
      });
    }

    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Ignore non-INSERT webhook events (e.g. if webhook was configured without filtering)
    if (body.type && body.type !== 'INSERT' && !body.record && !body.alert) {
      return NextResponse.json({
        success: true,
        ignored: true,
        message: `Ignored event '${body.type}'. Only INSERT events trigger email notifications.`,
      });
    }

    // Handle Supabase Database Webhook payload:
    // { type: "INSERT", table: "alerts", schema: "public", record: { ... }, old_record: null }
    // or direct invocation: { alert: { ... } } or { id, device_id, ... }
    const alertRecord = body.record || body.alert || body;

    if (!alertRecord?.id || !alertRecord?.device_id || !alertRecord?.alert_type) {
      return NextResponse.json(
        {
          error: 'Payload missing required fields: id, device_id, alert_type',
          received: body,
        },
        { status: 400 }
      );
    }

    // Optional force flag (bypasses 5-minute cooldown for user-initiated tests)
    const force = Boolean(body.force);

    // 4. Dispatch notification through idempotent dispatcher
    const result = await dispatchAlertNotification(alertRecord, { force });

    return NextResponse.json({
      success: true,
      alertId: alertRecord.id,
      device_id: alertRecord.device_id,
      alert_type: alertRecord.alert_type,
      dispatch: result,
    });
  } catch (err: any) {
    console.error('[/api/alerts/notify] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error processing alert notification' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Allow GET with ?sweep=true for webhook ping or scheduled job healthcheck
  const isSweep = req.nextUrl.searchParams.get('sweep') === 'true';
  if (isSweep) {
    return POST(req);
  }

  return NextResponse.json({
    status: 'online',
    endpoint: '/api/alerts/notify',
    description: 'Supabase Database Webhook endpoint for automated Gmail alert delivery',
    webhookConfigured: Boolean(
      process.env.ALERT_WEBHOOK_SECRET &&
        !process.env.ALERT_WEBHOOK_SECRET.startsWith('your-')
    ),
  });
}
