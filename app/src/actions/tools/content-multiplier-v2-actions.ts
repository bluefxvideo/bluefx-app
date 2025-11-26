'use server';

import { createClient } from '@/app/supabase/server';
import OpenAI from 'openai';
import type {
  SocialPlatform,
  PlatformGeneratedContent,
  ScheduledPost,
  SocialAccount,
  PLATFORM_CONFIGS,
} from '@/components/content-multiplier/store/content-multiplier-v2-store';

// ============================================================================
// OPENAI CLIENT
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// PLATFORM CONTENT GENERATION
// ============================================================================

const PLATFORM_PROMPTS: Record<SocialPlatform, string> = {
  tiktok: `You are a TikTok content expert. Create engaging, viral-worthy content.
- Keep captions short and punchy (under 150 chars ideal)
- Use trending hashtags and include #fyp
- Start with a hook that grabs attention
- Use casual, Gen-Z friendly language
- Add relevant emojis sparingly`,

  instagram: `You are an Instagram content strategist. Create visually-focused captions.
- Write engaging captions that complement video content
- Include a strong call-to-action
- Use line breaks for readability
- Mix popular and niche hashtags
- Keep hashtags relevant and not spammy`,

  youtube: `You are a YouTube SEO expert. Create content optimized for discovery.
- Write compelling titles (under 60 chars) with keywords
- Create detailed descriptions with timestamps if relevant
- Include relevant tags for SEO
- Add calls to subscribe and engage
- Front-load important keywords`,

  twitter: `You are a Twitter/X engagement specialist. Create concise, shareable content.
- Keep tweets punchy and under 280 characters
- Use 1-3 relevant hashtags maximum
- Create urgency or curiosity
- Make it retweetable
- Use conversational tone`,

  linkedin: `You are a LinkedIn professional content creator. Create business-appropriate content.
- Write in a professional but engaging tone
- Include industry insights or takeaways
- Use storytelling when appropriate
- Add 3-5 relevant professional hashtags
- Include a thought-provoking question or CTA`,

  facebook: `You are a Facebook content creator. Create shareable, community-focused content.
- Write in a friendly, conversational tone
- Encourage comments and shares
- Keep it relatable and authentic
- Use 1-3 hashtags maximum
- Include a question to drive engagement`,
};

export async function generatePlatformContentV2(
  platform: SocialPlatform,
  sourceContent: string
): Promise<{ success: boolean; content?: PlatformGeneratedContent; error?: string }> {
  try {
    const systemPrompt = PLATFORM_PROMPTS[platform];

    const userPrompt = `Based on this content/transcript, create an optimized ${platform} post:

---
${sourceContent}
---

Respond in JSON format:
{
  "caption": "the main caption/post text",
  "hashtags": ["hashtag1", "hashtag2", ...],
  ${platform === 'youtube' ? '"title": "video title",' : ''}
  ${platform === 'youtube' ? '"description": "full video description",' : ''}
  ${platform === 'youtube' ? '"tags": ["tag1", "tag2", ...],' : ''}
}

Important:
- Caption should be platform-optimized and engaging
- Hashtags should NOT include the # symbol
- ${platform === 'youtube' ? 'Title should be under 100 chars, description should be detailed' : ''}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const responseText = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(responseText);

    const content: PlatformGeneratedContent = {
      platform,
      caption: parsed.caption || '',
      hashtags: (parsed.hashtags || []).map((h: string) => h.replace(/^#/, '')),
      title: parsed.title,
      description: parsed.description,
      tags: parsed.tags,
      characterCount: (parsed.caption || '').length,
      isApproved: false,
      isEdited: false,
    };

    return { success: true, content };

  } catch (error) {
    console.error(`Content generation error for ${platform}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}

// ============================================================================
// SCHEDULED POSTS CRUD
// ============================================================================

interface CreatePostInput {
  platform: SocialPlatform;
  content: PlatformGeneratedContent;
  scheduledFor: string | null;
  postImmediately: boolean;
}

interface CreateScheduledPostsInput {
  videoUrl: string;
  originalDescription: string;
  posts: CreatePostInput[];
}

export async function createScheduledPosts(
  input: CreateScheduledPostsInput
): Promise<{ success: boolean; posts?: ScheduledPost[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Generate batch ID for grouping posts from same upload
    const batchId = crypto.randomUUID();
    const createdPosts: ScheduledPost[] = [];

    for (const post of input.posts) {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: user.id,
          video_url: input.videoUrl,
          original_description: input.originalDescription,
          platform: post.platform,
          generated_content: post.content,
          scheduled_for: post.scheduledFor,
          post_immediately: post.postImmediately,
          status: post.postImmediately ? 'posting' : 'scheduled',
          batch_id: batchId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating scheduled post:', error);
        continue;
      }

      if (data) {
        createdPosts.push(mapDbPostToScheduledPost(data));
      }

      // If posting immediately, trigger the posting job
      if (post.postImmediately) {
        // TODO: Trigger actual posting to social media platform
        // This would be handled by a background job or webhook
        await triggerImmediatePost(data.id, post.platform);
      }
    }

    return { success: true, posts: createdPosts };

  } catch (error) {
    console.error('Create scheduled posts error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create posts',
    };
  }
}

