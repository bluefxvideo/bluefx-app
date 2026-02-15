'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

const GEMINI_MODEL = 'gemini-3-flash-preview';

/**
 * Robustly extract and parse JSON from an AI response.
 * Handles markdown code blocks, thinking preamble, and other noise.
 */
function extractJSON<T>(text: string): T {
  // 1. Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // continue to cleanup
  }

  // 2. Strip markdown code fences
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // continue to regex extraction
  }

  // 3. Find the first { ... } block (handles thinking preamble)
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } catch {
      // last resort failed
    }
  }

  throw new Error(`Could not parse JSON from response: ${text.substring(0, 200)}...`);
}

// ============================================================================
// TYPES
// ============================================================================

export interface BlogPostContent {
  title: string;
  seoTitle: string;
  content: string; // HTML
  excerpt: string;
  focusKeyphrase: string;
  metaDescription: string;
}

export interface SocialCaption {
  caption: string;
  hashtags: string[];
}

export interface SocialContent {
  linkedin: SocialCaption;
}

export interface GenerateBlogPostResult {
  success: boolean;
  blogPost?: BlogPostContent;
  error?: string;
}

export interface GenerateSocialContentResult {
  success: boolean;
  socialContent?: SocialContent;
  error?: string;
}

// ============================================================================
// BLOG POST GENERATION
// ============================================================================

const BLOG_POST_SYSTEM_PROMPT = `You are a sharp, opinionated content writer — NOT a generic SEO robot. You write blog posts that people actually want to read.

## Your voice:
- Write like a knowledgeable friend explaining something over coffee, not a corporate content mill
- Be direct. Say things plainly. Don't pad sentences with filler words
- Have opinions. "This is the best way to do X" not "There are many ways one might consider doing X"
- Use "you" and "I" — make it personal
- If the video creator shares personal experience or stories, weave those in — that's the gold
- Specific details > vague claims. Numbers, tool names, exact steps
- Short paragraphs. Punchy sentences. Then a longer one to vary the rhythm.

## What NOT to do (critical):
- NO generic introductions like "In today's fast-paced digital landscape..." or "In the ever-evolving world of..."
- NO filler sections that just restate the heading in different words
- NO padding paragraphs that say nothing new
- NO corporate speak: "leverage", "harness the power of", "game-changer", "revolutionize", "unprecedented"
- NO listing obvious benefits everyone already knows (like "social media increases engagement")
- DO NOT inflate a 5-minute video into 2500 words of fluff. If the content is thin, write a shorter, tighter post.

## Structure:
- Start with a hook that makes someone want to keep reading. A bold claim, a surprising fact, or a problem they relate to.
- Use HTML: <p>, <h2>, <h3>, <ul>, <ol>, <strong>, <em>, <blockquote>
- H2 headings should be useful and specific, not generic ("Step 1: Set Up Your Canvas in Canva" not "Getting Started With Your Design Journey")
- Include real, actionable steps from the video — the kind of stuff people screenshot
- End with a clear takeaway, not a wishy-washy summary
- Do NOT include <h1> — the title handles that
- Do NOT include YouTube embed — added separately

## SEO (do this subtly, not ham-fistedly):
- Title: 50-60 chars, naturally includes the main keyword
- SEO Title: Can differ from H1, more keyword-focused for Yoast
- Meta description: 150-155 chars, compelling, not just a summary
- Focus keyphrase: 2-4 word phrase that someone would actually Google
- Weave the keyphrase naturally 3-5 times — if it feels forced, skip it`;

/**
 * Generates an SEO-optimized blog post from a YouTube video transcript
 */
