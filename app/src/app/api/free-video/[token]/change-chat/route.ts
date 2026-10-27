import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CHAT_MAX_CHARS, CHAT_MAX_MESSAGES, chatTurn } from '@/lib/free-video/change-chat';
import { isLive, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { getLeadByToken } from '@/lib/free-video/leads';
import { FREE_VIDEO_TOKEN_PATTERN } from '@/types/free-video';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';

/**
 * POST /api/free-video/<token>/change-chat { messages }: one turn of the change chat on the unlock page
 * (change-chat.ts). Same-origin only, a finished video ad only. ApiResponse<{ reply, changes }>.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(CHAT_MAX_CHARS) }))
    .min(1)
    .max(CHAT_MAX_MESSAGES)
    .refine((m) => m[m.length - 1].role === 'user', 'The last message must be the visitor\'s'),
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

type ChatResponse = ApiResponse<{ reply: string; changes: string[] | null }>;
const answer = (body: ChatResponse, status = 200) => NextResponse.json<ChatResponse>(body, { status, headers: NO_STORE });
const FALLBACK = 'Sorry, my answer did not come through. Please type your change again, or email support@bluefx.net.';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token) || !sameOrigin(req.headers.get('origin'))) return answer(createApiError('Not found', { code: 'notFound' }), 404);
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return answer(createApiError('Please type your change.', { code: 'invalid' }), 400);
  try {
    const lead = await getLeadByToken(token);
    if (!lead || lead.status !== 'done') return answer(createApiError('Not found', { code: 'notFound' }), 404);
    const turn = await chatTurn(lead, parsed.data.messages);
    if (turn === 'limit') return answer(createApiError('limit', { code: 'limit' }), 429);
    return answer(createApiSuccess(turn));
  } catch (error) {
    console.error('❌ [free-video] Change chat failed:', error);
    return answer(createApiError(FALLBACK, { code: 'generic' }), 503);
  }
}
