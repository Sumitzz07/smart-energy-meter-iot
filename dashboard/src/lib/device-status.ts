// ============================================================
// device-status.ts — Single authoritative source of truth for
// device heartbeat freshness, timestamp parsing, and online status.
// ============================================================

import { STALE_THRESHOLD_SECONDS } from './constants';

/**
 * Robustly parses any PostgreSQL timestamptz, ISO-8601 string, or epoch ms
 * into absolute UTC epoch milliseconds.
 *
 * Handles standard ISO formats ("2026-10-22T04:00:36Z", "2026-10-22T04:00:36+00:00")
 * as well as PostgreSQL space-separated variants ("2026-10-22 03:57:12+00").
 */
export function parseTimestampMs(ts: string | number | null | undefined): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;

  let s = String(ts).trim();
  if (!s) return 0;

  // Handle incomplete timezone offset like "+00" -> "Z" or "+05" -> "+05:00"
  if (s.endsWith('+00')) {
    s = s.slice(0, -3) + 'Z';
  } else if (/\+\d{2}$/.test(s)) {
    s = s + ':00';
  }

  // Normalize space separator to ISO "T"
  s = s.replace(' ', 'T');

  const parsed = Date.parse(s);
  return isNaN(parsed) ? new Date(ts).getTime() || 0 : parsed;
}

/**
 * Calculates how many seconds elapsed between the heartbeat timestamp
 * and the reference instant (defaults to Date.now()).
 * Always returns a non-negative integer.
 */
export function getDeviceSecondsAgo(
  lastSeen: string | number | null | undefined,
  nowMs: number = Date.now()
): number {
  const seenMs = parseTimestampMs(lastSeen);
  if (!seenMs) return Infinity;
  return Math.max(0, Math.floor((nowMs - seenMs) / 1000));
}

/**
 * Determines whether a device heartbeat is considered stale (offline).
 * Evaluates absolute elapsed seconds against the verified threshold.
 */
export function isDeviceStale(
  lastSeen: string | number | null | undefined,
  nowMs: number = Date.now(),
  thresholdSeconds: number = STALE_THRESHOLD_SECONDS
): boolean {
  if (!lastSeen) return true;
  const secondsAgo = getDeviceSecondsAgo(lastSeen, nowMs);
  return secondsAgo > thresholdSeconds;
}

/**
 * Convenience helper: device is online if its heartbeat is not stale.
 */
export function isDeviceOnline(
  lastSeen: string | number | null | undefined,
  nowMs: number = Date.now(),
  thresholdSeconds: number = STALE_THRESHOLD_SECONDS
): boolean {
  return !isDeviceStale(lastSeen, nowMs, thresholdSeconds);
}
