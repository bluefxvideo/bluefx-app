import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CB_RECEIPT_PATTERN, confirmClickBankReceipt } from '@/lib/free-video/clickbank-video-ad';
import { isLive, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { ERRORS } from '@/lib/free-video/copy';
import { FREE_VIDEO_TOKEN_PATTERN } from '@/types/free-video';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';

/**
 * POST /api/free-video/<token>/cb-confirm { receipt }: the $49 page of a ClickBank funnel lead, back from ClickBank's
 * thank-you page with ?paid=cb&r=<receipt>, asks once to apply the receipt now instead of waiting for the zaps
 * (clickbank-video-ad.ts confirmClickBankReceipt: ClickBank's order API must show item 12 and this lead's token or email).
 * { success: true, data: { status: 'paid' | 'pending' | 'invalid' } }, never cached, never anything about the order.
 * Same origin only (the page itself); the token and the receipt are checked before anything runs.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

const BodySchema = z.object({ receipt: z.string().trim().max(60).regex(CB_RECEIPT_PATTERN) });

type CbConfirmData = { status: 'paid' | 'pending' | 'invalid' };
type Answer = ApiResponse<CbConfirmData>;
const answer = (body: Answer, status = 200) => NextResponse.json<Answer>(body, { status, headers: NO_STORE });

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

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token) || !sameOrigin(req.headers.get('origin'))) return answer(createApiError('Not found', { code: 'notFound' }), 404);
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return answer(createApiError('Invalid receipt', { code: 'invalid' }), 400);
  try {
    const status = await confirmClickBankReceipt(token, parsed.data.receipt);
    return answer(createApiSuccess({ status }));
  } catch (error) {
    console.error('❌ [free-video] ClickBank receipt confirmation failed:', error);
    return answer(createApiError(ERRORS.generic, { code: 'generic' }), 503);
  }
}
