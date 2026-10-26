// ============================================================
// /api/alerts/test — Safe Interactive Alert Testing Endpoint
// ============================================================
// Generates a simulated electrical anomaly record in public.alerts
// and triggers Gmail SMTP dispatch with force=true (bypassing cooldown).
// Tests SMTP connectivity and returns immediate diagnostic feedback.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, isServiceRoleConfigured } from '@/lib/supabase-server';
import { dispatchAlertNotification } from '@/lib/notifications/dispatcher';
import { getSmtpBackoffStatus } from '@/lib/notifications/gmail-smtp';
import { DEVICE_ID } from '@/lib/constants';

// Rate-limiting state for manual test endpoint (minimum 30 seconds between tests)
let lastTestAttemptTimestamp = 0;

export async function POST(req: NextRequest) {
  try {
    const now = Date.now();

    // 0a. Check active SMTP backoff / Google rate-limiting
    const backoff = getSmtpBackoffStatus();
    if (backoff.isThrottled) {
      return NextResponse.json(
        {
          error: `Gmail SMTP is in cooldown (${backoff.remainingSeconds}s remaining). Google has temporarily throttled authentication attempts from this IP/account (${backoff.lastResponseCode || '454'}). Please wait for the restriction to clear.`,
          throttled: true,
          retryAfterSeconds: backoff.remainingSeconds,
          cooldownExpiresAt: new Date(backoff.throttleExpiresAt).toISOString(),
        },
        { status: 429 }
      );
    }

    // 0b. Enforce rate-limit on test alert clicks (min 30s delay)
    const elapsedSinceLastTest = now - lastTestAttemptTimestamp;
    const TEST_RATE_LIMIT_MS = 30000;
    if (lastTestAttemptTimestamp > 0 && elapsedSinceLastTest < TEST_RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil((TEST_RATE_LIMIT_MS - elapsedSinceLastTest) / 1000);
      return NextResponse.json(
        {
          error: `Test rate limit: Please wait ${waitSeconds}s before sending another test email to prevent triggering Google SMTP abuse filters.`,
          throttled: true,
          retryAfterSeconds: waitSeconds,
        },
        { status: 429 }
      );
    }

    lastTestAttemptTimestamp = now;

    // 0c. Security check: In production environments, require authentication or secret token
    const isProduction = process.env.NODE_ENV === 'production';
    const testSecret = process.env.ALERT_TEST_SECRET || process.env.ALERT_WEBHOOK_SECRET;

    if (isProduction && testSecret && !testSecret.startsWith('your-')) {
      const authHeader = req.headers.get('authorization') || '';
      const secretHeader = req.headers.get('x-test-secret') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');

      if (secretHeader !== testSecret && token !== testSecret) {
        return NextResponse.json(
          { error: 'Unauthorized: Production alert testing requires a valid authorization token or secret header.' },
          { status: 401 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));

    const deviceId = body.device_id || DEVICE_ID;
    const alertType = body.alert_type || 'over_voltage';
    const value = typeof body.value === 'number' ? body.value : 252.4;
    const relayStatus = body.relay_status || 'off';
    const message =
      body.message ||
      `[SIMULATED TEST] Over-voltage spike detected (${value}V > 240V). Relay contactor tripped.`;

    // 1. Insert the simulated alert into public.alerts
    const newAlert = {
      device_id: deviceId,
      timestamp: new Date().toISOString(),
      alert_type: alertType,
      value,
      message,
      relay_status: relayStatus,
      acknowledged: false,
      email_status: 'pending',
    };

    const { data: insertedAlert, error: insertError } = await supabaseServer
      .from('alerts')
      .insert(newAlert)
      .select('*')
      .single();

    if (insertError) {
      let diagnosticHint = '';
      if (insertError.message?.includes('fetch failed')) {
        diagnosticHint = ' (Network/DNS resolution failure connecting to Supabase. Check internet connectivity)';
      } else if (insertError.code === '42501' || insertError.message?.includes('permission denied')) {
        diagnosticHint = ' (Row-Level Security violation. Verify SUPABASE_SERVICE_ROLE_KEY in .env.local)';
      }

      console.error('[/api/alerts/test] Supabase insert error:', insertError);

      return NextResponse.json(
        {
          error: `Failed to insert test alert into Supabase: ${insertError.message}${diagnosticHint}`,
          code: insertError.code || null,
        },
        { status: 500 }
      );
    }

    // 2. Dispatch notifications with force=true to bypass cooldown
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const recipient = process.env.ALERT_TO_EMAIL;
    const cleanedPass = pass ? pass.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '') : '';

    console.log('[/api/alerts/test] Diagnostics (Safe Metadata):', {
      timestamp: new Date().toISOString(),
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: process.env.SMTP_PORT || '465',
      userPresent: Boolean(user),
      userDomain: user && user.includes('@') ? user.split('@')[1] : null,
      passPresent: Boolean(pass),
      rawPassLength: pass ? pass.length : 0,
      cleanedPassLength: cleanedPass ? cleanedPass.length : 0,
      recipientPresent: Boolean(recipient),
      recipientDomain: recipient && recipient.includes('@') ? recipient.split('@')[1] : null,
    });

    const dispatchResult = await dispatchAlertNotification(insertedAlert, { force: true });

    const smtpConfigured = Boolean(
      user &&
        !user.startsWith('your-') &&
        pass &&
        !pass.startsWith('your-')
    );

    return NextResponse.json({
      success: true,
      alert: insertedAlert,
      dispatch: dispatchResult,
      serviceRoleConfigured: isServiceRoleConfigured,
      smtpConfig: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || '465',
        userConfigured: Boolean(user),
        userDomain: user && user.includes('@') ? user.split('@')[1] : null,
        passConfigured: Boolean(pass),
        passLengthClean: cleanedPass ? cleanedPass.length : 0,
        recipientConfigured: Boolean(recipient),
        recipientDomain: recipient && recipient.includes('@') ? recipient.split('@')[1] : null,
        isConfigured: smtpConfigured,
      },
    });
  } catch (err: any) {
    console.error('[/api/alerts/test] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal error executing alert test' },
      { status: 500 }
    );
  }
}
