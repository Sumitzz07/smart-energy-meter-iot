// ============================================================
// auth-utils.ts — Security & Timing-Safe Comparison Utilities
// ============================================================

import crypto from 'crypto';

/**
 * Performs a constant-time string equality check to defend against timing attacks.
 */
export function timingSafeEqualString(provided: string, expected: string): boolean {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  const bufProvided = Buffer.from(provided);
  const bufExpected = Buffer.from(expected);

  if (bufProvided.length !== bufExpected.length) {
    // Constant-time execution against dummy buffer to mitigate length leak timing
    crypto.timingSafeEqual(bufProvided, bufProvided);
    return false;
  }

  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

/**
 * Validates whether an incoming token matches the configured secret using constant-time comparison.
 */
export function isSecretAuthorized(providedCandidates: (string | null | undefined)[], expectedSecret: string): boolean {
  if (!expectedSecret || expectedSecret.startsWith('your-')) {
    return false;
  }

  for (const candidate of providedCandidates) {
    if (candidate && timingSafeEqualString(candidate.trim(), expectedSecret.trim())) {
      return true;
    }
  }

  return false;
}
