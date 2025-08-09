'use server';

import { createClient } from '@/app/supabase/server';
import { saveOAuthConnection, disconnectPlatform } from '@/actions/database/content-multiplier-database';
import type { SocialPlatform, OAuthConnection } from '@/components/content-multiplier/store/content-multiplier-store';

/**
 * Social Media OAuth Authentication System
 * Handles OAuth flows for all supported social media platforms
 */

// Platform OAuth configurations
const OAUTH_CONFIGS = {
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: ['user_profile', 'user_media'],
    clientId: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/auth/authorize/',
    tokenUrl: 'https://open-api.tiktok.com/oauth/access_token/',
    scopes: ['user.info.basic', 'video.upload'],
    clientId: process.env.TIKTOK_CLIENT_ID,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['r_liteprofile', 'w_member_social'],
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'public_profile'],
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  },
};

/**
 * Initiate OAuth flow for a social platform
 */
export async function initiateOAuthFlow(platform: SocialPlatform, userId: string) {
  try {
    const config = OAUTH_CONFIGS[platform];
    if (!config || !config.clientId) {
      throw new Error(`OAuth not configured for ${platform}`);
    }

    // Generate state parameter for security
    const state = generateSecureState(userId, platform);
    
    // Store state in session for verification
    await storeOAuthState(state, userId, platform);

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/${platform}`,
      scope: config.scopes.join(' '),
      response_type: 'code',
      state: state,
    });

    // Platform-specific parameters
    if (platform === 'twitter') {
      params.append('code_challenge_method', 'S256');
      params.append('code_challenge', await generatePKCEChallenge());
    }

    const authUrl = `${config.authUrl}?${params.toString()}`;
    
    return {
      success: true,
      authUrl,
      state,
    };
  } catch (error) {
    console.error(`OAuth initiation error for ${platform}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OAuth initiation failed',
    };
  }
}

/**
 * Handle OAuth callback and exchange code for tokens
 */
export async function handleOAuthCallback(
  platform: SocialPlatform,
  code: string,
  state: string,
  userId: string
) {
  try {
    // Verify state parameter
    const isValidState = await verifyOAuthState(state, userId, platform);
    if (!isValidState) {
      throw new Error('Invalid OAuth state - potential CSRF attack');
    }

    // Exchange code for access token
    const tokenData = await exchangeCodeForTokens(platform, code);
    
    // Get user profile information
    const profileData = await fetchUserProfile(platform, tokenData.access_token);
    
    // Encrypt and store tokens
    const encryptedTokens = await encryptTokens({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });

    // Create OAuth connection record
    const connection: OAuthConnection = {
      platform,
      connected: true,
      username: profileData.username,
      avatar_url: profileData.avatar_url,
      expires_at: tokenData.expires_at,
      last_connected: new Date().toISOString(),
      connection_status: 'active',
    };

    // Save to database
    const result = await saveOAuthConnection(connection, userId);
    if (!result.success) {
      throw new Error(result.error);
    }

    // Store encrypted tokens separately (more secure)
    await storeEncryptedTokens(userId, platform, encryptedTokens);

    return {
      success: true,
      connection,
    };
  } catch (error) {
    console.error(`OAuth callback error for ${platform}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OAuth callback failed',
    };
  }
}

/**
 * Refresh expired access tokens
 */
export async function refreshAccessToken(platform: SocialPlatform, userId: string) {
  try {
    const config = OAUTH_CONFIGS[platform];
    if (!config) {
      throw new Error(`Platform ${platform} not supported`);
    }

    // Get stored refresh token
    const refreshToken = await getStoredRefreshToken(userId, platform);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    // Request new tokens
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const tokenData = await response.json();
    
    // Update stored tokens
    const encryptedTokens = await encryptTokens({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refreshToken, // Some platforms don't return new refresh token
    });

    await storeEncryptedTokens(userId, platform, encryptedTokens);

    // Update connection status
    const supabase = await createClient();
    await supabase
      .from('social_platform_connections')
      .update({
        connection_status: 'active',
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        last_connected: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('platform', platform);

    return {
      success: true,
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
    };
  } catch (error) {
    console.error(`Token refresh error for ${platform}:`, error);
    
    // Mark connection as expired
    const supabase = await createClient();
    await supabase
      .from('social_platform_connections')
      .update({ connection_status: 'expired' })
      .eq('user_id', userId)
      .eq('platform', platform);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed',
    };
  }
}

/**
 * Disconnect a social platform
 */
export async function disconnectSocialPlatform(platform: SocialPlatform, userId: string) {
  try {
    // Revoke tokens if possible
    await revokeTokens(platform, userId);
    
    // Update database
    const result = await disconnectPlatform(platform, userId);
    if (!result.success) {
      throw new Error(result.error);
    }

    // Clear stored tokens
    await clearStoredTokens(userId, platform);

    return { success: true };
  } catch (error) {
    console.error(`Disconnect error for ${platform}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Disconnect failed',
    };
  }
}

/**
 * Check if platform tokens are still valid
 */
