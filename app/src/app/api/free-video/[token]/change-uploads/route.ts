import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isLive, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { CHANGE_MAX_FILE_MB, CHANGE_MAX_FILES, changeUploadSlots } from '@/lib/free-video/instant-change';
import { getLeadByToken } from '@/lib/free-video/leads';
import { FREE_VIDEO_TOKEN_PATTERN } from '@/types/free-video';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';

/**
 * POST /api/free-video/<token>/change-uploads { files: [{ name, size }] }: signed upload URLs for the photos, logos and
 * clips of one change (instant-change.ts). A paid lead only, same origin only, the app's own limits (5 files, 100 MB).
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const FILE_TYPES = /\.(jpe?g|png|webp|tiff?|gif|bmp|heic|heif|avif|mp4|mov|webm|m4v)$/i;
const BodySchema = z.object({
  files: z
    .array(z.object({ name: z.string().min(1).max(200).regex(FILE_TYPES), size: z.number().positive().max(CHANGE_MAX_FILE_MB * 1024 * 1024) }))
    .min(1)
    .max(CHANGE_MAX_FILES),
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

type Answer = ApiResponse<{ uploadJobId: string; slots: { name: string; path: string; uploadUrl: string }[] }>;
const answer = (body: Answer, status = 200) => NextResponse.json<Answer>(body, { status, headers: NO_STORE });

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token) || !sameOrigin(req.headers.get('origin'))) return answer(createApiError('Not found', { code: 'notFound' }), 404);
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return answer(createApiError(`Photos and videos only, up to ${CHANGE_MAX_FILES} files of ${CHANGE_MAX_FILE_MB} MB each.`, { code: 'invalid' }), 400);
  try {
    const lead = await getLeadByToken(token);
    if (!lead || !['paid', 'rendering', 'ready', 'failed'].includes(lead.unlock_status)) return answer(createApiError('Not found', { code: 'notFound' }), 404);
    return answer(createApiSuccess(await changeUploadSlots(parsed.data.files)));
  } catch (error) {
    console.error('❌ [free-video] Change upload slots failed:', error);
    return answer(createApiError('Your files could not be prepared. Please try again.', { code: 'generic' }), 503);
  }
}
