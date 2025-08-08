'use server';

import { streamText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createStreamableValue } from 'ai/rsc';
import { z } from 'zod';

// Types matching the store interfaces
export interface PlatformAdaptationRequest {
  originalContent: string;
  targetPlatforms: string[];
  uploadedFiles?: UploadedFileData[];
  contentSettings: ContentSettingsData;
  userContext?: {
    userId: string;
    preferences?: any;
  };
}

export interface UploadedFileData {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  transcription?: string;
  extracted_text?: string;
}

export interface ContentSettingsData {
  tone: 'professional' | 'casual' | 'humorous' | 'inspiring' | 'educational';
  target_audience: string;
  include_hashtags: boolean;
  hashtag_count: number;
  include_mentions: boolean;
  include_cta: boolean;
  cta_type: 'website' | 'signup' | 'download' | 'contact' | 'custom';
  custom_cta?: string;
  preserve_links: boolean;
}

export interface PlatformContentResult {
  platform: string;
  content: string;
  hashtags: string[];
  mentions: string[];
  character_count: number;
  thread_parts?: string[];
  optimization_notes: string[];
  engagement_score: number;
}

export interface ContentMultiplierResult {
  success: boolean;
  platform_adaptations: PlatformContentResult[];
  original_analysis: {
    content_type: string;
    main_topics: string[];
    sentiment: string;
    key_points: string[];
  };
  credits_used: number;
  processing_time: number;
  error?: string;
}

// Platform-specific schemas
const PlatformContentSchema = z.object({
  platform: z.string(),
  content: z.string(),
  hashtags: z.array(z.string()),
  mentions: z.array(z.string()),
  character_count: z.number(),
  thread_parts: z.array(z.string()).optional(),
  optimization_notes: z.array(z.string()),
  engagement_score: z.number().min(0).max(100),
});

const ContentAnalysisSchema = z.object({
  content_type: z.string(),
  main_topics: z.array(z.string()),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  key_points: z.array(z.string()),
});

const ContentMultiplierSchema = z.object({
  platform_adaptations: z.array(PlatformContentSchema),
  original_analysis: ContentAnalysisSchema,
});

// Platform configurations
const PLATFORM_CONFIGS = {
  twitter: {
    maxLength: 280,
    supportsThreads: true,
    hashtagStyle: 'trending',
    toneGuidance: 'concise and engaging, use current trends',
    characteristicFeatures: ['threads for long content', 'trending hashtags', 'mentions for engagement'],
  },
  instagram: {
    maxLength: 2200,
    supportsThreads: false,
    hashtagStyle: 'niche-specific',
    toneGuidance: 'visual-first, storytelling approach',
    characteristicFeatures: ['visual focus', 'story format', 'niche hashtags', 'emojis encouraged'],
  },
  tiktok: {
    maxLength: 150,
    supportsThreads: false,
    hashtagStyle: 'viral-trending',
    toneGuidance: 'youthful, trendy, hook-driven',
    characteristicFeatures: ['video-first content', 'viral hashtags', 'short and punchy'],
  },
  linkedin: {
    maxLength: 3000,
    supportsThreads: false,
    hashtagStyle: 'professional',
    toneGuidance: 'professional, value-driven, thought leadership',
    characteristicFeatures: ['professional tone', 'industry insights', 'career-focused'],
  },
  facebook: {
    maxLength: 63206,
    supportsThreads: false,
    hashtagStyle: 'community',
    toneGuidance: 'conversational, community-focused',
    characteristicFeatures: ['longer form content', 'community engagement', 'personal stories'],
  },
};

/**
 * Main Content Multiplier Orchestrator
 * Adapts content for multiple social media platforms using AI SDK with O1 models
 */