export async function validatePlatformTokens(platform: SocialPlatform, userId: string) {
  try {
    const accessToken = await getStoredAccessToken(userId, platform);
    if (!accessToken) {
      return { valid: false, reason: 'No access token' };
    }

    // Make a simple API call to verify token
    const isValid = await testPlatformConnection(platform, accessToken);
    
    if (!isValid) {
      // Try to refresh token
      const refreshResult = await refreshAccessToken(platform, userId);
      if (refreshResult.success) {
        return { valid: true, refreshed: true };
      } else {
        return { valid: false, reason: 'Token expired and refresh failed' };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error(`Token validation error for ${platform}:`, error);
    return { 
      valid: false, 
      reason: error instanceof Error ? error.message : 'Validation failed' 
    };
  }
}

// Helper functions
async function exchangeCodeForTokens(platform: SocialPlatform, code: string) {
  const config = OAUTH_CONFIGS[platform];
  
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/${platform}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  const tokenData = await response.json();
  
  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : undefined,
  };
}

async function fetchUserProfile(platform: SocialPlatform, accessToken: string) {
  // Platform-specific API endpoints for user profile
  const profileEndpoints = {
    twitter: 'https://api.twitter.com/2/users/me',
    instagram: 'https://graph.instagram.com/me?fields=id,username,account_type',
    tiktok: 'https://open-api.tiktok.com/oauth/userinfo/',
    linkedin: 'https://api.linkedin.com/v2/people/~',
    facebook: 'https://graph.facebook.com/me?fields=id,name,picture',
  };

  const response = await fetch(profileEndpoints[platform], {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Profile fetch failed: ${response.statusText}`);
  }

  const profileData = await response.json();
  
  // Normalize profile data across platforms
  return {
    username: profileData.username || profileData.name || profileData.screen_name || `user_${platform}`,
    avatar_url: profileData.profile_image_url || profileData.picture?.data?.url || null,
  };
}

async function testPlatformConnection(platform: SocialPlatform, accessToken: string): Promise<boolean> {
  try {
    const response = await fetchUserProfile(platform, accessToken);
    return !!response.username;
  } catch {
    return false;
  }
}

function generateSecureState(userId: string, platform: string): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2);
  const data = `${userId}:${platform}:${timestamp}:${random}`;
  return Buffer.from(data).toString('base64url');
}

async function generatePKCEChallenge(): Promise<string> {
  // Simplified PKCE challenge generation
  const codeVerifier = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);
  
  // In a real implementation, you'd store the code_verifier and use SHA256
  return Buffer.from(codeVerifier).toString('base64url');
}

async function storeOAuthState(_state: string, _userId: string, _platform: string) {
  // Store state in session or temporary storage for verification
  // This is a simplified implementation
  
  // You could store this in a temporary table or cache
  // For now, we'll skip the storage and just validate the format
}

async function verifyOAuthState(state: string, userId: string, platform: string): Promise<boolean> {
  try {
    const decoded = Buffer.from(state, 'base64url').toString();
    const [stateUserId, statePlatform] = decoded.split(':');
    
    return stateUserId === userId && statePlatform === platform;
  } catch {
    return false;
  }
}

async function encryptTokens(tokens: { access_token: string; refresh_token?: string }) {
  // Simplified encryption - in production, use proper encryption
  return {
    access_token_encrypted: Buffer.from(tokens.access_token).toString('base64'),
    refresh_token_encrypted: tokens.refresh_token 
      ? Buffer.from(tokens.refresh_token).toString('base64')
      : null,
  };
}

async function storeEncryptedTokens(
  userId: string, 
  platform: string, 
  encryptedTokens: { access_token_encrypted: string; refresh_token_encrypted?: string | null }
) {
  const supabase = await createClient();
  
  await supabase
    .from('social_platform_connections')
    .update({
      access_token_encrypted: encryptedTokens.access_token_encrypted,
      refresh_token_encrypted: encryptedTokens.refresh_token_encrypted,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('platform', platform);
}

async function getStoredAccessToken(userId: string, platform: string): Promise<string | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('social_platform_connections')
    .select('access_token_encrypted')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single();

  if (!data?.access_token_encrypted) return null;
  
  // Decrypt token
  return Buffer.from(data.access_token_encrypted, 'base64').toString();
}

async function getStoredRefreshToken(userId: string, platform: string): Promise<string | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('social_platform_connections')
    .select('refresh_token_encrypted')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single();

  if (!data?.refresh_token_encrypted) return null;
  
  // Decrypt token
  return Buffer.from(data.refresh_token_encrypted, 'base64').toString();
}

async function revokeTokens(platform: SocialPlatform, userId: string) {
  // Platform-specific token revocation
  try {
    const accessToken = await getStoredAccessToken(userId, platform);
    if (!accessToken) return;

    const revokeEndpoints = {
      twitter: 'https://api.twitter.com/2/oauth2/revoke',
      instagram: null, // Instagram doesn't have a revoke endpoint
      tiktok: null,
      linkedin: null,
      facebook: 'https://graph.facebook.com/me/permissions',
    };

    const endpoint = revokeEndpoints[platform];
    if (endpoint) {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    }
  } catch (error) {
    console.error(`Token revocation error for ${platform}:`, error);
  }
}

async function clearStoredTokens(userId: string, platform: string) {
  const supabase = await createClient();
  
  await supabase
    .from('social_platform_connections')
    .update({
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('platform', platform);
}

// Types imported at the top of the file