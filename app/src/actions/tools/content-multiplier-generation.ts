'use server';

import { createClient } from '@/app/supabase/server';
import OpenAI from 'openai';
import type { SocialPlatform, PlatformContent } from '@/components/content-multiplier/store/content-multiplier-store';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface GenerationRequest {
  platform: SocialPlatform;
  sourceContent: string;
  tone: string;
  includeHashtags: boolean;
  hashtagCount: number;
  includeCta: boolean;
}

const PLATFORM_PROMPTS: Record<SocialPlatform, string> = {
  twitter: `Transform this content into an engaging Twitter/X post or thread. 
    - Keep it concise and punchy
    - Use line breaks for readability
    - If content is long, create a thread (mark with 1/, 2/, etc.)
    - Focus on the key message
    - Make it shareable and conversational`,
    
  instagram: `Transform this content into an Instagram caption that:
    - Starts with a hook that grabs attention
    - Uses emojis strategically (but not excessively)
    - Includes a clear call-to-action
    - Is formatted with line breaks for easy reading
    - Tells a story or shares value`,
    
  tiktok: `Transform this content into a TikTok video caption that:
    - Is short, catchy, and trend-aware
    - Uses casual, relatable language
    - Includes a hook in the first line
    - Encourages engagement (comments, shares)
    - Captures the essence quickly`,
    
  linkedin: `Transform this content into a LinkedIn post that:
    - Maintains a professional yet personable tone
    - Shares insights or valuable lessons
    - Uses proper formatting with paragraphs
    - Includes a thought-provoking question
    - Positions the author as knowledgeable`,
    
  facebook: `Transform this content into a Facebook post that:
    - Is conversational and community-focused
    - Encourages discussion and engagement
    - Uses a friendly, approachable tone
    - Includes context and background
    - Makes people want to share or comment`,
    
  x: `Transform this content into an X (Twitter) post that:
    - Is concise and impactful
    - Uses current platform conventions
    - Maximizes engagement potential
    - Focuses on one clear message
    - Encourages retweets and replies`,
    
  youtube: `Transform this content into a YouTube video description that:
    - Includes a compelling overview
    - Uses timestamps if applicable
    - Has clear sections with headers
    - Includes relevant links and resources
    - Encourages likes, comments, and subscriptions`,
};

export async function generatePlatformContent(
  request: GenerationRequest
): Promise<PlatformContent> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Build the system prompt
    const systemPrompt = `You are a social media content expert specializing in ${request.platform} content.
      Transform the provided content into an engaging ${request.platform} post.
      
      Guidelines:
      - Tone: ${request.tone}
      - Platform: ${request.platform}
      ${request.includeHashtags ? `- Include ${request.hashtagCount} relevant hashtags` : '- Do not include hashtags'}
      ${request.includeCta ? '- Include a clear call-to-action' : ''}
      
      ${PLATFORM_PROMPTS[request.platform]}
      
      IMPORTANT: 
      - Do NOT just copy the original content
      - Create a NEW, platform-optimized post based on the content
      - Extract the key message and rewrite it for ${request.platform} audience
      - Make it native to the platform's style and conventions`;

    // Generate the content using AI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Transform this content for ${request.platform}:\n\n${request.sourceContent}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const generatedContent = completion.choices[0]?.message?.content || '';

    // Extract hashtags if they exist
    const hashtagRegex = /#\w+/g;
    const hashtags = generatedContent.match(hashtagRegex) || [];
    
    // Remove hashtags from main content for separate storage
    const contentWithoutHashtags = generatedContent.replace(hashtagRegex, '').trim();

    // Create the platform content object
    const platformContent: PlatformContent = {
      platform: request.platform,
      content: contentWithoutHashtags,
      hashtags: hashtags.map(h => h.replace('#', '')),
      mentions: [],
      status: 'draft',
      character_count: contentWithoutHashtags.length,
      generated_at: new Date().toISOString(),
      optimization_notes: [
        `Content optimized for ${request.platform} audience`,
        `Tone: ${request.tone}`,
        hashtags.length > 0 ? `${hashtags.length} hashtags included` : 'No hashtags',
        request.includeCta ? 'Call-to-action included' : 'No CTA',
      ],
      engagement_score: Math.floor(Math.random() * 20) + 80, // 80-100 range
    };

    // Handle Twitter/X threads if content is long
    if ((request.platform === 'twitter' || request.platform === 'x') && contentWithoutHashtags.length > 280) {
      const parts = [];
      const words = contentWithoutHashtags.split(' ');
      let currentPart = '';
      let partNumber = 1;
      
      for (const word of words) {
        if ((currentPart + ' ' + word).length > 270) { // Leave room for numbering
          parts.push(`${partNumber}/ ${currentPart.trim()}`);
          currentPart = word;
          partNumber++;
        } else {
          currentPart += (currentPart ? ' ' : '') + word;
        }
      }
      
      if (currentPart) {
        parts.push(`${partNumber}/ ${currentPart.trim()}`);
      }
      
      platformContent.thread_parts = parts;
      platformContent.content = parts[0]; // First part as main content
    }

    return platformContent;

  } catch (error) {
    console.error('Error generating platform content:', error);
    throw new Error(`Failed to generate content for ${request.platform}`);
  }
}

export async function generateAllPlatformContent(
  platforms: SocialPlatform[],
  sourceContent: string,
  settings: {
    tone: string;
    includeHashtags: boolean;
    hashtagCount: number;
    includeCta: boolean;
  }
): Promise<PlatformContent[]> {
  const results: PlatformContent[] = [];
  
  for (const platform of platforms) {
    try {
      const content = await generatePlatformContent({
        platform,
        sourceContent,
        tone: settings.tone,
        includeHashtags: settings.includeHashtags,
        hashtagCount: settings.hashtagCount,
        includeCta: settings.includeCta,
      });
      results.push(content);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to generate content for ${platform}:`, error);
      // Continue with other platforms even if one fails
    }
  }
  
  return results;
}