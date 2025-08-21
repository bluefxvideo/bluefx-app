import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { handleOAuthCallback } from '@/actions/auth/social-oauth';
import type { SocialPlatform } from '@/components/content-multiplier/store/content-multiplier-store';

/**
 * OAuth Callback Handler for Social Media Platforms
 * Handles callbacks from Twitter, Instagram, TikTok, LinkedIn, and Facebook
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const resolvedParams = await params;
    const platform = resolvedParams.platform as SocialPlatform;
    const { searchParams } = new URL(request.url);
    
    // Extract OAuth parameters
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error(`OAuth error for ${platform}:`, error, errorDescription);
      return NextResponse.redirect(
        new URL(`/dashboard/content-multiplier?error=${encodeURIComponent(error)}&platform=${platform}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`/dashboard/content-multiplier?error=missing_parameters&platform=${platform}`, request.url)
      );
    }

    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.redirect(
        new URL(`/login?error=unauthorized&platform=${platform}`, request.url)
      );
    }

    // Handle OAuth callback
    const result = await handleOAuthCallback(platform, code, state, user.id);
    
    if (!result.success) {
      console.error(`OAuth callback failed for ${platform}:`, result.error);
      return NextResponse.redirect(
        new URL(`/dashboard/content-multiplier?error=${encodeURIComponent(result.error || 'oauth_failed')}&platform=${platform}`, request.url)
      );
    }

    // Success - redirect based on platform
    if (platform === 'google_docs') {
      return NextResponse.redirect(
        new URL(`/dashboard/ebook-writer/export?success=connected&platform=${platform}`, request.url)
      );
    } else {
      return NextResponse.redirect(
        new URL(`/dashboard/content-multiplier?success=connected&platform=${platform}`, request.url)
      );
    }

  } catch (error) {
    console.error('OAuth callback error:', error);
    const resolvedParams = await params;
    return NextResponse.redirect(
      new URL(`/dashboard/content-multiplier?error=callback_error&platform=${resolvedParams.platform}`, request.url)
    );
  }
}

// Handle POST requests (some platforms might use POST)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const resolvedParams = await params;
    const platform = resolvedParams.platform as SocialPlatform;
    const body = await request.json();
    
    // Extract OAuth parameters from body
    const { code, state, error, error_description } = body;

    // Handle OAuth errors
    if (error) {
      console.error(`OAuth POST error for ${platform}:`, error, error_description);
      return NextResponse.json({ 
        success: false, 
        error: error_description || error 
      }, { status: 400 });
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }

    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Handle OAuth callback
    const result = await handleOAuthCallback(platform, code, state, user.id);
    
    if (!result.success) {
      console.error(`OAuth POST callback failed for ${platform}:`, result.error);
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 400 });
    }

    // Return success response
    return NextResponse.json({
      success: true,
      connection: result.connection,
      message: `Successfully connected to ${platform}`,
    });

  } catch (error) {
    console.error('OAuth POST callback error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}