'use server';

import { createClient } from '@/app/supabase/server';
import { Json } from '@/types/database';
import type { 
  ContentVariant, 
  OAuthConnection, 
  PublishingQueue,
  SocialPlatform,
  PlatformContent,
  UploadedFile
} from '@/components/content-multiplier/store/content-multiplier-store';

/**
 * Content Multiplier Database Actions
 * Handles all database operations for content multiplier functionality
 */

// Content Variant Operations
export async function saveContentVariant(variant: ContentVariant, userId: string) {
  try {
    const supabase = await createClient();
    
    const insertData = {
      user_id: userId,
      original_content: variant.original_content,
      generated_variants: {
        platform_adaptations: variant.platform_adaptations,
        upload_files: variant.upload_files,
      } as unknown as Json,
      settings: variant.settings as unknown as Json,
      output_format: 'multi-platform',
      word_count: variant.original_content.length,
      variant_count: variant.platform_adaptations.length,
      quality_score: calculateAverageEngagementScore(variant.platform_adaptations),
      export_formats: variant.platform_adaptations.map(p => p.platform),
    };

    const { data, error } = await supabase
      .from('content_multiplier_history')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Save content variant error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getContentVariantHistory(userId: string, limit = 20, offset = 0) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('content_multiplier_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) throw error;
    
    // Transform database records to ContentVariant format
    const variants: ContentVariant[] = data.map(record => {
      const generatedVariants = record.generated_variants as Json;
      return {
        id: record.id,
        original_content: record.original_content,
        platform_adaptations: (generatedVariants as { platform_adaptations?: PlatformContent[] })?.platform_adaptations || [],
        upload_files: (generatedVariants as { upload_files?: UploadedFile[] })?.upload_files || [],
        settings: record.settings as unknown as Json,
        total_platforms: record.variant_count || 0,
        status: 'completed' as const,
        created_at: record.created_at || '',
        updated_at: record.created_at || '',
      };
    });

    return { success: true, data: variants };
  } catch (error) {
    console.error('Get content variant history error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteContentVariant(variantId: string, userId: string) {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('content_multiplier_history')
      .delete()
      .eq('id', variantId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete content variant error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// OAuth Connection Operations
export async function saveOAuthConnection(connection: OAuthConnection, userId: string) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('social_platform_connections')
      .upsert({
        user_id: userId,
        platform: connection.platform,
        username: connection.username,
        avatar_url: connection.avatar_url,
        connected: connection.connected,
        connection_status: connection.connection_status,
        expires_at: connection.expires_at,
        last_connected: connection.last_connected,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Save OAuth connection error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getOAuthConnections(userId: string) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('social_platform_connections')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    
    // Transform to Record<SocialPlatform, OAuthConnection> format
    const connections: Record<SocialPlatform, OAuthConnection> = {} as Record<SocialPlatform, OAuthConnection>;
    
    data.forEach(record => {
      connections[record.platform as SocialPlatform] = {
        platform: record.platform as SocialPlatform,
        connected: record.connected || false,
        username: record.username || undefined,
        avatar_url: record.avatar_url || undefined,
        expires_at: record.expires_at || undefined,
        last_connected: record.last_connected || '',
        connection_status: (record.connection_status as 'active' | 'disconnected' | 'expired') || 'disconnected',
      };
    });

    return { success: true, data: connections };
  } catch (error) {
    console.error('Get OAuth connections error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function disconnectPlatform(platform: SocialPlatform, userId: string) {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('social_platform_connections')
      .update({
        connected: false,
        connection_status: 'disconnected',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('platform', platform);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Disconnect platform error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Publishing Queue Operations
export async function addToPublishingQueue(queueItem: Omit<PublishingQueue, 'id'>, userId: string) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('publishing_queue')
      .insert({
        user_id: userId,
        content_variant_id: queueItem.content_variant_id,
        platform: queueItem.platform,
        scheduled_time: queueItem.scheduled_time,
        status: queueItem.status,
        retry_count: queueItem.retry_count,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Add to publishing queue error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getPublishingQueue(userId: string) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('publishing_queue')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;
    
    const queue: PublishingQueue[] = data.map(record => ({
      id: record.id,
      content_variant_id: record.content_variant_id,
      platform: record.platform as SocialPlatform,
      scheduled_time: record.scheduled_time,
      status: (record.status as 'queued' | 'publishing' | 'published' | 'failed' | 'cancelled') || 'queued',
      retry_count: record.retry_count || 0,
      error_message: record.error_message || undefined,
      published_at: record.published_at || undefined,
    }));

    return { success: true, data: queue };
  } catch (error) {
    console.error('Get publishing queue error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updatePublishingStatus(
  queueId: string, 
  status: 'queued' | 'publishing' | 'published' | 'failed' | 'cancelled',
  userId: string,
  errorMessage?: string,
  publishedAt?: string
) {
  try {
    const supabase = await createClient();
    
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    
    if (errorMessage) updateData.error_message = errorMessage;
    if (publishedAt) updateData.published_at = publishedAt;
    // Note: retry_count increment would need to be handled differently in Supabase

    const { error } = await supabase
      .from('publishing_queue')
      .update(updateData)
      .eq('id', queueId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Update publishing status error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteFromPublishingQueue(queueId: string, userId: string) {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('publishing_queue')
      .delete()
      .eq('id', queueId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete from publishing queue error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Credit Operations
export async function logContentMultiplierCreditUsage(
  userId: string,
  creditsUsed: number,
  operationType: 'content_adaptation' | 'image_processing' | 'video_processing' | 'publishing',
  platformCount: number,
  metadata?: Json
) {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('credit_usage')
      .insert({
        user_id: userId,
        service_type: 'content-multiplier',
        credits_used: creditsUsed,
        operation_type: operationType,
        metadata: {
          platform_count: platformCount,
          operation_details: metadata,
          timestamp: new Date().toISOString(),
        },
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Log credit usage error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deductCredits(userId: string, amount: number) {
  try {
    const supabase = await createClient();
    
    // Check current credits
    const { data: userData, error: userError } = await supabase
      .from('user_credits')
      .select('available_credits, total_credits')
      .eq('user_id', userId)
      .single();

    if (userError) throw userError;
    
    const availableCredits = userData.available_credits || 0;
    if (availableCredits < amount) {
      return { 
        success: false, 
        error: 'Insufficient credits',
        current_credits: availableCredits,
        required_credits: amount 
      };
    }

    // Deduct credits
    const { error: deductError } = await supabase
      .from('user_credits')
      .update({ 
        available_credits: availableCredits - amount,
        used_credits: (userData.total_credits - (availableCredits - amount)),
        updated_at: new Date().toISOString() 
      })
      .eq('user_id', userId);

    if (deductError) throw deductError;
    
    return { 
      success: true, 
      remaining_credits: availableCredits - amount 
    };
  } catch (error) {
    console.error('Deduct credits error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Analytics and Insights
export async function getContentMultiplierAnalytics(userId: string, days = 30) {
  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('content_multiplier_history')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', since);

    if (error) throw error;
    
    const analytics = {
      total_variants: data.length,
      total_platforms: data.reduce((sum, record) => sum + (record.variant_count || 0), 0),
      average_quality_score: data.reduce((sum, record) => sum + (record.quality_score || 0), 0) / data.length || 0,
      most_used_platforms: calculateMostUsedPlatforms(data as Array<{ export_formats?: string[] }>),
      content_performance: data.map(record => ({
        id: record.id,
        created_at: record.created_at,
        platform_count: record.variant_count,
        quality_score: record.quality_score,
      })),
    };

    return { success: true, data: analytics };
  } catch (error) {
    console.error('Get content multiplier analytics error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Utility Functions
function calculateAverageEngagementScore(platformAdaptations: Array<{ engagement_score?: number }>): number {
  if (!platformAdaptations.length) return 0;
  
  const totalScore = platformAdaptations.reduce((sum, adaptation) => {
    return sum + (adaptation.engagement_score || 50);
  }, 0);
  
  return Math.round(totalScore / platformAdaptations.length);
}

function calculateMostUsedPlatforms(records: Array<{ export_formats?: string[] }>): { platform: string; count: number }[] {
  const platformCounts: Record<string, number> = {};
  
  records.forEach(record => {
    if (record.export_formats && Array.isArray(record.export_formats)) {
      record.export_formats.forEach((platform: string) => {
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      });
    }
  });
  
  return Object.entries(platformCounts)
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);
}

// Types imported at the top of the file