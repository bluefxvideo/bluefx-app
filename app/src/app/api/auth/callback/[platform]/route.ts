import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { createAdminClient } from '@/app/supabase/server';

/**
 * OAuth Callback Handler for Social Media Platforms
 * Receives the authorization code, exchanges it for tokens, fetches user profile,
 * and stores the connection in the database.
 */

// Platform-specific OAuth configs (token exchange endpoints + scopes)
const OAUTH_CONFIGS: Record<string, {
  tokenUrl: string;
  profileUrl: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  useBasicAuth?: boolean;
}> = {
  twitter: {
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    profileUrl: 'https://api.twitter.com/2/users/me?user.fields=profile_image_url',
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
    useBasicAuth: true,
  },
  linkedin: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    profileUrl: 'https://api.linkedin.com/v2/userinfo',
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  },
  facebook: {
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    profileUrl: 'https://graph.facebook.com/me?fields=id,name,picture.width(200)',
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  },
  instagram: {
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    profileUrl: 'https://graph.instagram.com/me?fields=id,username,account_type',
    clientId: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
  },
  tiktok: {
    tokenUrl: 'https://open-api.tiktok.com/oauth/access_token/',
    profileUrl: 'https://open-api.tiktok.com/oauth/userinfo/',
    clientId: process.env.TIKTOK_CLIENT_ID,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const resolvedParams = await params;
  const platform = resolvedParams.platform;
  const { searchParams } = new URL(request.url);
  const redirectBase = platform === 'google_docs'
    ? '/dashboard/ebook-writer/export'
    : '/dashboard/content-multiplier';

  try {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from the provider
    if (error) {
      console.error(`OAuth error for ${platform}:`, error, errorDescription);
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=${encodeURIComponent(errorDescription || error)}&platform=${platform}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=missing_parameters&platform=${platform}`, request.url)
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(
        new URL(`/login?error=unauthorized&platform=${platform}`, request.url)
      );
    }

    // Verify state parameter
    try {
      const decoded = Buffer.from(state, 'base64url').toString();
      const [stateUserId, statePlatform] = decoded.split(':');
      if (stateUserId !== user.id || statePlatform !== platform) {
        throw new Error('State mismatch');
      }
    } catch {
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=invalid_state&platform=${platform}`, request.url)
      );
    }

    const config = OAUTH_CONFIGS[platform];
    if (!config || !config.clientId || !config.clientSecret) {
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=platform_not_configured&platform=${platform}`, request.url)
      );
    }

    // =========================================================================
    // Step 1: Exchange authorization code for tokens
    // =========================================================================
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback/${platform}`;

    let tokenResponse: Response;

    if (config.useBasicAuth) {
      // Twitter uses Basic Auth for token exchange
      tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: 'challenge', // PKCE verifier — simplified
        }),
      });
    } else if (platform === 'linkedin') {
      // LinkedIn uses form body (not Basic Auth)
      tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      });
    } else {
      // Facebook, Instagram, TikTok — standard form body
      tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      });
    }

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error(`Token exchange failed for ${platform}:`, tokenResponse.status, errorBody);
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=token_exchange_failed&platform=${platform}`, request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    if (!accessToken) {
      console.error(`No access token in response for ${platform}:`, tokenData);
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=no_access_token&platform=${platform}`, request.url)
      );
    }

    console.log(`Token exchange successful for ${platform}`);

    // =========================================================================
    // Step 2: Fetch user profile
    // =========================================================================
    let username = '';
    let avatarUrl: string | null = null;
    let platformUserId: string | null = null;
    let pageId: string | null = null;
    let pageAccessToken: string | null = null;

    try {
      if (platform === 'twitter') {
        const profileRes = await fetch(config.profileUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          username = profile.data?.username || '';
          avatarUrl = profile.data?.profile_image_url || null;
          platformUserId = profile.data?.id || null;
        }
      } else if (platform === 'linkedin') {
        const profileRes = await fetch(config.profileUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          username = profile.name || profile.given_name || '';
          avatarUrl = profile.picture || null;
          platformUserId = profile.sub || null;  // LinkedIn sub = person URN ID
        }
      } else if (platform === 'facebook') {
        // Get user profile
        const profileRes = await fetch(`${config.profileUrl}&access_token=${accessToken}`);
        if (profileRes.ok) {
          const profile = await profileRes.json();
          username = profile.name || '';
          avatarUrl = profile.picture?.data?.url || null;
          platformUserId = profile.id || null;
        }

        // Get Facebook Pages (needed for posting as a Page)
        const pagesRes = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
        );
        if (pagesRes.ok) {
          const pagesData = await pagesRes.json();
          const pages = pagesData.data || [];
          if (pages.length > 0) {
            // Auto-select the first page
            pageId = pages[0].id;
            pageAccessToken = pages[0].access_token;
            username = `${username} (Page: ${pages[0].name})`;
          }
        }
      } else if (platform === 'instagram') {
        const profileRes = await fetch(`${config.profileUrl}&access_token=${accessToken}`);
        if (profileRes.ok) {
          const profile = await profileRes.json();
          username = profile.username || '';
          platformUserId = profile.id || null;
        }
      }
    } catch (profileError) {
      console.error(`Profile fetch failed for ${platform}:`, profileError);
      // Continue anyway — we have the token, just no profile info
      username = `${platform}_user`;
    }

    // =========================================================================
    // Step 3: Store connection in database
    // =========================================================================
    const adminClient = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connectionData: any = {
      user_id: user.id,
      platform,
      connected: true,
      username: username || `${platform}_user`,
      avatar_url: avatarUrl,
      connection_status: 'active',
      access_token_encrypted: Buffer.from(accessToken).toString('base64'),
      refresh_token_encrypted: refreshToken ? Buffer.from(refreshToken).toString('base64') : null,
      expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      last_connected: new Date().toISOString(),
    };

    // Store page-specific data for Facebook
    if (pageId) {
      connectionData.page_id = pageId;
    }
    if (pageAccessToken) {
      connectionData.page_access_token_encrypted = Buffer.from(pageAccessToken).toString('base64');
    }

    console.log(`Saving ${platform} connection for user ${user.id}, username: ${connectionData.username}`);

    const { error: upsertError } = await adminClient
      .from('social_platform_connections')
      .upsert(connectionData, {
        onConflict: 'user_id,platform',
      });

    if (upsertError) {
      console.error(`Failed to save connection for ${platform}:`, JSON.stringify(upsertError));
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=save_failed&detail=${encodeURIComponent(upsertError.message)}&platform=${platform}`, request.url)
      );
    }

    console.log(`OAuth connection saved for ${platform} — user: ${username}`);

    // Success!
    return NextResponse.redirect(
      new URL(`${redirectBase}?success=connected&platform=${platform}`, request.url)
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/dashboard/content-multiplier?error=callback_error&platform=${resolvedParams.platform}`, request.url)
    );
  }
}