export async function contentMultiplierOrchestrator(
  request: PlatformAdaptationRequest
): Promise<ContentMultiplierResult> {
  const startTime = Date.now();
  let creditsUsed = 0;

  try {
    // Validate input
    if (!request.originalContent?.trim() && (!request.uploadedFiles || request.uploadedFiles.length === 0)) {
      throw new Error('Either original content or uploaded files must be provided');
    }

    if (!request.targetPlatforms || request.targetPlatforms.length === 0) {
      throw new Error('At least one target platform must be specified');
    }

    // Prepare content for analysis
    let contentToAnalyze = request.originalContent || '';
    
    // Add transcribed/extracted content from files
    if (request.uploadedFiles) {
      const additionalContent = request.uploadedFiles
        .map(file => {
          if (file.transcription) return `[Audio/Video Transcription]: ${file.transcription}`;
          if (file.extracted_text) return `[Document Text]: ${file.extracted_text}`;
          return `[File: ${file.name}]`;
        })
        .join('\n\n');
      
      contentToAnalyze = `${contentToAnalyze}\n\n${additionalContent}`.trim();
    }

    // Build comprehensive system prompt
    const systemPrompt = buildSystemPrompt(request.targetPlatforms, request.contentSettings);

    // Generate platform-specific adaptations using O1 model
    console.log('Generating content adaptations for platforms:', request.targetPlatforms);
    
    const result = await generateObject({
      model: openai('o1-preview'), // Using O1 for complex content adaptation
      system: systemPrompt,
      prompt: buildUserPrompt(contentToAnalyze, request.targetPlatforms, request.contentSettings),
      schema: ContentMultiplierSchema,
      temperature: 0.7,
    });

    creditsUsed = calculateCreditsUsed(request.targetPlatforms, request.uploadedFiles);

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      platform_adaptations: (result.object as any).platform_adaptations,
      original_analysis: (result.object as any).original_analysis,
      credits_used: creditsUsed,
      processing_time: processingTime,
    };

  } catch (error) {
    console.error('Content Multiplier Orchestrator Error:', error);
    
    return {
      success: false,
      platform_adaptations: [],
      original_analysis: {
        content_type: 'unknown',
        main_topics: [],
        sentiment: 'neutral',
        key_points: [],
      },
      credits_used: creditsUsed,
      processing_time: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Stream-based content generation for real-time updates
 */
export async function streamContentAdaptation(
  request: PlatformAdaptationRequest
) {
  const stream = createStreamableValue('');

  (async () => {
    try {
      const systemPrompt = buildSystemPrompt(request.targetPlatforms, request.contentSettings);
      const userPrompt = buildUserPrompt(request.originalContent, request.targetPlatforms, request.contentSettings);

      const { textStream } = await streamText({
        model: openai('gpt-4o'), // Using GPT-4o for streaming
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      });

      for await (const delta of textStream) {
        stream.update(delta);
      }

      stream.done();
    } catch (error) {
      console.error('Streaming error:', error);
      stream.error(error);
    }
  })();

  return { output: stream.value };
}

/**
 * Individual platform content regeneration
 */
export async function regeneratePlatformContent(
  originalContent: string,
  platform: string,
  contentSettings: ContentSettingsData,
  previousVersion?: string
): Promise<PlatformContentResult> {
  try {
    const platformConfig = PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS];
    if (!platformConfig) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const systemPrompt = `You are an expert social media content creator specializing in ${platform}.

PLATFORM SPECIFICATIONS:
- Max Length: ${platformConfig.maxLength} characters
- Supports Threads: ${platformConfig.supportsThreads}
- Hashtag Style: ${platformConfig.hashtagStyle}
- Tone Guidance: ${platformConfig.toneGuidance}
- Key Features: ${platformConfig.characteristicFeatures.join(', ')}

CONTENT SETTINGS:
- Tone: ${contentSettings.tone}
- Target Audience: ${contentSettings.target_audience}
- Include Hashtags: ${contentSettings.include_hashtags} (${contentSettings.hashtag_count} hashtags)
- Include CTA: ${contentSettings.include_cta} (${contentSettings.cta_type})

${previousVersion ? `PREVIOUS VERSION (to improve upon): ${previousVersion}` : ''}

Create engaging, platform-optimized content that maximizes engagement for the specific platform.`;

    const result = await generateObject({
      model: openai('gpt-4o'),
      system: systemPrompt,
      prompt: `Adapt this content for ${platform}: "${originalContent}"`,
      schema: PlatformContentSchema,
      temperature: 0.8,
    });

    return result.object as PlatformContentResult;

  } catch (error) {
    console.error(`Platform content generation error for ${platform}:`, error);
    throw error;
  }
}

/**
 * Build comprehensive system prompt for multi-platform adaptation
 */
function buildSystemPrompt(platforms: string[], settings: ContentSettingsData): string {
  const platformSpecs = platforms.map(platform => {
    const config = PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS];
    return `${platform.toUpperCase()}:
- Max Length: ${config?.maxLength || 'unlimited'} characters
- Tone: ${config?.toneGuidance || 'platform-appropriate'}
- Features: ${config?.characteristicFeatures.join(', ') || 'standard social features'}`;
  }).join('\n\n');

  return `You are an expert social media content strategist and copywriter. Your expertise spans all major social media platforms, understanding their unique algorithms, audience behaviors, and content optimization strategies.

TASK: Transform the given content into optimized versions for each specified platform while maintaining the core message and value.

PLATFORM SPECIFICATIONS:
${platformSpecs}

CONTENT ADAPTATION PRINCIPLES:
1. Preserve the core message and key value propositions
2. Adapt tone and style to match platform culture
3. Optimize for platform-specific engagement patterns
4. Use platform-appropriate hashtags and mentions
5. Consider character limits and formatting constraints
6. Maintain authenticity while maximizing reach

CONTENT SETTINGS:
- Tone: ${settings.tone}
- Target Audience: ${settings.target_audience}
- Include Hashtags: ${settings.include_hashtags} (${settings.hashtag_count} per platform)
- Include Mentions: ${settings.include_mentions}
- Include CTA: ${settings.include_cta} (Type: ${settings.cta_type})
- Preserve Links: ${settings.preserve_links}

QUALITY REQUIREMENTS:
- Engagement Score: Predict engagement potential (0-100)
- Optimization Notes: Provide specific improvement suggestions
- Thread Support: Create thread versions for Twitter when needed
- Character Optimization: Use full character limits effectively

OUTPUT FORMAT: Provide structured JSON with platform adaptations and original content analysis.`;
}

