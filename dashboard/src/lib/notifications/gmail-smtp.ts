// ============================================================
// gmail-smtp.ts — Gmail SMTP Email Service via Nodemailer
// ============================================================
// Sends high-priority transactional alert notifications using
// Gmail SMTP (smtp.gmail.com:465) with Google App Passwords.
// No paid subscriptions, no third-party SaaS accounts.
// ============================================================

import nodemailer, { Transporter } from 'nodemailer';

export interface GmailAlertPayload {
  deviceId: string;
  alertType: string;
  value: number;
  threshold?: string;
  message: string;
  relayStatus: string;
  timestamp: string; // ISO string
}

export interface NotificationResult {
  success: boolean;
  id?: string;
  error?: string;
  throttled?: boolean;
  retryAfterSeconds?: number;
}

export interface SmtpBackoffStatus {
  isThrottled: boolean;
  throttleExpiresAt: number;
  remainingSeconds: number;
  lastResponseCode?: number;
  lastFailureCode?: string;
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL SMTP CIRCUIT BREAKER & BACKOFF STATE
// ═══════════════════════════════════════════════════════════════
// Ensures multiple alert triggers, background sweeps, or test clicks
// never hammer Google SMTP during active authentication or rate-limit lockouts.
let smtpBackoffUntil = 0;
let lastSmtpResponseCode: number | undefined;
let lastSmtpFailureCode: string | undefined;
let lastSmtpReason: string | undefined;

export function getSmtpBackoffStatus(): SmtpBackoffStatus {
  const now = Date.now();
  const isThrottled = now < smtpBackoffUntil;
  const remainingSeconds = isThrottled ? Math.ceil((smtpBackoffUntil - now) / 1000) : 0;

  return {
    isThrottled,
    throttleExpiresAt: smtpBackoffUntil,
    remainingSeconds,
    lastResponseCode: lastSmtpResponseCode,
    lastFailureCode: lastSmtpFailureCode,
    reason: lastSmtpReason,
  };
}

export function recordSmtpFailure(responseCode?: number, failureCode?: string, reason?: string) {
  const now = Date.now();
  lastSmtpResponseCode = responseCode;
  lastSmtpFailureCode = failureCode;
  lastSmtpReason = reason;

  if (responseCode === 454 || reason?.includes('454') || reason?.includes('Too many login attempts')) {
    // Google rate limit requires minimum 10 minutes (600s) of zero attempts to clear!
    smtpBackoffUntil = Math.max(smtpBackoffUntil, now + 10 * 60 * 1000);
    console.warn(
      `[Gmail SMTP Backoff] Activated 10-minute backoff due to Google rate-limiting (454). Cooldown active until ${new Date(smtpBackoffUntil).toLocaleTimeString('en-IN')}`
    );
  } else if (responseCode === 535 || failureCode === 'EAUTH') {
    // Authentication failure backoff (5 minutes) to protect credentials
    smtpBackoffUntil = Math.max(smtpBackoffUntil, now + 5 * 60 * 1000);
    console.warn(
      `[Gmail SMTP Backoff] Activated 5-minute backoff due to authentication failure (${responseCode || failureCode}).`
    );
  }
}

export function resetSmtpBackoff() {
  smtpBackoffUntil = 0;
  lastSmtpResponseCode = undefined;
  lastSmtpFailureCode = undefined;
  lastSmtpReason = undefined;
}

// ═══════════════════════════════════════════════════════════════
// CONNECTION-POOLED TRANSPORTER CACHE
// ═══════════════════════════════════════════════════════════════
let cachedTransporter: Transporter | null = null;
let cachedTransporterKey = '';

function getPooledTransporter(host: string, port: number, user: string, pass: string): Transporter {
  const key = `${host}:${port}:${user}`;
  if (cachedTransporter && cachedTransporterKey === key) {
    return cachedTransporter;
  }

  if (cachedTransporter) {
    try {
      cachedTransporter.close();
    } catch {
      // Ignore close errors
    }
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // SSL on 465, TLS on 587
    pool: true,           // Connection pooling avoids reconnecting/authenticating on every email
    maxConnections: 1,    // Single connection prevents concurrent AUTH flooding
    maxMessages: 10,      // Recycle connection after 10 messages
    rateDelta: 2000,      // Minimum 2000ms delay between consecutive dispatches
    rateLimit: 1,         // Enforce 1 message per rateDelta
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000, // 10s connection timeout
    greetingTimeout: 8000,
    socketTimeout: 15000,
  });

  cachedTransporterKey = key;
  return cachedTransporter;
}

/**
 * Format a timestamp into Indian Standard Time (IST, UTC+05:30)
 */
export function formatIST(dateInput: string | Date): string {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return (
      d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }) + ' IST'
    );
  } catch {
    return String(dateInput);
  }
}

/**
 * Human-readable alert names
 */
