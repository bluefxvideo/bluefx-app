import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
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

    // Handle OAuth callback directly (inline to avoid server action issues)
    try {
      // For now, just create a simple success response
      // TODO: Implement platform-specific OAuth handling here instead of using server action
      console.log(`OAuth callback received for ${platform} with code:`, code.substring(0, 10) + '...');
      
      // Simple success for now - you can implement the full OAuth logic here later
    } catch (callbackError) {
      console.error(`OAuth callback failed for ${platform}:`, callbackError);
      return NextResponse.redirect(
        new URL(`/dashboard/content-multiplier?error=oauth_callback_failed&platform=${platform}`, request.url)
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

    // Handle OAuth callback directly (inline to avoid server action issues)
    try {
      // For now, just create a simple success response
      // TODO: Implement platform-specific OAuth handling here instead of using server action
      console.log(`OAuth POST callback received for ${platform} with code:`, code.substring(0, 10) + '...');
      
      // Return success response
      return NextResponse.json({
        success: true,
        message: `OAuth callback received for ${platform}`,
      });
    } catch (callbackError) {
      console.error(`OAuth POST callback failed for ${platform}:`, callbackError);
      return NextResponse.json({ 
        success: false, 
        error: 'OAuth callback processing failed' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('OAuth POST callback error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}