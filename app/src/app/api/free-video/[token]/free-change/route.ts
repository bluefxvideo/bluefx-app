import { after, NextResponse } from 'next/server';
import { isLive, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { latestChangePlan } from '@/lib/free-video/change-chat';
import { freeChangeOf, freeChangeRefusal, startFreeChange, type AiChange } from '@/lib/free-video/instant-change';
import { getLeadByToken } from '@/lib/free-video/leads';
import { FREE_VIDEO_TOKEN_PATTERN } from '@/types/free-video';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';

/**
 * The free change on the unlock page (instant-change.ts). GET: the lead's free change. POST (no body, same origin only):
 * starts it from the change list the visitor saved in the change chat; refusals answer 409 with code
 * paid | used | style | notReady | noList.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const NO_STORE = { 'Cache-Control': 'no-store' };

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

type Answer = ApiResponse<{ free: AiChange | null }>;
const answer = (body: Answer, status = 200) => NextResponse.json<Answer>(body, { status, headers: NO_STORE });

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token)) return answer(createApiError('Not found', { code: 'notFound' }), 404);
  try {
    const lead = await getLeadByToken(token);
    if (!lead) return answer(createApiError('Not found', { code: 'notFound' }), 404);
    return answer(createApiSuccess({ free: await freeChangeOf(lead) }));
  } catch (error) {
    console.error('❌ [free-video] Free change read failed:', error);
    return answer(createApiError('Please try again in a minute.', { code: 'generic' }), 503);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token) || !sameOrigin(req.headers.get('origin'))) return answer(createApiError('Not found', { code: 'notFound' }), 404);
  try {
    const lead = await getLeadByToken(token);
    if (!lead) return answer(createApiError('Not found', { code: 'notFound' }), 404);
    const plan = await latestChangePlan(lead.id);
    const text = (plan ?? []).map((c, i) => `${i + 1}. ${c}`).join('\n');
    const free = await freeChangeOf(lead);
    const refusal = freeChangeRefusal(lead, free, text);
    if (refusal) return answer(createApiError(refusal, { code: refusal }), 409);
    const started = await startFreeChange(lead, text);
    after(started.run);
    return answer(createApiSuccess({ free: await freeChangeOf(lead) }));
  } catch (error) {
    console.error('❌ [free-video] Free change start failed:', error);
    return answer(createApiError('Your free change did not start. Please try again.', { code: 'generic' }), 503);
  }
}