export function getAlertTitle(alertType: string): string {
  switch (alertType) {
    case 'over_voltage':
      return 'Over-Voltage Fault Detected';
    case 'under_voltage':
      return 'Under-Voltage Fault Detected';
    case 'over_power':
      return 'Over-Power / Overload Detected';
    case 'comm_failure':
      return 'Communication Failure';
    case 'sensor_failure':
      return 'PZEM Sensor Reading Failure';
    case 'device_offline':
      return 'Device Offline Warning';
    case 'recovery':
      return 'System Recovered & Normal Operation Restored';
    default:
      return 'Electrical Anomaly Detected';
  }
}

/**
 * Format value with unit based on alert type
 */
function formatValueWithUnit(alertType: string, value: number): string {
  if (value === null || value === undefined || isNaN(value) || value <= 0) {
    return 'N/A';
  }
  switch (alertType) {
    case 'over_voltage':
    case 'under_voltage':
      return `${Number(value).toFixed(1)} V`;
    case 'over_power':
      return `${Number(value).toFixed(1)} W`;
    default:
      return `${Number(value).toFixed(1)}`;
  }
}

/**
 * Recommended actions based on fault type
 */
function getRecommendedAction(alertType: string): string {
  switch (alertType) {
    case 'over_voltage':
      return 'The relay contactor has automatically severed load power to protect downstream appliances. Measure mains AC voltage with a multimeter before resetting.';
    case 'under_voltage':
      return 'Mains AC voltage dropped below minimum operating limit. Keep sensitive electronics and motor loads disconnected to avoid thermal overload.';
    case 'over_power':
      return 'Load power exceeded safe maximum limit. Unplug high-wattage heating or inductive loads and inspect circuit wiring for short-circuits.';
    case 'sensor_failure':
      return 'UART communication loss with PZEM-004T transducer. Verify GPIO 16 (RX2) and GPIO 17 (TX2) wiring and 5V sensor power rail.';
    case 'comm_failure':
    case 'device_offline':
      return 'The ESP32 microcontroller has missed heartbeats (>60s). Check local Wi-Fi router connection and ESP32 USB power supply.';
    case 'recovery':
      return 'Mains electrical parameters have stabilized within nominal safety limits for 5 consecutive seconds. Relay contactor has automatically re-engaged.';
    default:
      return 'Inspect physical hardware and review live charts on the monitoring dashboard.';
  }
}

/**
 * Send Transactional Email via Gmail SMTP using Nodemailer
 */
