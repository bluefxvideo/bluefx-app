'use server';

import { createIdeogramV2aPrediction, waitForIdeogramV2aCompletion } from '../models/ideogram-v2-turbo';
import { createChatCompletion } from '../models/openai-chat';
import { downloadAndUploadImage } from '../supabase-storage';
import { getUserCredits, deductCredits } from '../database/thumbnail-database';

// Cover style definitions matching the legacy system
const COVER_STYLES = {
  minimal: {
    name: "Minimal",
    description: "Clean and simple design",
    systemPrompt: `Create a minimalist book cover with clean typography and simple geometric elements. Focus on:
- Generous white space
- Limited color palette (2-3 colors max)
- Simple geometric shapes or subtle patterns
- Clear, readable typography
- Professional appearance`
  },
  modern: {
    name: "Modern", 
    description: "Contemporary and stylish",
    systemPrompt: `Create a modern, contemporary book cover with trendy design elements. Focus on:
- Bold typography
- Gradient colors or duotone effects
- Contemporary graphic elements
- Dynamic composition
- Fresh, current aesthetic`
  },
  professional: {
    name: "Professional",
    description: "Business and corporate look",
    systemPrompt: `Create a professional book cover suitable for business/corporate content. Focus on:
- Conservative color scheme (blues, grays, whites)
- Clean, structured layout
- Professional typography
- Minimal decorative elements
- Trustworthy, authoritative appearance`
  },
  creative: {
    name: "Creative",
    description: "Artistic and unique",
    systemPrompt: `Create an artistic and creative book cover with unique visual elements. Focus on:
- Creative typography treatments
- Artistic illustrations or abstract designs
- Vibrant or unexpected color combinations
- Eye-catching composition
- Unique, memorable design`
  }
};

// Color scheme mapping
const COLOR_SCHEMES: Record<string, string> = {
  blue: "blue and navy color scheme",
  green: "green and emerald color scheme",
  purple: "purple and violet color scheme",
  red: "red and crimson color scheme",
  orange: "orange and warm tones",
  teal: "teal and cyan color scheme"
};

// Font style mapping
const FONT_STYLES: Record<string, string> = {
  'serif': "elegant serif typography",
  'sans-serif': "clean sans-serif typography",
  'display': "bold display typography",
  'handwriting': "handwritten or script typography"
};

/**
 * Enhanced prompt generation for ebook covers
 */
