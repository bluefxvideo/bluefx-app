'use server';

import { createAdminClient } from '@/app/supabase/server';
import { createClient } from '@/app/supabase/server';

export type YouTubePrivacyStatus = 'public' | 'unlisted' | 'private';

interface YouTubeUploadResult {
  success: boolean;
  videoId?: string;
  videoUrl?: string;
  error?: string;
}

interface YouTubePostParams {
  videoUrl: string; // URL of the video file to upload
  title: string;
  description: string;
  tags?: string[];
  privacyStatus: YouTubePrivacyStatus;
  categoryId?: string; // YouTube category ID (default: 22 = People & Blogs)
}

/**
 * Get user's YouTube access token, refreshing if necessary
 */
async function getYouTubeAccessToken(userId: string): Promise<{ accessToken: string | null; error?: string }> {
  const adminClient = createAdminClient();

  // Get the stored connection
  const { data: connection, error } = await adminClient
    .from('social_platform_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'youtube')
    .single();

  if (error || !connection) {
    return { accessToken: null, error: 'YouTube account not connected' };
  }

  if (!connection.access_token_encrypted) {
    return { accessToken: null, error: 'No access token found' };
  }

  // Decode the access token
  const accessToken = Buffer.from(connection.access_token_encrypted, 'base64').toString('utf-8');

  // Check if token is expired
  if (connection.expires_at) {
    const expiresAt = new Date(connection.expires_at);
    const now = new Date();

    // If token expires in less than 5 minutes, refresh it
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      // Need to refresh the token
      if (!connection.refresh_token_encrypted) {
        return { accessToken: null, error: 'Token expired and no refresh token available' };
      }

      const refreshToken = Buffer.from(connection.refresh_token_encrypted, 'base64').toString('utf-8');
      const refreshResult = await refreshYouTubeToken(refreshToken, userId);

      if (!refreshResult.success) {
        return { accessToken: null, error: refreshResult.error };
      }

      return { accessToken: refreshResult.accessToken! };
    }
  }

  return { accessToken };
}

/**
 * Refresh YouTube access token using refresh token
 */
async function refreshYouTubeToken(
  refreshToken: string,
  userId: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Token refresh failed:', errorData);
      return { success: false, error: 'Failed to refresh token' };
    }

    const tokens = await response.json();

    // Update the stored token
    const adminClient = createAdminClient();
    await adminClient
      .from('social_platform_connections')
      .update({
        access_token_encrypted: Buffer.from(tokens.access_token).toString('base64'),
        expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
      })
      .eq('user_id', userId)
      .eq('platform', 'youtube');

    return { success: true, accessToken: tokens.access_token };
  } catch (error) {
    console.error('Token refresh error:', error);
    return { success: false, error: 'Token refresh failed' };
  }
}

/**
 * Download video from URL and return as buffer
 */
async function downloadVideo(videoUrl: string): Promise<{ buffer: Buffer; contentType: string; error?: string } | null> {
  try {
    console.log('Attempting to download video from:', videoUrl);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.error('Failed to download video:', response.status, response.statusText);
      return { buffer: Buffer.from([]), contentType: '', error: `Failed to download video: ${response.status} ${response.statusText}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'video/mp4';

    console.log('Video downloaded successfully, size:', arrayBuffer.byteLength, 'content-type:', contentType);

    if (arrayBuffer.byteLength === 0) {
      return { buffer: Buffer.from([]), contentType: '', error: 'Downloaded video is empty' };
    }

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
    };
  } catch (error) {
    console.error('Video download error:', error);
    return { buffer: Buffer.from([]), contentType: '', error: error instanceof Error ? error.message : 'Video download failed' };
  }
}

/**
 * Upload video to YouTube using resumable upload
 */
export async function postToYouTube(params: YouTubePostParams): Promise<YouTubeUploadResult> {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get access token
    const { accessToken, error: tokenError } = await getYouTubeAccessToken(user.id);

    if (!accessToken) {
      return { success: false, error: tokenError || 'Failed to get access token' };
    }

    // Download the video
    console.log('Downloading video from:', params.videoUrl);
    const videoData = await downloadVideo(params.videoUrl);

    if (!videoData || videoData.error) {
      return { success: false, error: videoData?.error || 'Failed to download video' };
    }

    if (videoData.buffer.length === 0) {
      return { success: false, error: 'Video file is empty or could not be read' };
    }

    console.log('Video downloaded, size:', videoData.buffer.length);

    // Step 1: Initialize resumable upload
    const metadata = {
      snippet: {
        title: params.title.substring(0, 100), // YouTube title max 100 chars
        description: params.description.substring(0, 5000), // YouTube description max 5000 chars
        tags: params.tags?.slice(0, 500) || [], // YouTube has tag limits
        categoryId: params.categoryId || '22', // People & Blogs
      },
      status: {
        privacyStatus: params.privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    };

    // Initialize the upload
    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': videoData.buffer.length.toString(),
          'X-Upload-Content-Type': videoData.contentType,
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error('YouTube upload init failed:', errorText);

      // Parse error for more details
      let errorMessage = `YouTube API error: ${initResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use raw error if not JSON
        if (errorText.length < 100) {
          errorMessage = errorText;
        }
      }

      return { success: false, error: errorMessage };
    }

    // Get the upload URL from Location header
    const uploadUrl = initResponse.headers.get('Location');

    if (!uploadUrl) {
      return { success: false, error: 'No upload URL received from YouTube' };
    }

    console.log('Upload URL received, uploading video...');

    // Step 2: Upload the video
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': videoData.contentType,
        'Content-Length': videoData.buffer.length.toString(),
      },
      body: videoData.buffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('YouTube video upload failed:', errorText);

      // Parse error for more details
      let errorMessage = `Video upload failed: ${uploadResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use raw error if not JSON
        if (errorText.length < 100) {
          errorMessage = errorText;
        }
      }

      return { success: false, error: errorMessage };
    }

    const result = await uploadResponse.json();

    console.log('YouTube upload successful:', result.id);

    return {
      success: true,
      videoId: result.id,
      videoUrl: `https://www.youtube.com/watch?v=${result.id}`,
    };
  } catch (error) {
    console.error('YouTube posting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Check if user has valid YouTube connection
 */
export async function checkYouTubeConnection(): Promise<{
  connected: boolean;
  channelName?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { connected: false, error: 'Not authenticated' };
    }

    const { accessToken, error } = await getYouTubeAccessToken(user.id);

    if (!accessToken) {
      return { connected: false, error };
    }

    // Verify token by making a simple API call
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return { connected: false, error: 'Invalid or expired token' };
    }

    const data = await response.json();
    const channelName = data.items?.[0]?.snippet?.title;

    return { connected: true, channelName };
  } catch (error) {
    console.error('Check YouTube connection error:', error);
    return { connected: false, error: 'Connection check failed' };
  }
}
