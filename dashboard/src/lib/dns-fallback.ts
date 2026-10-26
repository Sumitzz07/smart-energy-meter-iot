// ============================================================
// dns-fallback.ts — Resilient Public DNS Fallback for Node.js
// ============================================================
// Bypasses local router / ISP DNS resolution failures (NXDOMAIN)
// for Supabase hostnames by falling back to Google DNS (8.8.8.8)
// and Cloudflare DNS (1.1.1.1), mirroring the ESP32 firmware logic.
// ============================================================

import dns from 'dns';

let isInitialized = false;

export function initDnsFallback() {
  // Only execute in server-side Node.js environment
  if (isInitialized || typeof window !== 'undefined') return;
  isInitialized = true;

  try {
    const dnsObj: any = (dns as any).default || dns;
    const originalLookup = dnsObj.lookup;
    if (typeof dnsObj.setServers === 'function') {
      dnsObj.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
    }

    // Wrap dns.lookup to provide fallback when local OS resolver fails
    const wrappedLookup: any = function (
      hostname: string,
      options: any,
      callback?: any
    ) {
      let cb = callback;
      let opt = options;
      if (typeof opt === 'function') {
        cb = opt;
        opt = {};
      }

      originalLookup.call(dnsObj, hostname, opt, (err: any, address: any, family: any) => {
        // If standard OS resolver succeeded, return directly
        if (!err && address) {
          return cb(null, address, family);
        }

        // If local router / ISP failed (e.g. ENOTFOUND / NXDOMAIN)
        // attempt direct resolution via public DNS (Google 8.8.8.8 / Cloudflare 1.1.1.1)
        if (typeof dnsObj.resolve4 === 'function') {
          dnsObj.resolve4(hostname, (resErr: any, addresses: any) => {
            if (!resErr && addresses && addresses.length > 0) {
              if (opt && opt.all) {
                return cb(
                  null,
                  addresses.map((a: string) => ({ address: a, family: 4 }))
                );
              }
              return cb(null, addresses[0], 4);
            }
            // If fallback also failed, preserve original error
            return cb(err || resErr, address, family);
          });
        } else {
          return cb(err, address, family);
        }
      });
    };

    if (originalLookup && (originalLookup as any).__promisify__) {
      wrappedLookup.__promisify__ = (originalLookup as any).__promisify__;
    }

    dnsObj.lookup = wrappedLookup;
  } catch (err) {
    console.warn('[DNS-Fallback] Warning: unable to attach DNS fallback hook:', err);
  }
}
