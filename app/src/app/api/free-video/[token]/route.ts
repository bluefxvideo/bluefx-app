import { NextResponse } from 'next/server';
import { ERRORS } from '@/lib/free-video/copy';
import { getLeadByToken, readSettings, toView } from '@/lib/free-video/leads';
import { FREE_VIDEO_TOKEN_PATTERN, type FreeVideoView } from '@/types/free-video';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';

/**
 * GET /api/free-video/<token>: what the status pages poll (thanks/<token> and v/<token>).
 * ApiResponse<FreeVideoView>, never cached. The token's shape is checked before any query runs, and the
 * answer never carries the email, ip, reason, gate or cost (toView). 404 for an unknown token.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

const notFound = () => NextResponse.json<ApiResponse<FreeVideoView>>(createApiError('Not found', { code: 'notFound' }), { status: 404, headers: NO_STORE });

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token)) return notFound();
  try {
    const lead = await getLeadByToken(token);
    if (!lead) return notFound();
    const view = await toView(lead, await readSettings());
    return NextResponse.json<ApiResponse<FreeVideoView>>(createApiSuccess(view), { headers: NO_STORE });
  } catch (error) {
    console.error('❌ free-video status GET', error);
    return NextResponse.json<ApiResponse<FreeVideoView>>(createApiError(ERRORS.generic, { code: 'generic' }), { status: 503, headers: NO_STORE });
  }
}