export async function getScheduledPosts(): Promise<{
  success: boolean;
  posts?: ScheduledPost[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['draft', 'scheduled', 'posting'])
      .order('scheduled_for', { ascending: true, nullsFirst: false });

    if (error) {
      throw error;
    }

    const posts = (data || []).map(mapDbPostToScheduledPost);
    return { success: true, posts };

  } catch (error) {
    console.error('Get scheduled posts error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load posts',
    };
  }
}

export async function getPostedHistory(): Promise<{
  success: boolean;
  posts?: ScheduledPost[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['posted', 'failed', 'cancelled'])
      .order('posted_at', { ascending: false, nullsFirst: false })
      .limit(50);

    if (error) {
      throw error;
    }

    const posts = (data || []).map(mapDbPostToScheduledPost);
    return { success: true, posts };

  } catch (error) {
    console.error('Get posted history error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load history',
    };
  }
}

export async function cancelScheduledPost(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('scheduled_posts')
      .update({ status: 'cancelled' })
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return { success: true };

  } catch (error) {
    console.error('Cancel scheduled post error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel post',
    };
  }
}

export async function reschedulePost(
  postId: string,
  newTime: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('scheduled_posts')
      .update({
        scheduled_for: newTime,
        status: 'scheduled',
      })
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return { success: true };

  } catch (error) {
    console.error('Reschedule post error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reschedule post',
    };
  }
}

// ============================================================================
// CONNECTED ACCOUNTS
// ============================================================================

export async function getConnectedAccounts(): Promise<{
  success: boolean;
  accounts?: Record<SocialPlatform, SocialAccount | null>;
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
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    const accounts: Record<SocialPlatform, SocialAccount | null> = {
      tiktok: null,
      instagram: null,
      youtube: null,
      twitter: null,
      linkedin: null,
      facebook: null,
    };

    for (const conn of data || []) {
      const platform = conn.platform as SocialPlatform;
      if (platform in accounts) {
        accounts[platform] = {
          platform,
          connected: conn.connection_status === 'active',
          username: conn.username,
          avatarUrl: conn.avatar_url,
          expiresAt: conn.expires_at,
          connectionStatus: conn.connection_status,
          lastConnected: conn.last_connected,
        };
      }
    }

    return { success: true, accounts };

  } catch (error) {
    console.error('Get connected accounts error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load accounts',
    };
  }
}

// ============================================================================
// DRAFT MANAGEMENT
// ============================================================================

