// ============================================================
// supabase-server.ts — Server-side Supabase client
// ============================================================
// Uses SUPABASE_SERVICE_ROLE_KEY for server-side operations
// (updating alerts delivery status, scheduled checks).
// Falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY if not configured.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { initDnsFallback } from './dns-fallback';

// Initialize resilient public DNS fallback to handle router / ISP NXDOMAIN issues
initDnsFallback();

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://placeholder-project.supabase.co';

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-key';

export const isServiceRoleConfigured = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('your-') &&
    process.env.SUPABASE_SERVICE_ROLE_KEY !== 'placeholder-key'
);

export const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