export async function generateBlogPost(params: {
  youtubeTitle: string;
  youtubeDescription: string;
  transcript: string;
  youtubeUrl: string;
}): Promise<GenerateBlogPostResult> {
  try {
    if (!params.transcript || params.transcript.trim().length < 100) {
      return { success: false, error: 'Transcript is too short to generate a blog post.' };
    }

    console.log('Generating blog post with Gemini 3 Flash...');

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
      },
    });

    const userPrompt = `Transform this YouTube video transcript into a blog post that people will actually read and share.

## Video:
Title: ${params.youtubeTitle}
Description: ${params.youtubeDescription}

## Full Transcript:
${params.transcript.substring(0, 30000)}

## Output (JSON):
{
  "title": "Compelling blog title (50-60 chars). Not clickbait, but makes you want to click.",
  "seoTitle": "SEO-optimized title for Yoast — keyword-rich version",
  "excerpt": "150-155 char hook that makes someone click through from search results",
  "metaDescription": "150-155 char SEO meta description — compelling, includes focus keyword",
  "focusKeyphrase": "2-4 word phrase someone would actually search on Google",
  "content": "Full HTML blog post. Write it like a real person, not a content mill. Include specific steps, tips, and insights from the transcript. Use <h2>, <h3>, <p>, <ul>, <ol>, <strong>, <em>, <blockquote>. No <h1>."
}

Return ONLY valid JSON.`;

    const result = await model.generateContent([
      { text: BLOG_POST_SYSTEM_PROMPT },
      { text: userPrompt },
    ]);

    const response = result.response;
    const responseText = response.text();

    if (!responseText) {
      return { success: false, error: 'No response from AI' };
    }

    // Parse JSON response
    let parsed: BlogPostContent;
    try {
      parsed = extractJSON<BlogPostContent>(responseText);
    } catch (parseErr) {
      console.error('Failed to parse blog post JSON:', parseErr, '\nResponse:', responseText.substring(0, 1000));
      return { success: false, error: `Failed to parse AI response. Response starts with: "${responseText.substring(0, 150)}..."` };
    }

    // Validate required fields
    if (!parsed.title || !parsed.content) {
      return { success: false, error: 'AI response missing required fields.' };
    }

    console.log('Blog post generated. Title:', parsed.title);

    return {
      success: true,
      blogPost: {
        title: parsed.title,
        seoTitle: parsed.seoTitle || parsed.title,
        content: parsed.content,
        excerpt: parsed.excerpt || '',
        focusKeyphrase: parsed.focusKeyphrase || '',
        metaDescription: parsed.metaDescription || parsed.excerpt || '',
      },
    };
  } catch (error) {
    console.error('Blog post generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate blog post',
    };
  }
}

// ============================================================================
// SOCIAL CONTENT GENERATION
// ============================================================================

const SOCIAL_SYSTEM_PROMPT = `You write social media posts that sound like an actual human, not a brand's social media intern following a template.

## Rules for ALL platforms:
- Sound like a real person sharing something cool they found, not a marketer doing "content"
- NO corporate buzzwords. No "game-changer", "exciting news", "thrilled to share"
- NO emoji walls. Max 1-2 emojis per post, and only if they add something
- Lead with the most interesting thing — the hook that makes someone stop scrolling
- Be specific. "I cut my thumbnail creation time from 2 hours to 10 minutes" beats "AI can help with thumbnails"

## Platform-specific:

**Facebook:**
- Talk like you're posting in a group you're part of
- Share the "aha moment" from the video, not a summary
- Ask a genuine question, not a marketing one
- 1-2 short paragraphs max
- 2-3 hashtags at the end (not sprinkled in)

**LinkedIn:**
- Share one specific insight or lesson, not a video summary
- Open with a bold or surprising statement
- Use short lines with line breaks (the LinkedIn format)
- End with a real question that invites discussion
- 3-5 hashtags at the end

**Twitter/X:**
- Under 250 chars. Every word earns its place.
- One sharp take or surprising claim
- Make people want to click/reply
- 1-2 hashtags max`;

/**
 * Generates platform-specific social media captions
 */
