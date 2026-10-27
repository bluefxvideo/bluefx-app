import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { isLive, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { AI_CHANGES, aiChangeRefusal, aiChangesOf, CHANGE_MAX_FILES, ownUploads, startAiChange, type AiChange } from '@/lib/free-video/instant-change';
import { getLeadByToken } from '@/lib/free-video/leads';
import { FREE_VIDEO_TOKEN_PATTERN } from '@/types/free-video';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';

/**
 * Instant changes on the unlock page (instant-change.ts). GET: the lead's changes and how many are left. POST { text }:
 * starts one (same origin only); refusals answer 409 with code notPaid | noneLeft | busy | style.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const NO_STORE = { 'Cache-Control': 'no-store' };
const BodySchema = z.object({
  text: z.string().trim().min(3).max(1500),
  uploadJobId: z.string().uuid().optional(),
  uploads: z.array(z.object({ name: z.string().min(1).max(200), path: z.string().min(1).max(400) })).max(CHANGE_MAX_FILES).default([]),
});

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

type Answer = ApiResponse<{ changes: AiChange[]; left: number }>;
const answer = (body: Answer, status = 200) => NextResponse.json<Answer>(body, { status, headers: NO_STORE });
const leftOf = (changes: AiChange[]) => Math.max(0, AI_CHANGES - changes.filter((c) => c.status !== 'failed').length);

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token)) return answer(createApiError('Not found', { code: 'notFound' }), 404);
  try {
    const lead = await getLeadByToken(token);
    if (!lead) return answer(createApiError('Not found', { code: 'notFound' }), 404);
    const changes = await aiChangesOf(lead);
    return answer(createApiSuccess({ changes, left: leftOf(changes) }));
  } catch (error) {
    console.error('❌ [free-video] AI changes read failed:', error);
    return answer(createApiError('Please try again in a minute.', { code: 'generic' }), 503);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token) || !sameOrigin(req.headers.get('origin'))) return answer(createApiError('Not found', { code: 'notFound' }), 404);
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return answer(createApiError('Please type your change.', { code: 'invalid' }), 400);
  try {
    const lead = await getLeadByToken(token);
    if (!lead) return answer(createApiError('Not found', { code: 'notFound' }), 404);
    const changes = await aiChangesOf(lead);
    const refusal = aiChangeRefusal(lead, changes, parsed.data.text);
    if (refusal) return answer(createApiError(refusal, { code: refusal }), 409);
    const uploads = await ownUploads(parsed.data.uploadJobId, parsed.data.uploads);
    const started = await startAiChange(lead, parsed.data.text, changes, { uploadJobId: parsed.data.uploadJobId, uploads });
    after(started.run);
    const now = await aiChangesOf(lead);
    return answer(createApiSuccess({ changes: now, left: leftOf(now) }));
  } catch (error) {
    console.error('❌ [free-video] AI change start failed:', error);
    return answer(createApiError('Your change did not start. Please try again, or ask my team.', { code: 'generic' }), 503);
  }
}
