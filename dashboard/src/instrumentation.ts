// ============================================================
// instrumentation.ts — Next.js Server Startup Hook
// ============================================================
// Called once when Next.js server initializes.
// Starts the background worker for real-time alert processing.
// ============================================================

export async function register() {
  // Do not spawn background interval timers in Vercel's ephemeral serverless lambdas.
  // In local development or standalone Node servers, initialize the background worker.
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL) {
    const { startBackgroundWorker } = await import('@/lib/background-worker');
    startBackgroundWorker();
  }
}
