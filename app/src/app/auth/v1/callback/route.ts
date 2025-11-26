import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/app/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth error
    if (error) {
      console.error('OAuth error:', error);
      
      // Route error based on state
      if (state === 'ebook_export') {
        return NextResponse.redirect(
          new URL('/dashboard/ebook-writer/export?error=oauth_failed', process.env.NEXT_PUBLIC_SITE_URL || request.url)
        );
      }
      
      // Default Supabase error handling
      return NextResponse.redirect(
        new URL(`/auth/error?message=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Handle missing code
    if (!code) {
      console.error('No authorization code received');
      
      if (state === 'ebook_export') {
        return NextResponse.redirect(
          new URL('/dashboard/ebook-writer/export?error=no_code', process.env.NEXT_PUBLIC_SITE_URL || request.url)
        );
      }
      
      return NextResponse.redirect(
        new URL('/auth/error?message=No authorization code provided', request.url)
      );
    }

    // Handle ebook Google OAuth (direct Google API flow)
    if (state === 'ebook_export') {
      return await handleEbookGoogleOAuth(request, code);
    }

    // Handle YouTube OAuth for Content Multiplier
    if (state === 'youtube_connect') {
      return await handleYouTubeOAuth(request, code);
    }

    // Handle Supabase OAuth (default behavior)
    return await handleSupabaseOAuth(request, code);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/auth/error?message=Unexpected error occurred', request.url)
    );
  }
}

/**
 * Handle ebook-specific Google OAuth (direct API calls)
 */
async function handleEbookGoogleOAuth(request: NextRequest, code: string) {
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/v1/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/dashboard/ebook-writer/export?error=token_failed', process.env.NEXT_PUBLIC_SITE_URL || request.url)
      );
    }

    const tokens = await tokenResponse.json();
    
    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info');
      return NextResponse.redirect(
        new URL('/dashboard/ebook-writer/export?error=user_info_failed', process.env.NEXT_PUBLIC_SITE_URL || request.url)
      );
    }

    const userInfo = await userInfoResponse.json();

    // Store connection in Supabase
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('User not authenticated:', authError);
      return NextResponse.redirect(
        new URL('/dashboard/ebook-writer/export?error=not_authenticated', process.env.NEXT_PUBLIC_SITE_URL || request.url)
      );
    }

    // Store the Google connection
    const { error: insertError } = await supabase
      .from('social_platform_connections')
      .upsert({
        user_id: user.id,
        platform: 'google',
        username: userInfo.email,
        connection_status: 'active',
        connected: true,
        access_token_encrypted: Buffer.from(tokens.access_token).toString('base64'),
        refresh_token_encrypted: tokens.refresh_token ? 
          Buffer.from(tokens.refresh_token).toString('base64') : null,
        expires_at: tokens.expires_in ? 
          new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
        last_connected: new Date().toISOString()
      }, {
        onConflict: 'user_id,platform'
      });

    if (insertError) {
      console.error('Failed to store connection:', insertError);
      return NextResponse.redirect(
        new URL('/dashboard/ebook-writer/export?error=storage_failed', process.env.NEXT_PUBLIC_SITE_URL || request.url)
      );
    }

    // Success - redirect back to export page
    return NextResponse.redirect(
      new URL('/dashboard/ebook-writer/export?connected=true', process.env.NEXT_PUBLIC_SITE_URL || request.url)
    );

  } catch (error) {
    console.error('Ebook Google OAuth error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/ebook-writer/export?error=unexpected', process.env.NEXT_PUBLIC_SITE_URL || request.url)
    );
  }
}

/**
 * Handle YouTube OAuth for Content Multiplier
 */
async function handleYouTubeOAuth(request: NextRequest, code: string) {
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/v1/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('YouTube token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/dashboard/content-multiplier?error=oauth_failed&platform=youtube', process.env.NEXT_PUBLIC_SITE_URL || request.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Get YouTube channel info
    const channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let channelName = 'YouTube User';
    let avatarUrl = null;

    if (channelResponse.ok) {
      const channelData = await channelResponse.json();
      if (channelData.items && channelData.items.length > 0) {
        channelName = channelData.items[0].snippet.title;
        avatarUrl = channelData.items[0].snippet.thumbnails?.default?.url;
      }
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('User not authenticated:', authError);
      return NextResponse.redirect(
        new URL('/dashboard/content-multiplier?error=unauthorized&platform=youtube', process.env.NEXT_PUBLIC_SITE_URL || request.url)
      );
    }

    // Use admin client for database insert to bypass RLS
    const adminClient = createAdminClient();

    // Store the YouTube connection
    const { error: insertError } = await adminClient
      .from('social_platform_connections')
      .upsert({
        user_id: user.id,
        platform: 'youtube',
        username: channelName,
        avatar_url: avatarUrl,
        connection_status: 'active',
        connected: true,
        access_token_encrypted: Buffer.from(tokens.access_token).toString('base64'),
        refresh_token_encrypted: tokens.refresh_token
          ? Buffer.from(tokens.refresh_token).toString('base64')
          : null,
        expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        last_connected: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      });

    if (insertError) {
      console.error('Failed to store YouTube connection:', insertError);
      return NextResponse.redirect(
        new URL('/dashboard/content-multiplier?error=callback_error&platform=youtube', process.env.NEXT_PUBLIC_SITE_URL || request.url)
      );
    }

    // Success - redirect back to content multiplier
    return NextResponse.redirect(
      new URL('/dashboard/content-multiplier?success=connected&platform=youtube', process.env.NEXT_PUBLIC_SITE_URL || request.url)
    );

  } catch (error) {
    console.error('YouTube OAuth error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/content-multiplier?error=callback_error&platform=youtube', process.env.NEXT_PUBLIC_SITE_URL || request.url)
    );
  }
}

/**
 * Handle Supabase OAuth (original behavior)
 */
async function handleSupabaseOAuth(request: NextRequest, code: string) {
  try {
    const { origin } = new URL(request.url);
    const supabase = await createClient();
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
    
    if (data.session && data.user) {
      // Get the provider information from the session
      const provider = data.user.app_metadata?.provider;
      const providerToken = data.session.provider_token;
      
      console.log('OAuth success:', {
        provider,
        userId: data.user.id,
        email: data.user.email,
        hasProviderToken: !!providerToken,
      });
      
      // Redirect back to content multiplier with success
      return NextResponse.redirect(`${origin}/dashboard/content-multiplier?connected=${provider}`);
    }
    
    return NextResponse.redirect(`${origin}/auth/error?message=Session creation failed`);
    
  } catch (error) {
    console.error('Supabase OAuth error:', error);
    return NextResponse.redirect(
      new URL('/auth/error?message=Unexpected error occurred', request.url)
    );
  }
}