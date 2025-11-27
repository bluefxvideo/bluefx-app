'use server';

import { createAdminClient, createClient } from '@/app/supabase/server';

interface FacebookPostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

interface FacebookPostParams {
  videoUrl: string;
  description: string;
  title?: string;
}

/**
 * Get user's Facebook access token and page info
 */
async function getFacebookAccessToken(userId: string): Promise<{
  accessToken: string | null;
  pageId?: string;
  pageAccessToken?: string;
  error?: string
}> {
  const adminClient = createAdminClient();

  const { data: connection, error } = await adminClient
    .from('social_platform_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'facebook')
    .single();

  if (error || !connection) {
    return { accessToken: null, error: 'Facebook account not connected' };
  }

  if (!connection.access_token_encrypted) {
    return { accessToken: null, error: 'No access token found' };
  }

  const accessToken = Buffer.from(connection.access_token_encrypted, 'base64').toString('utf-8');

  // For Facebook Pages, we need the page access token
  // This should be stored when the user connects their page
  const pageAccessToken = connection.page_access_token_encrypted
    ? Buffer.from(connection.page_access_token_encrypted, 'base64').toString('utf-8')
    : null;

  return {
    accessToken,
    pageId: connection.page_id,
    pageAccessToken: pageAccessToken || accessToken,
  };
}

/**
 * Download video and return as buffer
 */
async function downloadVideo(videoUrl: string): Promise<{ buffer: Buffer; contentType: string; error?: string } | null> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      return { buffer: Buffer.from([]), contentType: '', error: `Failed to download video: ${response.status}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'video/mp4';

    if (arrayBuffer.byteLength === 0) {
      return { buffer: Buffer.from([]), contentType: '', error: 'Downloaded video is empty' };
    }

    return { buffer: Buffer.from(arrayBuffer), contentType };
  } catch (error) {
    return { buffer: Buffer.from([]), contentType: '', error: error instanceof Error ? error.message : 'Video download failed' };
  }
}

/**
 * Get user's Facebook Pages
 */
async function getFacebookPages(accessToken: string): Promise<Array<{ id: string; name: string; access_token: string }>> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
    );

    if (!response.ok) return [];

    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * Post video to Facebook Page
 * Facebook requires uploading video via resumable upload for larger files
 */
export async function postToFacebook(params: FacebookPostParams): Promise<FacebookPostResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { accessToken, pageId, pageAccessToken, error: tokenError } = await getFacebookAccessToken(user.id);

    if (!accessToken) {
      return { success: false, error: tokenError || 'Failed to get access token' };
    }

    // Get page info if not stored
    let targetPageId = pageId;
    let targetPageToken = pageAccessToken || accessToken;

    if (!targetPageId) {
      // Get user's pages and use the first one
      const pages = await getFacebookPages(accessToken);
      if (pages.length === 0) {
        return { success: false, error: 'No Facebook Pages found. Please connect a Facebook Page.' };
      }
      targetPageId = pages[0].id;
      targetPageToken = pages[0].access_token;
    }

    // Download the video
    console.log('Downloading video for Facebook...');
    const videoData = await downloadVideo(params.videoUrl);

    if (!videoData || videoData.error) {
      return { success: false, error: videoData?.error || 'Failed to download video' };
    }

    // For smaller videos (< 1GB), use simple upload
    // For larger videos, would need resumable upload
    console.log('Uploading video to Facebook...');

    // Step 1: Initialize video upload
    const initResponse = await fetch(
      `https://graph.facebook.com/v18.0/${targetPageId}/videos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: targetPageToken,
          upload_phase: 'start',
          file_size: videoData.buffer.length,
        }),
      }
    );

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error('Facebook video init failed:', errorText);

      // Try alternative: direct URL posting
      return await postVideoByUrl(targetPageId, targetPageToken, params);
    }

    const initData = await initResponse.json();
    const uploadSessionId = initData.upload_session_id;
    const videoId = initData.video_id;

    if (!uploadSessionId) {
      // Fallback to URL-based posting
      return await postVideoByUrl(targetPageId, targetPageToken, params);
    }

    // Step 2: Upload video chunks
    console.log('Uploading video chunks to Facebook...');
    const chunkSize = 10 * 1024 * 1024; // 10MB chunks
    let startOffset = 0;

    while (startOffset < videoData.buffer.length) {
      const endOffset = Math.min(startOffset + chunkSize, videoData.buffer.length);
      const chunk = videoData.buffer.slice(startOffset, endOffset);

      const formData = new FormData();
      formData.append('access_token', targetPageToken);
      formData.append('upload_phase', 'transfer');
      formData.append('upload_session_id', uploadSessionId);
      formData.append('start_offset', startOffset.toString());
      formData.append('video_file_chunk', new Blob([chunk], { type: videoData.contentType }));

      const transferResponse = await fetch(
        `https://graph.facebook.com/v18.0/${targetPageId}/videos`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!transferResponse.ok) {
        const errorText = await transferResponse.text();
        console.error('Facebook video transfer failed:', errorText);
        return { success: false, error: 'Facebook video upload failed during transfer' };
      }

      const transferData = await transferResponse.json();
      startOffset = parseInt(transferData.end_offset) || endOffset;
    }

    // Step 3: Finish upload
    console.log('Finalizing Facebook video upload...');
    const finishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${targetPageId}/videos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: targetPageToken,
          upload_phase: 'finish',
          upload_session_id: uploadSessionId,
          title: params.title || '',
          description: params.description.substring(0, 63206), // Facebook char limit
          published: true,
        }),
      }
    );

    if (!finishResponse.ok) {
      const errorText = await finishResponse.text();
      console.error('Facebook video finish failed:', errorText);
      return { success: false, error: 'Facebook video upload finalization failed' };
    }

    const finishData = await finishResponse.json();

    console.log('Facebook post successful:', videoId || finishData.id);

    return {
      success: true,
      postId: videoId || finishData.id,
      postUrl: `https://www.facebook.com/${targetPageId}/videos/${videoId || finishData.id}`,
    };
  } catch (error) {
    console.error('Facebook posting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Alternative: Post video by URL (simpler but requires publicly accessible video URL)
 */
async function postVideoByUrl(
  pageId: string,
  pageToken: string,
  params: FacebookPostParams
): Promise<FacebookPostResult> {
  try {
    console.log('Attempting Facebook URL-based video posting...');

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/videos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: pageToken,
          file_url: params.videoUrl,
          title: params.title || '',
          description: params.description.substring(0, 63206),
          published: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Facebook URL video post failed:', errorText);

      // Parse error for details
      try {
        const errorJson = JSON.parse(errorText);
        return {
          success: false,
          error: errorJson.error?.message || `Facebook API error: ${response.status}`
        };
      } catch {
        return { success: false, error: `Facebook API error: ${response.status}` };
      }
    }

    const data = await response.json();

    return {
      success: true,
      postId: data.id,
      postUrl: `https://www.facebook.com/${pageId}/videos/${data.id}`,
    };
  } catch (error) {
    console.error('Facebook URL posting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'URL posting failed',
    };
  }
}
