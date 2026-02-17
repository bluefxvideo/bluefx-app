'use server';

import { createAdminClient, createClient } from '@/app/supabase/server';

interface LinkedInPostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

interface LinkedInPostParams {
  videoUrl: string;
  text: string;
}

/**
 * Get user's LinkedIn access token
 */
async function getLinkedInAccessToken(userId: string): Promise<{ accessToken: string | null; personUrn?: string; error?: string }> {
  const adminClient = createAdminClient();

  const { data: connection, error } = await adminClient
    .from('social_platform_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'linkedin')
    .single();

  if (error || !connection) {
    return { accessToken: null, error: 'LinkedIn account not connected' };
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
      const refreshResult = await refreshLinkedInToken(refreshToken, userId);

      if (!refreshResult.success) {
        return { accessToken: null, error: refreshResult.error };
      }

      return { accessToken: refreshResult.accessToken!, personUrn: connection.platform_user_id };
    }
  }

  return { accessToken, personUrn: connection.platform_user_id };
}

/**
 * Refresh LinkedIn access token
 */
async function refreshLinkedInToken(
  refreshToken: string,
  userId: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('LinkedIn token refresh failed:', errorData);
      return { success: false, error: 'Failed to refresh token' };
    }

    const tokens = await response.json();

    const adminClient = createAdminClient();
    await adminClient
      .from('social_platform_connections')
      .update({
        access_token_encrypted: Buffer.from(tokens.access_token).toString('base64'),
        refresh_token_encrypted: tokens.refresh_token
          ? Buffer.from(tokens.refresh_token).toString('base64')
          : undefined,
        expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
      })
      .eq('user_id', userId)
      .eq('platform', 'linkedin');

    return { success: true, accessToken: tokens.access_token };
  } catch (error) {
    console.error('LinkedIn token refresh error:', error);
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
 * Get LinkedIn user's person URN
 */
async function getPersonUrn(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return `urn:li:person:${data.sub}`;
  } catch {
    return null;
  }
}

/**
 * Post video to LinkedIn
 * LinkedIn requires: 1) Register upload, 2) Upload video, 3) Create post
 */
export async function postToLinkedIn(params: LinkedInPostParams): Promise<LinkedInPostResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { accessToken, personUrn: storedUrn, error: tokenError } = await getLinkedInAccessToken(user.id);

    if (!accessToken) {
      return { success: false, error: tokenError || 'Failed to get access token' };
    }

    // Get person URN if not stored
    const personUrn = storedUrn || await getPersonUrn(accessToken);
    if (!personUrn) {
      return { success: false, error: 'Could not get LinkedIn user ID' };
    }

    // If no video URL, post as text-only (with YouTube link in the text)
    if (!params.videoUrl) {
      console.log('No video — posting as text to LinkedIn...');
      const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author: personUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: params.text.substring(0, 3000),
              },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
          },
        }),
      });

      if (!postResponse.ok) {
        const errorText = await postResponse.text();
        let detail = `LinkedIn API ${postResponse.status}`;
        try { const errJson = JSON.parse(errorText); detail = errJson.message || errJson.error || detail; } catch {}
        return { success: false, error: `Failed to create LinkedIn post: ${detail}` };
      }

      const postData = await postResponse.json();
      return {
        success: true,
        postId: postData.id,
        postUrl: postData.id ? `https://www.linkedin.com/feed/update/${postData.id}` : undefined,
      };
    }

    // Download the video for native video post
    console.log('Downloading video for LinkedIn from:', params.videoUrl);
    const videoData = await downloadVideo(params.videoUrl);
    console.log('Video download result:', videoData ? `${(videoData.buffer.length / 1024 / 1024).toFixed(1)}MB, type: ${videoData.contentType}` : 'FAILED', videoData?.error || '');

    if (!videoData || videoData.error) {
      return { success: false, error: videoData?.error || 'Failed to download video' };
    }

    // Step 1: Register the upload
    console.log('Registering LinkedIn video upload...');
    const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
          owner: personUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    });

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error('LinkedIn register upload failed:', registerResponse.status, errorText);
      let detail = '';
      try { detail = JSON.parse(errorText).message || errorText.substring(0, 200); } catch { detail = errorText.substring(0, 200); }
      return { success: false, error: `LinkedIn upload registration failed (${registerResponse.status}): ${detail}` };
    }

    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
    const asset = registerData.value?.asset;

    if (!uploadUrl || !asset) {
      return { success: false, error: 'Failed to get LinkedIn upload URL' };
    }

    // Step 2: Upload the video
    console.log('Uploading video to LinkedIn...');
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': videoData.contentType,
      },
      body: videoData.buffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('LinkedIn video upload failed:', uploadResponse.status, errorText);
      return { success: false, error: `LinkedIn video upload failed (${uploadResponse.status}): ${errorText.substring(0, 200)}` };
    }

    // Step 3: Create the post with the video
    console.log('Creating LinkedIn post with video...');
    const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: params.text.substring(0, 3000),
            },
            shareMediaCategory: 'VIDEO',
            media: [
              {
                status: 'READY',
                media: asset,
              },
            ],
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      }),
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error('LinkedIn post creation failed:', postResponse.status, errorText);
      // Parse error for readable message
      let detail = `LinkedIn API ${postResponse.status}`;
      try {
        const errJson = JSON.parse(errorText);
        detail = errJson.message || errJson.error || detail;
      } catch {}
      return { success: false, error: `Failed to create LinkedIn post: ${detail}` };
    }

    const postData = await postResponse.json();
    const postId = postData.id;

    // Extract the activity ID from the post ID for the URL
    const activityId = postId?.split(':').pop();

    console.log('LinkedIn post successful:', postId);

    return {
      success: true,
      postId,
      postUrl: activityId ? `https://www.linkedin.com/feed/update/${postId}` : undefined,
    };
  } catch (error) {
    console.error('LinkedIn posting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
