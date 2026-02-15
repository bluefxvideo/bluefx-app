'use server';

import { createClient, createAdminClient } from '@/app/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export interface WordPressConnection {
  siteUrl: string;
  username: string;
  connected: boolean;
}

// ============================================================================
// TEST CONNECTION
// ============================================================================

/**
 * Tests a WordPress connection by calling the REST API users/me endpoint
 */
export async function testWordPressConnection(
  siteUrl: string,
  username: string,
  applicationPassword: string
): Promise<{ success: boolean; siteName?: string; error?: string }> {
  try {
    // Normalize site URL — strip trailing slashes, /wp-admin, /wp-admin/
    let normalizedUrl = siteUrl.trim().replace(/\/+$/, '');
    normalizedUrl = normalizedUrl.replace(/\/wp-admin\/?$/, '');
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');

    // Base64 encode credentials for Basic Auth
    const credentials = Buffer.from(`${username}:${applicationPassword}`).toString('base64');

    const response = await fetch(`${normalizedUrl}/wp-json/wp/v2/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BlueFX/1.0 (WordPress Integration)',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Invalid credentials. Check your username and application password.' };
      }
      if (response.status === 404) {
        return { success: false, error: 'WordPress REST API not found. Make sure the site URL is correct and REST API is enabled.' };
      }
      if (response.status === 403) {
        const errorText = await response.text();
        if (errorText.includes('sucuri') || errorText.includes('firewall')) {
          return { success: false, error: 'Blocked by Sucuri firewall. You need to whitelist this server\'s IP in Sucuri settings (Sucuri > Settings > Access Control > Whitelist IP).' };
        }
        return { success: false, error: 'Access forbidden (403). Your firewall may be blocking API requests. Check Sucuri/Cloudflare settings.' };
      }
      const errorText = await response.text();
      // Don't show raw HTML in error messages
      const cleanError = errorText.includes('<') ? 'Server returned an HTML error page' : errorText.substring(0, 200);
      return { success: false, error: `Connection failed (${response.status}): ${cleanError}` };
    }

    const userData = await response.json();

    // Also get site name
    let siteName = normalizedUrl;
    try {
      const siteResponse = await fetch(`${normalizedUrl}/wp-json`, {
        headers: { 'Authorization': `Basic ${credentials}` },
      });
      if (siteResponse.ok) {
        const siteData = await siteResponse.json();
        siteName = siteData.name || normalizedUrl;
      }
    } catch {
      // Site name is optional
    }

    console.log('WordPress connection test successful. User:', userData.name);
    return { success: true, siteName };
  } catch (error) {
    console.error('WordPress connection test error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { success: false, error: 'Could not reach the WordPress site. Check the URL.' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    };
  }
}

// ============================================================================
// SAVE CONNECTION
// ============================================================================

/**
 * Saves WordPress connection credentials to the database
 */
export async function saveWordPressConnection(
  siteUrl: string,
  username: string,
  applicationPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const normalizedUrl = siteUrl.replace(/\/+$/, '');

    // Store WP username + password together as JSON in access_token_encrypted
    const credentials = JSON.stringify({ username, password: applicationPassword });
    const encryptedCredentials = Buffer.from(credentials).toString('base64');

    // Use admin client to bypass RLS (same pattern as OAuth callback)
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('social_platform_connections')
      .upsert({
        user_id: user.id,
        platform: 'wordpress',
        username: normalizedUrl, // Store site URL in username field
        access_token_encrypted: encryptedCredentials,
        connection_status: 'active',
        last_connected: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform',
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Save WordPress connection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save connection',
    };
  }
}

// ============================================================================
// GET CONNECTION
// ============================================================================

/**
 * Gets the saved WordPress connection for the current user
 */
export async function getWordPressConnection(): Promise<{
  success: boolean;
  connection?: WordPressConnection;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('social_platform_connections')
      .select('username, connection_status')
      .eq('user_id', user.id)
      .eq('platform', 'wordpress')
      .single();

    if (error || !data) {
      return { success: true, connection: undefined }; // No connection yet, not an error
    }

    return {
      success: true,
      connection: {
        siteUrl: data.username || '',
        username: '', // WP username stored in access_token_encrypted JSON
        connected: data.connection_status === 'active',
      },
    };
  } catch (error) {
    console.error('Get WordPress connection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get connection',
    };
  }
}

// ============================================================================
// DELETE CONNECTION
// ============================================================================

/**
 * Removes the WordPress connection for the current user
 */
export async function deleteWordPressConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('social_platform_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', 'wordpress');

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Delete WordPress connection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete connection',
    };
  }
}
