'use server';

import { createClient } from '@/app/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export interface WordPressPostParams {
  title: string;
  content: string; // HTML content
  excerpt?: string;
  status: 'publish' | 'draft';
  categories?: string[]; // Category names
  tags?: string[]; // Tag names
  featuredImageUrl?: string; // URL to download and set as featured image
  yoastMeta?: {
    seoTitle: string;
    metaDescription: string;
    focusKeyphrase: string;
  };
}

export interface WordPressPostResult {
  success: boolean;
  postId?: number;
  postUrl?: string;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get WordPress credentials from database
 */
async function getWordPressCredentials(userId: string): Promise<{
  siteUrl: string;
  username: string;
  password: string;
} | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('social_platform_connections')
    .select('username, access_token_encrypted')
    .eq('user_id', userId)
    .eq('platform', 'wordpress')
    .eq('connection_status', 'active')
    .single();

  if (error || !data) return null;

  // Credentials stored as JSON { username, password } in access_token_encrypted
  const decoded = Buffer.from(data.access_token_encrypted || '', 'base64').toString('utf-8');
  try {
    const creds = JSON.parse(decoded);
    return {
      siteUrl: data.username || '',
      username: creds.username || '',
      password: creds.password || '',
    };
  } catch {
    // Fallback for old format (plain password)
    return {
      siteUrl: data.username || '',
      username: '',
      password: decoded,
    };
  }
}

/**
 * Make authenticated request to WordPress REST API
 */
async function wpFetch(
  siteUrl: string,
  path: string,
  options: RequestInit & { credentials_base64: string }
): Promise<Response> {
  const { credentials_base64, ...fetchOptions } = options;

  return fetch(`${siteUrl}/wp-json${path}`, {
    ...fetchOptions,
    headers: {
      'Authorization': `Basic ${credentials_base64}`,
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });
}

/**
 * Upload a featured image from URL to WordPress media library
 */
async function uploadFeaturedImage(
  siteUrl: string,
  credentials_base64: string,
  imageUrl: string,
  altText: string
): Promise<number | null> {
  try {
    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) return null;

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const filename = `featured-${Date.now()}.${ext}`;

    // Upload to WordPress media library
    const uploadResponse = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials_base64}`,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': contentType,
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      console.error('WordPress media upload failed:', uploadResponse.status);
      return null;
    }

    const mediaData = await uploadResponse.json();

    // Set alt text
    if (mediaData.id && altText) {
      await fetch(`${siteUrl}/wp-json/wp/v2/media/${mediaData.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials_base64}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alt_text: altText }),
      });
    }

    return mediaData.id;
  } catch (error) {
    console.error('Featured image upload error:', error);
    return null;
  }
}

/**
 * Find or create WordPress categories/tags by name
 */
async function findOrCreateTerms(
  siteUrl: string,
  credentials_base64: string,
  names: string[],
  taxonomy: 'categories' | 'tags'
): Promise<number[]> {
  const ids: number[] = [];

  for (const name of names) {
    try {
      // Search for existing term
      const searchResponse = await wpFetch(siteUrl, `/wp/v2/${taxonomy}?search=${encodeURIComponent(name)}`, {
        method: 'GET',
        credentials_base64,
      });

      if (searchResponse.ok) {
        const terms = await searchResponse.json();
        const exactMatch = terms.find((t: { name: string }) =>
          t.name.toLowerCase() === name.toLowerCase()
        );

        if (exactMatch) {
          ids.push(exactMatch.id);
          continue;
        }
      }

      // Create new term
      const createResponse = await wpFetch(siteUrl, `/wp/v2/${taxonomy}`, {
        method: 'POST',
        credentials_base64,
        body: JSON.stringify({ name }),
      });

      if (createResponse.ok) {
        const newTerm = await createResponse.json();
        ids.push(newTerm.id);
      }
    } catch {
      // Skip terms that fail
    }
  }

  return ids;
}

// ============================================================================
// MAIN ACTION: POST TO WORDPRESS
// ============================================================================

/**
 * Publishes a blog post to WordPress with Yoast SEO metadata
 */