interface SaveDraftInput {
  id?: string;
  videoUrl?: string;
  originalDescription: string;
  selectedPlatforms: SocialPlatform[];
  platformContent: Record<SocialPlatform, PlatformGeneratedContent | null>;
  currentStep: number;
}

export async function saveDraft(
  input: SaveDraftInput
): Promise<{ success: boolean; draftId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const draftData = {
      user_id: user.id,
      video_url: input.videoUrl,
      original_description: input.originalDescription,
      selected_platforms: input.selectedPlatforms,
      platform_content: input.platformContent,
      current_step: input.currentStep,
      last_auto_save: new Date().toISOString(),
    };

    if (input.id) {
      // Update existing draft
      const { error } = await supabase
        .from('content_multiplier_drafts')
        .update(draftData)
        .eq('id', input.id)
        .eq('user_id', user.id);

      if (error) throw error;
      return { success: true, draftId: input.id };
    } else {
      // Create new draft
      const { data, error } = await supabase
        .from('content_multiplier_drafts')
        .insert(draftData)
        .select('id')
        .single();

      if (error) throw error;
      return { success: true, draftId: data.id };
    }

  } catch (error) {
    console.error('Save draft error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save draft',
    };
  }
}

export async function loadDraft(
  draftId: string
): Promise<{
  success: boolean;
  draft?: {
    videoUrl?: string;
    originalDescription: string;
    selectedPlatforms: SocialPlatform[];
    platformContent: Record<SocialPlatform, PlatformGeneratedContent | null>;
    currentStep: number;
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('content_multiplier_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    return {
      success: true,
      draft: {
        videoUrl: data.video_url,
        originalDescription: data.original_description,
        selectedPlatforms: data.selected_platforms,
        platformContent: data.platform_content,
        currentStep: data.current_step,
      },
    };

  } catch (error) {
    console.error('Load draft error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load draft',
    };
  }
}

export async function deleteDraft(
  draftId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('content_multiplier_drafts')
      .delete()
      .eq('id', draftId)
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };

  } catch (error) {
    console.error('Delete draft error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete draft',
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapDbPostToScheduledPost(dbPost: any): ScheduledPost {
  return {
    id: dbPost.id,
    userId: dbPost.user_id,
    videoUrl: dbPost.video_url,
    videoThumbnailUrl: dbPost.video_thumbnail_url,
    originalDescription: dbPost.original_description,
    platform: dbPost.platform,
    generatedContent: dbPost.generated_content,
    scheduledFor: dbPost.scheduled_for,
    status: dbPost.status,
    platformPostId: dbPost.platform_post_id,
    platformPostUrl: dbPost.platform_post_url,
    errorMessage: dbPost.error_message,
    batchId: dbPost.batch_id,
    createdAt: dbPost.created_at,
    postedAt: dbPost.posted_at,
  };
}

async function triggerImmediatePost(postId: string, platform: SocialPlatform) {
  // TODO: Implement actual posting to social media platforms
  // This could:
  // 1. Call platform-specific posting APIs directly
  // 2. Add to a job queue (like BullMQ)
  // 3. Trigger a webhook to an external service

  console.log(`Triggering immediate post ${postId} to ${platform}`);

  // For now, we'll simulate the posting and mark as posted after a delay
  // In production, this would be handled by background jobs
  setTimeout(async () => {
    try {
      const supabase = await createClient();
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          // platform_post_id would come from the actual API response
        })
        .eq('id', postId);
    } catch (error) {
      console.error('Failed to update post status:', error);
    }
  }, 3000);
}

// ============================================================================
// VIDEO UPLOAD
// ============================================================================

export async function uploadVideoForPost(
  file: File
): Promise<{ success: boolean; videoUrl?: string; thumbnailUrl?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('content-multiplier-videos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('content-multiplier-videos')
      .getPublicUrl(data.path);

    return {
      success: true,
      videoUrl: urlData.publicUrl,
      // TODO: Generate thumbnail from video
    };

  } catch (error) {
    console.error('Video upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload video',
    };
  }
}
