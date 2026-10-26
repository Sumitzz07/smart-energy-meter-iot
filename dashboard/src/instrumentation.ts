// ============================================================
// instrumentation.ts — Next.js Server Startup Hook
// ============================================================
// Called once when Next.js server initializes.
// Starts the background worker for real-time alert processing.
// ============================================================

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundWorker } = await import('@/lib/background-worker');
    startBackgroundWorker();
  }
}