export async function postToWordPress(params: WordPressPostParams): Promise<WordPressPostResult> {
  try {
    // Authenticate
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get WordPress credentials
    const credentials = await getWordPressCredentials(user.id);
    if (!credentials) {
      return { success: false, error: 'WordPress is not connected. Please set up your WordPress connection first.' };
    }

    const { siteUrl, username, password } = credentials;
    const credentials_base64 = Buffer.from(`${username}:${password}`).toString('base64');

    console.log('Publishing to WordPress:', siteUrl);

    // Upload featured image if provided
    let featuredMediaId: number | undefined;
    if (params.featuredImageUrl) {
      console.log('Uploading featured image...');
      const mediaId = await uploadFeaturedImage(
        siteUrl,
        credentials_base64,
        params.featuredImageUrl,
        params.title
      );
      if (mediaId) featuredMediaId = mediaId;
    }

    // Find or create categories and tags
    let categoryIds: number[] = [];
    let tagIds: number[] = [];

    if (params.categories?.length) {
      categoryIds = await findOrCreateTerms(siteUrl, credentials_base64, params.categories, 'categories');
    }
    if (params.tags?.length) {
      tagIds = await findOrCreateTerms(siteUrl, credentials_base64, params.tags, 'tags');
    }

    // Build post body
    const postBody: Record<string, unknown> = {
      title: params.title,
      content: params.content,
      status: params.status,
    };

    if (params.excerpt) postBody.excerpt = params.excerpt;
    if (featuredMediaId) postBody.featured_media = featuredMediaId;
    if (categoryIds.length) postBody.categories = categoryIds;
    if (tagIds.length) postBody.tags = tagIds;

    // Add Yoast SEO meta if provided
    if (params.yoastMeta) {
      postBody.meta = {
        _yoast_wpseo_title: params.yoastMeta.seoTitle,
        _yoast_wpseo_metadesc: params.yoastMeta.metaDescription,
        _yoast_wpseo_focuskw: params.yoastMeta.focusKeyphrase,
      };
    }

    // Create the post
    const response = await wpFetch(siteUrl, '/wp/v2/posts', {
      method: 'POST',
      credentials_base64,
      body: JSON.stringify(postBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `HTTP ${response.status}`;

      // If Yoast meta fields aren't registered, try without them
      if (errorMessage.includes('meta') && params.yoastMeta) {
        console.log('Yoast meta fields not registered, posting without SEO meta...');
        delete postBody.meta;

        const retryResponse = await wpFetch(siteUrl, '/wp/v2/posts', {
          method: 'POST',
          credentials_base64,
          body: JSON.stringify(postBody),
        });

        if (retryResponse.ok) {
          const postData = await retryResponse.json();

          // Try to update Yoast meta separately
          await updateYoastMeta(siteUrl, credentials_base64, postData.id, params.yoastMeta);

          return {
            success: true,
            postId: postData.id,
            postUrl: postData.link,
          };
        }

        return { success: false, error: `WordPress publish failed: ${errorMessage}` };
      }

      return { success: false, error: `WordPress publish failed: ${errorMessage}` };
    }

    const postData = await response.json();
    console.log('WordPress post published:', postData.id, postData.link);

    return {
      success: true,
      postId: postData.id,
      postUrl: postData.link,
    };
  } catch (error) {
    console.error('WordPress posting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to publish to WordPress',
    };
  }
}

/**
 * Try to update Yoast meta via direct post meta update
 */
async function updateYoastMeta(
  siteUrl: string,
  credentials_base64: string,
  postId: number,
  yoastMeta: { seoTitle: string; metaDescription: string; focusKeyphrase: string }
): Promise<void> {
  try {
    // Try Yoast REST API endpoint first
    const yoastResponse = await wpFetch(siteUrl, `/yoast/v1/meta/post/${postId}`, {
      method: 'PATCH',
      credentials_base64,
      body: JSON.stringify({
        yoast_wpseo_title: yoastMeta.seoTitle,
        yoast_wpseo_metadesc: yoastMeta.metaDescription,
        yoast_wpseo_focuskw: yoastMeta.focusKeyphrase,
      }),
    });

    if (yoastResponse.ok) {
      console.log('Yoast meta updated via Yoast API');
      return;
    }

    // Fallback: update via standard post meta
    await wpFetch(siteUrl, `/wp/v2/posts/${postId}`, {
      method: 'POST',
      credentials_base64,
      body: JSON.stringify({
        meta: {
          _yoast_wpseo_title: yoastMeta.seoTitle,
          _yoast_wpseo_metadesc: yoastMeta.metaDescription,
          _yoast_wpseo_focuskw: yoastMeta.focusKeyphrase,
        },
      }),
    });

    console.log('Yoast meta updated via post meta');
  } catch (error) {
    console.error('Failed to update Yoast meta (non-critical):', error);
    // Non-critical — post was created successfully even without Yoast meta
  }
}
