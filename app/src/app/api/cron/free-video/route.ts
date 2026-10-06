import { after, type NextRequest, NextResponse } from 'next/server';
import { readSettings } from '@/lib/free-video/leads';
import { kickQueue } from '@/lib/free-video/runner';
import { sweepFreeVideos } from '@/lib/free-video/sweep';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * Free video ad funnel sweep: settles running leads (deploy kills included), retries emails, keeps the
 * $29 clean renders moving, trips the circuit breaker, sends the owner's batched alerts, then starts what
 * the queue allows. The JSON answer is the live dashboard. ?dry=1 reads and reports only (no writes, no
 * starts, no emails).
 *
 * Coolify scheduled task on container bluefx-app, every 3 minutes (*\/3 * * * *). The double quotes are
 * required (single quotes would send the literal text, and every run would answer 401):
 *   curl -fsS -m 100 -H "Authorization: Bearer ${CRON_SECRET_TOKEN:-$APP_CRON_SECRET_TOKEN}" "http://$(hostname):3000/api/cron/free-video"
 * Calling the container itself avoids the proxy's ~55 s cut, and curl is in the runner image. Not localhost:
 * the standalone server listens on $HOSTNAME, which Docker sets to the container id (the startup log shows
 * "Local: http://<container id>:3000"), so localhost:3000 is refused. The token falls back like expectedToken.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const expectedToken = process.env.CRON_SECRET_TOKEN || process.env.APP_CRON_SECRET_TOKEN;
  const authHeader = request.headers.get('authorization');
  // Fail closed: an unset secret must never leave a paid endpoint open.
  if (!expectedToken) {
    return NextResponse.json({ error: 'CRON_SECRET_TOKEN not configured' }, { status: 503 });
  }
  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await readSettings(true);
    if (!settings) return NextResponse.json({ success: true, skipped: 'not set up' });
    const dry = request.nextUrl.searchParams.get('dry') === '1';
    const report = await sweepFreeVideos({ dry });
    if (!dry) after(() => kickQueue());
    return NextResponse.json({ success: true, ...report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('❌ [free-video] Cron sweep failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'sweep failed' }, { status: 500 });
  }
}
