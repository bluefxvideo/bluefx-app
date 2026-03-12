'use server';

/**
 * Remotion Render Service
 * Generic client for the self-hosted Remotion SSR server.
 *
 * The Remotion server exposes:
 *   POST /render        — start a render (sync or async)
 *   GET  /progress/:id  — poll render progress
 *   GET  /output/:file  — stream/download the rendered video
 */

const REMOTION_SERVER_URL = process.env.APP_REMOTION_SERVICE_URL || process.env.REMOTION_SERVER_URL || 'http://localhost:3001';
const REMOTION_API_KEY = process.env.REMOTION_API_KEY || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderRequest {
  compositionId: string;
  inputProps: Record<string, unknown>;
  codec?: string;
  quality?: number;
  userId?: string;
}

export interface RenderStartResult {
  success: boolean;
  renderId?: string;
  filename?: string;
  error?: string;
}

export interface RenderProgress {
  status: 'initializing' | 'rendering' | 'completed' | 'failed';
  progress: number; // 0 → 1
  renderedFrames: number;
  encodedFrames: number;
  totalFrames: number;
  stage: string;
  videoUrl?: string; // set when completed
  error?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function remotionFetch(path: string, options: RequestInit = {}) {
  const url = `${REMOTION_SERVER_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(REMOTION_API_KEY ? { 'X-API-Key': REMOTION_API_KEY } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Remotion server ${res.status}: ${text || res.statusText}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start an async render on the Remotion server.
 * Returns immediately with a renderId that can be used to poll progress.
 */
export async function startRemotionRender(
  request: RenderRequest,
): Promise<RenderStartResult> {
  try {
    console.log(`🎬 Starting Remotion render: ${request.compositionId}`);

    const body = {
      compositionId: request.compositionId,
      inputProps: request.inputProps,
      codec: request.codec || 'h264',
      quality: request.quality || 80,
      userId: request.userId || null,
      async: true, // always async — return immediately
    };

    const result = await remotionFetch('/render', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Render failed to start' };
    }

    console.log(`✅ Remotion render started: ${result.renderId || result.filename}`);

    return {
      success: true,
      renderId: result.renderId || result.filename,
      filename: result.filename,
    };
  } catch (error) {
    console.error('❌ Remotion render start error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start render',
    };
  }
}

/**
 * Poll the Remotion server for render progress.
 */
export async function checkRemotionProgress(
  renderId: string,
): Promise<RenderProgress> {
  try {
    const data = await remotionFetch(`/progress/${renderId}`);

    // Build video URL when completed
    let videoUrl: string | undefined;
    const rawVideoUrl = data.videoUrl || data.downloadUrl;
    if (data.status === 'completed' && rawVideoUrl) {
      // videoUrl from server is relative (e.g. /output/file.mp4)
      videoUrl = rawVideoUrl.startsWith('http')
        ? rawVideoUrl
        : `${REMOTION_SERVER_URL}${rawVideoUrl}`;
    }

    return {
      status: data.status || 'initializing',
      progress: data.progress || 0,
      renderedFrames: data.renderedFrames || 0,
      encodedFrames: data.encodedFrames || 0,
      totalFrames: data.totalFrames || 0,
      stage: data.stitchStage || data.stage || 'initializing',
      videoUrl,
      error: data.error,
    };
  } catch (error) {
    console.error('❌ Remotion progress check error:', error);
    return {
      status: 'failed',
      progress: 0,
      renderedFrames: 0,
      encodedFrames: 0,
      totalFrames: 0,
      stage: 'error',
      error: error instanceof Error ? error.message : 'Failed to check progress',
    };
  }
}

/**
 * Download a rendered video from the Remotion server and upload it to Supabase Storage.
 * Returns the public Supabase URL.
 *
 * Pattern from: app/src/app/api/script-video/store-export/route.ts
 */
export async function downloadAndStoreVideo(
  remotionVideoUrl: string,
  storagePath: string,
  supabaseClient: {
    storage: {
      from: (bucket: string) => {
        upload: (path: string, blob: Blob, options: Record<string, unknown>) => Promise<{ error: unknown }>;
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
  },
  bucket = 'reelestate-videos',
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    console.log(`📥 Downloading video from Remotion: ${remotionVideoUrl}`);

    const response = await fetch(remotionVideoUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const blob = new Blob([buffer], { type: 'video/mp4' });

    console.log(`📤 Uploading to Supabase storage: ${bucket}/${storagePath}`);

    const { error: uploadError } = await supabaseClient.storage
      .from(bucket)
      .upload(storagePath, blob, { contentType: 'video/mp4', upsert: true });

    if (uploadError) {
      throw new Error(`Upload failed: ${(uploadError as Error).message || uploadError}`);
    }

    const { data: urlData } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    console.log(`✅ Video stored: ${urlData.publicUrl}`);

    return { success: true, publicUrl: urlData.publicUrl };
  } catch (error) {
    console.error('❌ Video storage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to store video',
    };
  }
}
