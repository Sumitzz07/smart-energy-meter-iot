// ============================================================
// /api/alerts/poll — Server-Side Alert Notification Poller & Dispatcher
// ============================================================
// Queries public.alerts for unprocessed records ('email_status' = 'pending')
// and dispatches them via dispatchAlertNotification.
// Designed for serverless cron schedulers (Vercel Cron, external pingers)
// and in-process background workers. Ensures 100% automatic notification
// even when Supabase Database Webhooks are unavailable.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { dispatchAlertNotification } from '@/lib/notifications/dispatcher';
import { getSmtpBackoffStatus } from '@/lib/notifications/gmail-smtp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handlePoll(req);
}

export async function POST(req: NextRequest) {
  return handlePoll(req);
}

async function handlePoll(req: NextRequest) {
  try {
    // 0. Circuit Breaker: Do not query or poll if SMTP is currently throttled
    const backoff = getSmtpBackoffStatus();
    if (backoff.isThrottled) {
      return NextResponse.json(
        {
          status: 'throttled',
          message: `Alert poller deferred: Gmail SMTP is in rate-limit cooldown (${backoff.remainingSeconds}s remaining).`,
          retryAfterSeconds: backoff.remainingSeconds,
          timestamp: new Date().toISOString(),
        },
        { status: 429 }
      );
    }
    // 1. Authorization check for production environments
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
          { error: 'Unauthorized: Invalid or missing authorization token' },
          { status: 401 }
        );
      }
    }

    // 2. Query pending alerts (limit 15 per cycle to prevent timeouts)
    const { data: pendingAlerts, error: fetchErr } = await supabaseServer
      .from('alerts')
      .select('*')
      .eq('email_status', 'pending')
      .order('timestamp', { ascending: true })
      .limit(15);

    if (fetchErr) {
      console.error('[/api/alerts/poll] Error fetching pending alerts:', fetchErr.message);
      return NextResponse.json(
        { error: `Database query failed: ${fetchErr.message}` },
        { status: 500 }
      );
    }

    if (!pendingAlerts || pendingAlerts.length === 0) {
      return NextResponse.json({
        status: 'idle',
        pendingCount: 0,
        message: 'No pending alerts found to process.',
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Process each pending alert through the idempotent dispatcher
    const results = [];
    for (const alert of pendingAlerts) {
      const dispatch = await dispatchAlertNotification(alert);
      results.push({
        alertId: alert.id,
        device_id: alert.device_id,
        alert_type: alert.alert_type,
        status: dispatch.email.status,
        error: dispatch.errorSummary,
      });
    }

    return NextResponse.json({
      status: 'processed',
      pendingCount: pendingAlerts.length,
      processedCount: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[/api/alerts/poll] Fatal error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal error executing alert poll' },
      { status: 500 }
    );
  }
}