/**
 * Build user prompt with content and context
 */
function buildUserPrompt(
  content: string,
  platforms: string[],
  settings: ContentSettingsData
): string {
  return `ORIGINAL CONTENT TO ADAPT:
"${content}"

TARGET PLATFORMS: ${platforms.join(', ')}

ADAPTATION REQUIREMENTS:
1. Create platform-specific versions that feel native to each platform
2. Maintain the core message while optimizing for platform algorithms
3. Generate appropriate hashtags for each platform (${settings.hashtag_count} hashtags each)
4. Include engagement-driving elements (questions, CTAs, hooks)
5. Optimize character usage for maximum impact
6. Provide thread versions for Twitter if content exceeds character limit

${settings.include_cta ? `CALL-TO-ACTION: Include a ${settings.cta_type} CTA${settings.custom_cta ? ` - "${settings.custom_cta}"` : ''}` : ''}

ANALYZE the original content for:
- Content type and format
- Main topics and themes  
- Sentiment and tone
- Key points and value propositions

Then CREATE optimized versions for each platform that will maximize engagement and reach.`;
}

/**
 * Calculate credits based on complexity and number of platforms
 */
function calculateCreditsUsed(
  platforms: string[],
  uploadedFiles?: UploadedFileData[]
): number {
  let credits = 0;
  
  // Base credits per platform
  credits += platforms.length * 2;
  
  // Additional credits for file processing
  if (uploadedFiles) {
    uploadedFiles.forEach(file => {
      if (file.type === 'video') credits += 3;
      else if (file.type === 'audio') credits += 2;
      else if (file.type === 'document') credits += 1;
      else credits += 0.5; // images
    });
  }
  
  return Math.ceil(credits);
}

/**
 * Content analysis for insights and optimization
 */
export async function analyzeContentForOptimization(
  content: string,
  platform: string
): Promise<{
  sentiment: string;
  topics: string[];
  suggestions: string[];
  engagement_potential: number;
}> {
  try {
    const result = await generateObject({
      model: openai('gpt-4o'),
      system: `You are a social media analytics expert. Analyze content for ${platform} optimization.`,
      prompt: `Analyze this content for ${platform}: "${content}"
      
      Provide:
      1. Sentiment analysis
      2. Main topics/themes
      3. Optimization suggestions
      4. Engagement potential score (0-100)`,
      schema: z.object({
        sentiment: z.string(),
        topics: z.array(z.string()),
        suggestions: z.array(z.string()),
        engagement_potential: z.number().min(0).max(100),
      }),
    });

    return result.object as { sentiment: string; topics: string[]; suggestions: string[]; engagement_potential: number; };
  } catch (error) {
    console.error('Content analysis error:', error);
    return {
      sentiment: 'neutral',
      topics: [],
      suggestions: ['Unable to analyze content'],
      engagement_potential: 50,
    };
  }
}

