'use server';

import { createAdminClient, createClient } from '@/app/supabase/server';

interface TwitterPostResult {
  success: boolean;
  tweetId?: string;
  tweetUrl?: string;
  error?: string;
}

interface TwitterPostParams {
  videoUrl: string;
  text: string;
}

/**
 * Get user's Twitter access token, refreshing if necessary
 */
async function getTwitterAccessToken(userId: string): Promise<{ accessToken: string | null; error?: string }> {
  const adminClient = createAdminClient();

  const { data: connection, error } = await adminClient
    .from('social_platform_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'twitter')
    .single();

  if (error || !connection) {
    return { accessToken: null, error: 'Twitter account not connected' };
  }

  if (!connection.access_token_encrypted) {
    return { accessToken: null, error: 'No access token found' };
  }

  const accessToken = Buffer.from(connection.access_token_encrypted, 'base64').toString('utf-8');

  // Check if token is expired
  if (connection.expires_at) {
    const expiresAt = new Date(connection.expires_at);
    const now = new Date();

    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      if (!connection.refresh_token_encrypted) {
        return { accessToken: null, error: 'Token expired and no refresh token available' };
      }

      const refreshToken = Buffer.from(connection.refresh_token_encrypted, 'base64').toString('utf-8');
      const refreshResult = await refreshTwitterToken(refreshToken, userId);

      if (!refreshResult.success) {
        return { accessToken: null, error: refreshResult.error };
      }

      return { accessToken: refreshResult.accessToken! };
    }
  }

  return { accessToken };
}

/**
 * Refresh Twitter access token
 */
async function refreshTwitterToken(
  refreshToken: string,
  userId: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Twitter token refresh failed:', errorData);
      return { success: false, error: 'Failed to refresh token' };
    }

    const tokens = await response.json();

    const adminClient = createAdminClient();
    const updateData: Record<string, unknown> = {
      access_token_encrypted: Buffer.from(tokens.access_token).toString('base64'),
      expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
    };

    if (tokens.refresh_token) {
      updateData.refresh_token_encrypted = Buffer.from(tokens.refresh_token).toString('base64');
    }

    await adminClient
      .from('social_platform_connections')
      .update(updateData)
      .eq('user_id', userId)
      .eq('platform', 'twitter');

    return { success: true, accessToken: tokens.access_token };
  } catch (error) {
    console.error('Twitter token refresh error:', error);
    return { success: false, error: 'Token refresh failed' };
  }
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
 * Post video to Twitter/X
 * Twitter API v2 requires uploading media first, then creating a tweet with the media_id
 */
export async function postToTwitter(params: TwitterPostParams): Promise<TwitterPostResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { accessToken, error: tokenError } = await getTwitterAccessToken(user.id);

    if (!accessToken) {
      return { success: false, error: tokenError || 'Failed to get access token' };
    }

    // Try media upload first, fall back to text-only if Free tier (403)
    let mediaId: string | null = null;

    try {
      // Download the video
      console.log('Downloading video for Twitter...');
      const videoData = await downloadVideo(params.videoUrl);

      if (videoData && !videoData.error) {
        // Step 1: Initialize media upload (INIT)
        console.log('Initializing Twitter media upload...');
        const initResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            command: 'INIT',
            total_bytes: videoData.buffer.length.toString(),
            media_type: videoData.contentType,
            media_category: 'tweet_video',
          }),
        });

        if (initResponse.ok) {
          const initData = await initResponse.json();
          mediaId = initData.media_id_string;

          // Step 2: Upload media chunks (APPEND)
          console.log('Uploading video chunks to Twitter...');
          const chunkSize = 5 * 1024 * 1024; // 5MB chunks
          let segmentIndex = 0;

          for (let i = 0; i < videoData.buffer.length; i += chunkSize) {
            const chunk = videoData.buffer.slice(i, i + chunkSize);

            const appendResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                command: 'APPEND',
                media_id: mediaId!,
                media_data: chunk.toString('base64'),
                segment_index: segmentIndex.toString(),
              }),
            });

            if (!appendResponse.ok) {
              console.error('Twitter media append failed, falling back to text-only');
              mediaId = null;
              break;
            }

            segmentIndex++;
          }

          if (mediaId) {
            // Step 3: Finalize upload (FINALIZE)
            console.log('Finalizing Twitter media upload...');
            const finalizeResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                command: 'FINALIZE',
                media_id: mediaId,
              }),
            });

            if (!finalizeResponse.ok) {
              console.error('Twitter media finalize failed, falling back to text-only');
              mediaId = null;
            } else {
              const finalizeData = await finalizeResponse.json();

              // Step 4: Check processing status if needed
              if (finalizeData.processing_info) {
                console.log('Waiting for Twitter video processing...');
                let processingComplete = false;
                let checkCount = 0;
                const maxChecks = 30;

                while (!processingComplete && checkCount < maxChecks) {
                  await new Promise(resolve => setTimeout(resolve, 10000));

                  const statusResponse = await fetch(
                    `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                  );

                  if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    if (statusData.processing_info?.state === 'succeeded') {
                      processingComplete = true;
                    } else if (statusData.processing_info?.state === 'failed') {
                      mediaId = null;
                      break;
                    }
                  }
                  checkCount++;
                }

                if (!processingComplete) mediaId = null;
              }
            }
          }
        } else {
          console.log('Twitter media upload not available (Free tier), posting text-only');
        }
      }
    } catch (mediaError) {
      console.error('Twitter media upload error, falling back to text-only:', mediaError);
      mediaId = null;
    }

    // Step 5: Create tweet (with media if available, text-only otherwise)
    console.log(`Creating Twitter post (${mediaId ? 'with video' : 'text-only'})...`);
    const tweetResponse = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: params.text.substring(0, 280),
        ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
      }),
    });

    if (!tweetResponse.ok) {
      const errorText = await tweetResponse.text();
      console.error('Twitter tweet creation failed:', errorText);
      try {
        const errorJson = JSON.parse(errorText);
        const detail = errorJson.detail || errorJson.errors?.[0]?.message || errorJson.title || `HTTP ${tweetResponse.status}`;
        return { success: false, error: `Twitter: ${detail}` };
      } catch {
        return { success: false, error: `Twitter error: ${tweetResponse.status}` };
      }
    }

    const tweetData = await tweetResponse.json();
    const tweetId = tweetData.data.id;

    console.log('Twitter post successful:', tweetId);

    return {
      success: true,
      tweetId,
      tweetUrl: `https://twitter.com/i/status/${tweetId}`,
    };
  } catch (error) {
    console.error('Twitter posting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