async function enhanceCoverPrompt(
  title: string,
  subtitle: string | undefined,
  authorName: string | undefined,
  topic: string | undefined,
  style: string,
  colorScheme: string,
  fontStyle: string
): Promise<string> {
  try {
    console.log('🔍 Enhancing cover prompt with OpenAI...');
    
    const stylePrompt = COVER_STYLES[style as keyof typeof COVER_STYLES]?.systemPrompt || COVER_STYLES.minimal.systemPrompt;
    const colorDesc = COLOR_SCHEMES[colorScheme] || "professional color scheme";
    const fontDesc = FONT_STYLES[fontStyle] || "clean typography";
    
    const completion = await createChatCompletion({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a book cover design expert. Create a detailed prompt for generating a professional ebook cover image.

${stylePrompt}

You MUST return a JSON object that exactly matches this schema:
{
  "coverPrompt": "Your detailed book cover prompt that includes visual descriptions, composition, and style elements"
}

Focus on creating a cover that:
- Has clear space for the title text
- Looks professional and eye-catching at thumbnail size
- Uses the specified color scheme and typography style
- Includes relevant imagery or abstract elements for the topic`
        },
        {
          role: 'user',
          content: `Create a book cover for:
Title: "${title}"
${subtitle ? `Subtitle: "${subtitle}"` : ''}
${authorName ? `Author: ${authorName}` : ''}
${topic ? `Topic: ${topic}` : ''}
Color scheme: ${colorDesc}
Font style: ${fontDesc}
Style: ${style}`
        }
      ],
      temperature: 0.8,
      max_tokens: 300,
      n: 1
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(response);
    return parsed.coverPrompt;
  } catch (error) {
    console.error('Error enhancing prompt:', error);
    // Fallback to basic prompt
    return `Professional ebook cover for "${title}". ${subtitle ? `Subtitle: "${subtitle}". ` : ''}${authorName ? `Author name: ${authorName}. ` : ''}${topic ? `Book about: ${topic}. ` : ''}${COLOR_SCHEMES[colorScheme] || 'professional colors'}. ${FONT_STYLES[fontStyle] || 'clean typography'}. High quality, clear text areas, professional design.`;
  }
}

export interface GenerateCoverParams {
  title: string;
  subtitle?: string;
  authorName?: string;
  topic?: string;
  style?: string;
  colorScheme?: string;
  fontStyle?: string;
  userId: string;
}

export interface GenerateCoverResult {
  success: boolean;
  coverUrl?: string;
  error?: string;
  creditsUsed?: number;
}

/**
 * Generate an ebook cover using Ideogram V2 Turbo (same as thumbnail machine)
 */
export async function generateEbookCover(params: GenerateCoverParams): Promise<GenerateCoverResult> {
  try {
    console.log('🎨 Starting ebook cover generation:', params);
    
    // Check user credits
    const userCredits = await getUserCredits(params.userId);
    const requiredCredits = 10; // Same as thumbnail generation
    
    if (!userCredits || userCredits.available_credits < requiredCredits) {
      return {
        success: false,
        error: `Insufficient credits. You need ${requiredCredits} credits.`
      };
    }
    
    // Enhance the prompt
    const enhancedPrompt = await enhanceCoverPrompt(
      params.title,
      params.subtitle,
      params.authorName,
      params.topic,
      params.style || 'minimal',
      params.colorScheme || 'blue',
      params.fontStyle || 'sans-serif'
    );
    
    console.log('📝 Enhanced prompt:', enhancedPrompt);
    
    // Create prediction with Ideogram V2 Turbo
    const prediction = await createIdeogramV2aPrediction({
      prompt: enhancedPrompt,
      aspect_ratio: '2:3', // Standard book cover aspect ratio
      style_type: 'Design', // Use Design style for book covers
      magic_prompt_option: 'Auto',
      negative_prompt: 'blurry, low quality, distorted text, unreadable text, pixelated'
    });
    
    // Wait for completion
    const result = await waitForIdeogramV2aCompletion(prediction.id, 60000); // 60 second timeout
    
    if (result.status !== 'succeeded' || !result.output) {
      throw new Error(result.error || 'Cover generation failed');
    }
    
    // Upload to Supabase storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    const safeTitle = params.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
    const fileName = `ebook_cover_${safeTitle}_${timestamp}.jpg`;
    
    const storedUrl = await downloadAndUploadImage(result.output, fileName);
    
    // Deduct credits
    await deductCredits(params.userId, requiredCredits, 'ebook_cover_generation');
    
    console.log('✅ Cover generated successfully:', storedUrl);
    
    return {
      success: true,
      coverUrl: storedUrl,
      creditsUsed: requiredCredits
    };
    
  } catch (error) {
    console.error('❌ Error generating ebook cover:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate cover'
    };
  }
}

/**
 * Generate multiple cover variations (similar to thumbnail machine's batch generation)
 */
export async function generateMultipleCoverVariations(
  params: GenerateCoverParams, 
  count: number = 3
): Promise<GenerateCoverResult[]> {
  const results: GenerateCoverResult[] = [];
  
  for (let i = 0; i < count; i++) {
    const result = await generateEbookCover({
      ...params,
      // Add slight variation to prompt for each generation
      topic: params.topic ? `${params.topic} (variation ${i + 1})` : undefined
    });
    results.push(result);
    
    // Add small delay between generations
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}