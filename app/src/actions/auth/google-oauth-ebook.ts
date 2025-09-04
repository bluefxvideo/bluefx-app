'use server';

/**
 * Google OAuth for Ebook Writer Export
 * Direct connection flow for Google Docs export
 */

export async function initiateGoogleOAuth(): Promise<{
  success: boolean;
  authUrl?: string;
  error?: string;
}> {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/v1/callback`;
    
    // Debug logging
    console.log('Google OAuth Debug:', {
      clientId: clientId ? `${clientId.slice(0, 10)}...` : 'NOT SET',
      redirectUri,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL
    });
    
    if (!clientId) {
      throw new Error('Google OAuth client ID not configured');
    }
    
    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      throw new Error('NEXT_PUBLIC_SITE_URL not configured');
    }

    // Required scopes for Google Docs and Drive
    const scopes = [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
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
    authUrl.searchParams.set('state', 'ebook_export');

    return {
      success: true,
      authUrl: authUrl.toString()
    };

  } catch (error) {
    console.error('Failed to initiate Google OAuth:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate OAuth'
    };
  }
}

/**
 * Check if Google OAuth environment variables are configured
 */
export async function checkGoogleOAuthConfig(): Promise<{
  isConfigured: boolean;
  missingVars?: string[];
}> {
  const requiredVars = [
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'NEXT_PUBLIC_SITE_URL'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  return {
    isConfigured: missingVars.length === 0,
    missingVars: missingVars.length > 0 ? missingVars : undefined
  };
}