export async function generateSocialContent(params: {
  youtubeTitle: string;
  youtubeDescription: string;
  transcript: string;
  youtubeUrl: string;
  productUrl?: string | null;
  blogExcerpt?: string;
}): Promise<GenerateSocialContentResult> {
  try {
    console.log('Generating social content with Gemini 3 Flash...');

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // Use blog excerpt if available for better quality, otherwise use transcript
    const contentSource = params.blogExcerpt
      ? `Blog excerpt: ${params.blogExcerpt}\n\nTranscript snippet: ${params.transcript.substring(0, 5000)}`
      : `Transcript: ${params.transcript.substring(0, 8000)}`;

    // Build the links section based on available URLs
    const productUrl = params.productUrl;
    const youtubeUrl = params.youtubeUrl;
    const hasProductUrl = !!productUrl;

    const linksSection = hasProductUrl
      ? `## IMPORTANT — Include BOTH links in every post:
1. **Product link** (${productUrl}) — this is the PRIMARY CTA. Examples: "Try it here: ${productUrl}", "Check it out: ${productUrl}"
2. **YouTube link** (${youtubeUrl}) — SECONDARY link. Examples: "Full video: ${youtubeUrl}"

Order: product link first, then YouTube link. Both BEFORE hashtags.
For Twitter: do NOT include any links in the caption text — links will be appended automatically. Keep the caption text under 150 characters.`
      : `## IMPORTANT — Include the YouTube link:
Every post MUST end with a short comment/CTA and the YouTube URL (${youtubeUrl}) BEFORE the hashtags. Examples of good CTAs:
- "Full video here: ${youtubeUrl}"
- "Watch the full breakdown: ${youtubeUrl}"
Do NOT just paste the link — add a short 3-6 word intro before it.`;

    const userPrompt = `Write social media posts for this YouTube video. Sound like a real human, not a brand account.

## Video:
Title: ${params.youtubeTitle}
Description: ${params.youtubeDescription}
URL: ${youtubeUrl}${hasProductUrl ? `\nProduct URL: ${productUrl}` : ''}

## Content:
${contentSource}

${linksSection}

## Output (JSON):
{
  "linkedin": {
    "caption": "LinkedIn post — bold opener, specific insight, short lines with \\n line breaks, end with discussion question, then links on last lines.",
    "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4"]
  }
}

Return ONLY valid JSON.`;

    const result = await model.generateContent([
      { text: SOCIAL_SYSTEM_PROMPT },
      { text: userPrompt },
    ]);

    const response = result.response;
    const responseText = response.text();

    if (!responseText) {
      return { success: false, error: 'No response from AI' };
    }

    let parsed: SocialContent;
    try {
      parsed = extractJSON<SocialContent>(responseText);
    } catch (parseErr) {
      console.error('Failed to parse social content JSON:', parseErr, '\nResponse:', responseText.substring(0, 500));
      return { success: false, error: 'Failed to parse AI response. Please try again.' };
    }

    // Validate
    if (!parsed.linkedin) {
      return { success: false, error: 'AI response missing LinkedIn content.' };
    }

    console.log('Social content generated for all platforms');

    return { success: true, socialContent: parsed };
  } catch (error) {
    console.error('Social content generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate social content',
    };
  }
}

// ============================================================================
// REGENERATE SINGLE PLATFORM
// ============================================================================

/**
 * Regenerates content for a single social platform
 */
export async function regeneratePlatformCaption(params: {
  platform: 'facebook' | 'linkedin' | 'twitter';
  youtubeTitle: string;
  transcript: string;
  previousCaption: string;
}): Promise<{ success: boolean; caption?: SocialCaption; error?: string }> {
  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const platformGuide: Record<string, string> = {
      linkedin: 'Bold opener, specific insight, short lines with line breaks, discussion question at end. 3-5 hashtags.',
    };

    const userPrompt = `Write a NEW ${params.platform} post for this video. Must be completely different from the previous version — different angle, different hook.

Video: ${params.youtubeTitle}
Key content: ${params.transcript.substring(0, 3000)}
Previous version (write something DIFFERENT): ${params.previousCaption}

Style: ${platformGuide[params.platform]}
Sound like a real person, not a brand.

Return JSON: { "caption": "...", "hashtags": ["..."] }`;

    const result = await model.generateContent(userPrompt);
    const responseText = result.response.text();

    let parsed: SocialCaption;
    try {
      parsed = extractJSON<SocialCaption>(responseText);
    } catch {
      return { success: false, error: 'Failed to parse response' };
    }

    return { success: true, caption: parsed };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Regeneration failed',
    };
  }
}
