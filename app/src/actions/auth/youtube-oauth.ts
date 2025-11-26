'use server';

/**
 * YouTube OAuth for Content Multiplier
 * Handles YouTube channel connection for video uploads
 */

export async function initiateYouTubeOAuth(): Promise<{
  success: boolean;
  authUrl?: string;
  error?: string;
}> {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/v1/callback`;

    if (!clientId) {
      throw new Error('Google OAuth client ID not configured');
    }

    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      throw new Error('NEXT_PUBLIC_SITE_URL not configured');
    }

    // Scopes needed for YouTube video uploads
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ');

    // Build OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', 'youtube_connect'); // Different state to identify this flow

    return {
      success: true,
      authUrl: authUrl.toString()
    };

  } catch (error) {
    console.error('Failed to initiate YouTube OAuth:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate OAuth'
    };
  }
}

/**
 * Check if user has YouTube connected
 */
export async function checkYouTubeConnection(userId: string): Promise<{
  connected: boolean;
  channelName?: string;
  expiresAt?: string;
}> {
  try {
    const { createClient } = await import('@/app/supabase/server');
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('social_platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'youtube')
      .single();

    if (error || !data) {
      return { connected: false };
    }

    return {
      connected: data.connection_status === 'active',
      channelName: data.username,
      expiresAt: data.expires_at,
    };

  } catch (error) {
    console.error('Error checking YouTube connection:', error);
    return { connected: false };
  }
}
