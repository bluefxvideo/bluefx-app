import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/app/supabase/server';

/**
 * Voice Changer uploads (source audio/video + target voice sample).
 *
 * Files go to storage here and only their URLs travel through the server
 * action. The tab used to base64 both files into the action arguments,
 * which Next 15.5 rejects above 1,000,000 characters ("Maximum array
 * nesting exceeded") — a 20 MB clip is 30x over — so no video source ever
 * converted in production.
 */

const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'aac', 'ogg'];
const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'avi', 'mkv'];
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const MAX_TARGET_BYTES = 25 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const kind = formData.get('kind');
    const batchIdRaw = formData.get('batchId');

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (kind !== 'source' && kind !== 'target') {
      return NextResponse.json({ success: false, error: 'kind must be "source" or "target"' }, { status: 400 });
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const allowed = kind === 'source' ? [...AUDIO_EXTS, ...VIDEO_EXTS] : AUDIO_EXTS;
    if (!allowed.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type .${ext || '?'} — use ${allowed.map((e) => e.toUpperCase()).join(', ')}` },
        { status: 400 },
      );
    }

    const maxBytes = kind === 'source' ? MAX_SOURCE_BYTES : MAX_TARGET_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { success: false, error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB, max ${maxBytes / 1024 / 1024} MB)` },
        { status: 413 },
      );
    }

    const batchId = typeof batchIdRaw === 'string' && /^voice_changer_[a-z0-9_]{1,40}$/.test(batchIdRaw)
      ? batchIdRaw
      : `voice_changer_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const bucket = 'script-videos';
    const filePath = `${user.id}/voice-changer/${batchId}_${kind}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(bucket)
      .upload(filePath, buffer, { contentType: CONTENT_TYPES[ext] || file.type || 'application/octet-stream', upsert: true });

    if (error) {
      console.error('❌ Voice Changer upload error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from(bucket).getPublicUrl(filePath);
    console.log(`📤 Voice Changer: ${kind} uploaded (${(file.size / 1024 / 1024).toFixed(1)} MB) → ${filePath}`);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
      batch_id: batchId,
      is_video: VIDEO_EXTS.includes(ext),
    });
  } catch (error) {
    console.error('❌ Voice Changer upload route error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