export async function sendGmailAlert(payload: GmailAlertPayload): Promise<NotificationResult> {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;
  const fromEmail = process.env.ALERT_FROM_EMAIL || user;
  const toEmail = process.env.ALERT_TO_EMAIL;

  // 1. Validate environment configuration
  const cleanUser = user ? user.trim().replace(/^["']|["']$/g, '') : '';
  let cleanPass = pass ? pass.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '') : '';
  const cleanToEmail = toEmail ? toEmail.trim().replace(/^["']|["']$/g, '') : '';

  if (!cleanUser || cleanUser.startsWith('your-') || !cleanUser.includes('@')) {
    return {
      success: false,
      error: 'SMTP_USER is not configured with a valid Gmail address in .env.local.',
    };
  }

  if (!cleanPass || cleanPass.startsWith('your-')) {
    return {
      success: false,
      error: 'SMTP_PASS is not configured. Please generate a 16-character Google App Password.',
    };
  }

  if (!cleanToEmail || cleanToEmail.startsWith('your-') || !cleanToEmail.includes('@')) {
    return {
      success: false,
      error: 'ALERT_TO_EMAIL is not configured with a valid recipient email address.',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. PRE-FLIGHT CIRCUIT BREAKER: Avoid hammering Google when throttled
  // ═══════════════════════════════════════════════════════════════
  const backoff = getSmtpBackoffStatus();
  if (backoff.isThrottled) {
    const throttleMsg = `Gmail SMTP is temporarily paused due to active throttling (${backoff.lastResponseCode || backoff.lastFailureCode || '454'}). Remaining cooldown: ${backoff.remainingSeconds}s. No connection attempted to allow Google's lockout to clear.`;
    console.warn(`[Gmail SMTP Pre-Flight] ${throttleMsg}`);
    return {
      success: false,
      error: throttleMsg,
      throttled: true,
      retryAfterSeconds: backoff.remainingSeconds,
    };
  }

  const alertTitle = getAlertTitle(payload.alertType);
  const formattedTimeIST = formatIST(payload.timestamp);
  const formattedValue = formatValueWithUnit(payload.alertType, payload.value);
  const recommendedAction = getRecommendedAction(payload.alertType);
  const isRecovery = payload.alertType === 'recovery';
  const headerColor = isRecovery ? '#10b981' : '#ef4444';

  const subject = `[${isRecovery ? 'RESOLVED' : 'ALERT'}] Smart Energy Meter: ${alertTitle} [${payload.deviceId}]`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #f8fafc; }
    .card { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { background: ${headerColor}; padding: 20px 24px; color: #ffffff; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 24px; }
    .alert-box { background: ${isRecovery ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border-left: 4px solid ${headerColor}; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; }
    .alert-box p { margin: 0; font-size: 14px; color: #e2e8f0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    td { padding: 10px 12px; border-bottom: 1px solid #334155; font-size: 13px; }
    td.label { color: #94a3b8; width: 38%; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
    td.value { color: #f8fafc; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-weight: 600; }
    .action-box { background: #0f172a; border-radius: 8px; padding: 14px 16px; border: 1px solid #334155; margin-bottom: 20px; }
    .action-title { font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 6px; }
    .action-text { font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5; }
    .footer { padding: 16px 24px; background: #0f172a; border-top: 1px solid #334155; text-align: center; font-size: 11px; color: #64748b; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .badge-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>⚡ Smart Energy Meter Alert</h1>
      <p>Automated telemetry notification for <strong>${payload.deviceId}</strong></p>
    </div>
    <div class="content">
      <div class="alert-box">
        <p><strong>${alertTitle}</strong>: ${payload.message}</p>
      </div>

      <table>
        <tr>
          <td class="label">Device ID</td>
          <td class="value">${payload.deviceId}</td>
        </tr>
        <tr>
          <td class="label">Incident Type</td>
          <td class="value">${payload.alertType}</td>
        </tr>
        <tr>
          <td class="label">Measured Reading</td>
          <td class="value">${formattedValue}</td>
        </tr>
        ${payload.threshold ? `<tr><td class="label">Safety Threshold</td><td class="value">${payload.threshold}</td></tr>` : ''}
        <tr>
          <td class="label">Contactor State</td>
          <td class="value">
            <span class="badge ${payload.relayStatus?.toLowerCase() === 'off' ? 'badge-danger' : 'badge-success'}">
              ${payload.relayStatus?.toUpperCase() || 'UNKNOWN'}
            </span>
          </td>
        </tr>
        <tr>
          <td class="label">Event Time (IST)</td>
          <td class="value">${formattedTimeIST}</td>
        </tr>
      </table>

      <div class="action-box">
        <div class="action-title">Recommended Safety Action</div>
        <p class="action-text">${recommendedAction}</p>
      </div>
    </div>
    <div class="footer">
      Sent via Gmail SMTP • Smart Energy Meter IoT Capstone • Indian Standard Time (IST)
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const transporter = getPooledTransporter(host, port, cleanUser, cleanPass);

    const info = await transporter.sendMail({
      from: fromEmail || cleanUser,
      to: cleanToEmail,
      subject,
      html: htmlContent,
    });

    if (info && info.messageId) {
      resetSmtpBackoff(); // Delivery succeeded: clear any failure backoff
      return {
        success: true,
        id: info.messageId,
      };
    } else {
      return {
        success: false,
        error: 'SMTP server did not return a valid messageId confirmation.',
      };
    }
  } catch (err: any) {
    const rawResponse = err.response ? String(err.response) : '';
    const rawMessage = err.message ? String(err.message) : '';

    // Sanitize any occurrences of the user's email address from logs
    const sanitizedResponse = rawResponse
      ? rawResponse.replace(new RegExp(cleanUser, 'gi'), '[USER]')
      : undefined;
    const sanitizedMessage = rawMessage
      ? rawMessage.replace(new RegExp(cleanUser, 'gi'), '[USER]')
      : 'Unknown SMTP error';

    // ═══════════════════════════════════════════════════════════════
    // SERVER-SIDE DIAGNOSTIC LOG (SAFE METADATA ONLY — NO SECRETS)
    // ═══════════════════════════════════════════════════════════════
    console.error('[Gmail SMTP] Transmission failed:', {
      code: err.code || null,
      responseCode: err.responseCode || null,
      command: err.command || null,
      response: sanitizedResponse,
      message: sanitizedMessage,
    });

    let cleanError = sanitizedMessage;

    // Granular diagnosis based on Google SMTP response codes
    if (err.responseCode === 454 || rawResponse.includes('454') || rawMessage.includes('454')) {
      recordSmtpFailure(454, 'EAUTH', 'Too many login attempts (454 rate-limit)');
      cleanError =
        'Gmail SMTP temporary rate-limit (454-4.7.0 Too many login attempts). Google has temporarily throttled authentication attempts from this IP/account. Pausing SMTP attempts for 10 minutes to allow restriction to clear.';
    } else if (err.responseCode === 535 || rawResponse.includes('535') || rawMessage.includes('535')) {
      recordSmtpFailure(535, 'EAUTH', 'Bad credentials (535)');
      cleanError =
        'Gmail authentication failed (535 5.7.8 Bad credentials). Please verify your 16-character Google App Password and ensure 2-Step Verification is active.';
    } else if (err.code === 'EAUTH') {
      recordSmtpFailure(err.responseCode, 'EAUTH', sanitizedMessage);
      cleanError = `Gmail authentication error (${err.code}${err.responseCode ? ` ${err.responseCode}` : ''}): ${sanitizedResponse || sanitizedMessage}`;
    } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
      cleanError = 'SMTP connection to smtp.gmail.com:465 timed out. Verify network connectivity.';
    }

    return {
      success: false,
      error: cleanError,
      throttled: getSmtpBackoffStatus().isThrottled,
      retryAfterSeconds: getSmtpBackoffStatus().remainingSeconds,
    };
  }
}
