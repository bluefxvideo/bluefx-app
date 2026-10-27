import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CHANGE_MAX_CHARS, changeRefusal, changesUsed, requestChange } from '@/lib/free-video/change-requests';
import { isLive, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { getLeadByToken } from '@/lib/free-video/leads';
import { FREE_VIDEO_TOKEN_PATTERN } from '@/types/free-video';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';

/**
 * POST /api/free-video/<token>/change { text }: an unlock buyer asks for a change to the video ad (unlock page,
 * owner 2026-10-27). Saved as a change_request event and emailed to the owner (change-requests.ts). Same-origin only.
 * ApiResponse<{ left }> with the rounds left; refusals answer 409 with code notPaid | tooLate | noRoundsLeft.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const BodySchema = z.object({ text: z.string().trim().min(3).max(CHANGE_MAX_CHARS) });

function sameOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.origin === new URL(SITE_URL).origin || url.origin === new URL(PROD_SITE_URL).origin) return true;
    return !isLive() && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

type ChangeAnswer = ApiResponse<{ left: number }>;
const answer = (body: ChangeAnswer, status = 200) => NextResponse.json<ChangeAnswer>(body, { status, headers: NO_STORE });

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token) || !sameOrigin(req.headers.get('origin'))) return answer(createApiError('Not found', { code: 'notFound' }), 404);
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return answer(createApiError('Please type the change you want.', { code: 'invalid' }), 400);
  try {
    const lead = await getLeadByToken(token);
    if (!lead) return answer(createApiError('Not found', { code: 'notFound' }), 404);
    const used = await changesUsed(lead.id);
    const refusal = changeRefusal(lead, used);
    if (refusal) return answer(createApiError(refusal, { code: refusal }), 409);
    const left = await requestChange(lead, parsed.data.text, used);
    console.log(`✅ [free-video] Change ${used + 1} asked for lead ${lead.id} (${lead.website_domain})`);
    return answer(createApiSuccess({ left }));
  } catch (error) {
    console.error('❌ [free-video] Change request failed:', error);
    return answer(createApiError('Something went wrong. Please email support@bluefx.net with your change.', { code: 'generic' }), 503);
  }
}
