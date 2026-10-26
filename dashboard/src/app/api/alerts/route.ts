// ============================================================
// /api/alerts — Direct Alert Ingestion & Instant Notification API
// ============================================================
// Allows ESP32 firmware, simulators, or IoT gateways to post
// alerts directly to the Next.js backend.
// Inserts the record into public.alerts and immediately dispatches
// the Gmail SMTP notification in one unified server-side flow.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { dispatchAlertNotification } from '@/lib/notifications/dispatcher';
import { DEVICE_ID } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const deviceId = body.device_id || DEVICE_ID;
    const alertType = body.alert_type;

    if (!alertType) {
      return NextResponse.json(
        { error: 'Missing required field: alert_type.' },
        { status: 400 }
      );
    }

    const validAlertTypes = [
      'over_voltage',
      'under_voltage',
      'over_power',
      'comm_failure',
      'sensor_failure',
      'device_offline',
      'recovery',
    ];

    if (!validAlertTypes.includes(alertType)) {
      return NextResponse.json(
        {
          error: `Invalid alert_type '${alertType}'. Valid types: ${validAlertTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const value = typeof body.value === 'number' ? body.value : 0;
    const relayStatus = body.relay_status || (alertType === 'recovery' ? 'on' : 'off');
    const message = body.message || `${alertType} incident reported on device ${deviceId}.`;

    // 1. Insert alert record into Supabase
    const newAlert = {
      device_id: deviceId,
      timestamp: body.timestamp || new Date().toISOString(),
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
      console.error('[/api/alerts] Failed to insert alert:', insertError.message);
      return NextResponse.json(
        { error: `Database insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    // 2. Immediately dispatch Gmail notification
    const force = Boolean(body.force);
    const dispatchResult = await dispatchAlertNotification(insertedAlert, { force });

    return NextResponse.json(
      {
        success: true,
        alert: insertedAlert,
        dispatch: dispatchResult,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[/api/alerts] Fatal error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error processing alert' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Fetch latest 10 alerts
  const { data, error } = await supabaseServer
    .from('alerts')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: data });
}
