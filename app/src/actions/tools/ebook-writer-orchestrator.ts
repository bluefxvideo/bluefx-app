'use server';

import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { processDocumentsForContext } from '@/utils/document-processing';
import { type UploadedDocument } from './ebook-document-handler';
import { createIdeogramV3TurboPrediction, waitForIdeogramV3TurboCompletion } from '../models/ideogram-v3-turbo';
import { 
  storeEbookResults, 
  // createEbookRecord - imported but unused in current implementation 
  recordEbookMetrics,
  getUserCredits,
  deductCredits 
} from '../database/ebook-writer-database';
import { Json } from '@/types/database';
import { createClient } from '@/app/supabase/server';

/**
 * Ebook Writer AI Orchestrator
 * Replaces 7 legacy edge functions with intelligent workflow orchestration
 * Using O1 model for complex long-form content generation
 */

export interface EbookWriterRequest {
  // Core input
  topic: string;
  
  // Title preferences (AI will generate if not specified)
  title?: string;
  custom_title_requirements?: string;
  
  // Content preferences
  content_preferences?: {
    word_count_level: 'short' | 'medium' | 'long'; // 5, 7-10, 10-15 chapters
    complexity: 'beginner' | 'intermediate' | 'advanced';
    writing_tone: 'professional' | 'conversational' | 'academic' | 'engaging';
    target_audience: string;
    include_images: boolean;
    include_ctas: boolean;
  };
  
  // Chapter outline preferences
  outline_preferences?: {
    focus_areas?: string[];
    avoid_topics?: string[];
    custom_structure?: string;
  };
  
  // Cover generation preferences
  cover_preferences?: {
    style: 'professional' | 'modern' | 'artistic' | 'minimal';
    color_scheme: string;
    font_style: 'modern' | 'classic' | 'bold' | 'elegant';
    author_name: string;
    subtitle?: string;
  };
  
  // Workflow control
  workflow_intent: 'title_only' | 'outline_only' | 'full_content' | 'cover_only' | 'complete_ebook';
  
  // Document upload context (stored in Supabase)
  uploaded_documents?: UploadedDocument[];
  
  // Context instructions for how to use uploaded documents
  context_instructions?: string;
  
  // Generation context
  reference_materials?: string[];
  continuation_context?: {
    existing_chapters: EbookChapter[];
    current_chapter_index: number;
  };
  
  // User context (optional - will be fetched from auth if not provided)
  user_id?: string;
}

export interface EbookWriterResponse {
  success: boolean;
  
  // Generated content
  generated_titles?: string[];
  outline?: EbookOutline;
  generated_content?: {
    chapter_id: string;
    section_id?: string;
    content: string;
    word_count: number;
  }[];
  cover?: {
    image_url: string;
    style_details: string;
  };
  
  // Export results
  export_urls?: {
    pdf?: string;
    epub?: string;
    docx?: string;
  };
  
  // AI orchestration insights
  content_analysis?: {
    readability_score: number;
    coherence_rating: number;
    target_audience_match: number;
    estimated_reading_time: number;
  };
  
  // Standard metadata
  prediction_id: string;
  batch_id: string;
  credits_used: number;
  generation_time_ms: number;
  workflow_completed: string[];
  
  // Error handling
  error?: string;
  warnings?: string[];
}

// Internal types matching the analysis report structure
interface EbookOutline {
  chapters: EbookChapter[];
  total_chapters: number;
  estimated_word_count: number;
  content_strategy: string;
}

interface EbookChapter {
  id: string;
  title: string;
  subsections: EbookSubsection[];
  estimated_word_count: number;
  key_points: string[];
}

interface EbookSubsection {
  id: string;
  title: string;
  hint: string;
  estimated_word_count: number;
}

// AI Schemas for structured generation
const TitleGenerationSchema = z.object({
  titles: z.array(z.string()).min(5).max(5),
  reasoningText: z.string(),
  target_audience_analysis: z.string()
});

const OutlineGenerationSchema = z.object({
  chapters: z.array(z.object({
    title: z.string(),
    subsections: z.array(z.object({
      title: z.string(),
      content_hint: z.string(),
      estimated_words: z.number()
    })),
    key_learning_objectives: z.array(z.string()),
    estimated_words: z.number()
  })),
  content_strategy: z.string(),
  coherence_analysis: z.string(),
  estimated_total_words: z.number()
});

const ContentGenerationSchema = z.object({
  content: z.string(),
  word_count: z.number(),
  readability_score: z.number().min(1).max(10),
  key_concepts_covered: z.array(z.string()),
  transition_quality: z.enum(['excellent', 'good', 'fair', 'needs_improvement'])
});

// Infer types from schemas
type TitleGenerationType = z.infer<typeof TitleGenerationSchema>;
type OutlineGenerationType = z.infer<typeof OutlineGenerationSchema>;
type ContentGenerationType = z.infer<typeof ContentGenerationSchema>;

/**
 * Main Orchestrator Function
 * Intelligently routes workflow based on intent and context
 */
export async function ebookWriterOrchestrator(
  request: EbookWriterRequest
): Promise<EbookWriterResponse> {
  const startTime = Date.now();
  const batch_id = crypto.randomUUID();
  let total_credits = 0;
  const warnings: string[] = [];
  const workflow_completed: string[] = [];

  try {
    // Get current user if not provided
    let userId = request.user_id;
    if (!userId) {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return {
          success: false,
          prediction_id: '',
          batch_id,
          credits_used: 0,
          generation_time_ms: Date.now() - startTime,
          workflow_completed: [],
          error: 'User not authenticated'
        };
      }
      userId = user.id;
    }
    
    // Validate user credits
    const creditResult = await getUserCredits(userId);
    const userCredits = creditResult.credits;
    const estimatedCredits = calculateEstimatedCredits(request);
    
    if (userCredits < estimatedCredits) {
      return {
        success: false,
        prediction_id: '',
        batch_id,
        credits_used: 0,
        generation_time_ms: Date.now() - startTime,
        workflow_completed: [],
        error: `Insufficient credits. Need ${estimatedCredits}, have ${userCredits}`
      };
    }

    // Initialize response structure
    const response: Partial<EbookWriterResponse> = {
      success: true,
      prediction_id: batch_id,
      batch_id,
      workflow_completed: [],
    };

    // Workflow orchestration based on intent
    switch (request.workflow_intent) {
      case 'title_only':
        response.generated_titles = await generateTitles(request.topic, request.uploaded_documents);
        total_credits += 0; // Free operation
        workflow_completed.push('title_generation');
        break;
        
      case 'outline_only':
        if (!request.title) {
          response.generated_titles = await generateTitles(request.topic, request.uploaded_documents);
        }
        response.outline = await generateOutline(request);
        total_credits += 5;
        workflow_completed.push('outline_generation');
        break;
        
      case 'full_content':
        response.generated_content = await generateContent(request);
        total_credits += calculateContentCredits(request);
        workflow_completed.push('content_generation');
        break;
        
      case 'cover_only':
        response.cover = await generateCover(request);
        total_credits += 10;
        workflow_completed.push('cover_generation');
        break;
        
      case 'complete_ebook':
        // Full workflow orchestration
        if (!request.title) {
          response.generated_titles = await generateTitles(request.topic, request.uploaded_documents);
          workflow_completed.push('title_generation');
        }
        
        response.outline = await generateOutline(request);
        total_credits += 5;
        workflow_completed.push('outline_generation');
        
        response.generated_content = await generateContent(request);
        total_credits += calculateContentCredits(request);
        workflow_completed.push('content_generation');
        
        if (request.cover_preferences) {
          response.cover = await generateCover(request);
          total_credits += 10;
          workflow_completed.push('cover_generation');
        }
        break;
    }

    // Deduct credits
    if (total_credits > 0) {
      await deductCredits(
        userId, 
        total_credits,
        'ebook_generation',
        { 
          workflow_type: request.workflow_intent,
          batch_id,
          topic: request.topic 
        } as Json
      );
    }

    // Store results
    await storeEbookResults({
      user_id: userId,
      topic: request.topic,
      title: request.title || response.generated_titles?.[0] || 'Untitled',
      outline: response.outline as unknown as Json,
      content: response.generated_content,
      cover_url: response.cover?.image_url,
      batch_id,
      credits_used: total_credits
    });

    // Record metrics
    await recordEbookMetrics({
      user_id: userId,
      workflow_type: request.workflow_intent,
      credits_used: total_credits,
      generation_time_ms: Date.now() - startTime,
      word_count: response.outline?.estimated_word_count || 0,
      chapters_generated: response.outline?.chapters.length || 0
    });

    return {
      ...response,
      success: true,
      prediction_id: batch_id,
      batch_id,
      credits_used: total_credits,
      generation_time_ms: Date.now() - startTime,
      workflow_completed,
      warnings: warnings.length > 0 ? warnings : undefined,
    } as EbookWriterResponse;

  } catch (error) {
    return {
      success: false,
      prediction_id: batch_id,
      batch_id,
      credits_used: total_credits,
      generation_time_ms: Date.now() - startTime,
      workflow_completed,
      error: error instanceof Error ? error.message : 'Ebook generation failed',
    };
  }
}

/**
 * Generate 5 compelling titles based on topic
 * Using Gemini 2.0 Flash - 200x cheaper than O1 models!
 */
async function generateTitles(topic: string, uploadedDocuments?: UploadedDocument[]): Promise<string[]> {
  // Process uploaded documents for context
  let documentContext = '';
  if (uploadedDocuments && uploadedDocuments.length > 0) {
    const { processedText } = processDocumentsForContext(uploadedDocuments, 50000); // 50K token limit for titles
    documentContext = processedText;
  }

  // Gemini 2.0 Flash is dramatically cheaper: $0.075/1M tokens vs $15/1M for O1-preview
  const result = await generateObject({
    model: google('gemini-2.0-flash-exp'),
    schema: TitleGenerationSchema,
    prompt: `
      Generate 5 compelling, professional ebook titles for the topic: "${topic}"
      
      ${documentContext ? `Context from uploaded documents:\n${documentContext.slice(0, 10000)}\n\nUse this context to make titles more specific and valuable. Reference specific concepts, methodologies, or insights from the documents when relevant.\n\n` : ''}
      
      Requirements:
      - Each title should be unique and engaging
      - Target both beginners and intermediate learners
      - Include variety: some direct, some benefit-focused, some curiosity-driven
      - Ensure titles are SEO-friendly and marketable
      - Length: 3-8 words each
      ${documentContext ? '- Incorporate insights from the provided documents to add specificity and value' : ''}
      
      Consider these proven title patterns:
      - "The Complete Guide to [Topic]"
      - "Mastering [Topic]: [Benefit]"
      - "[Topic] Secrets: [Promise]"
      - "From Beginner to Pro: [Topic]"
      - "The Ultimate [Topic] [Resource Type]"
      
      Make them specific to the topic while being broadly appealing.
    `
  });

  return (result.object as TitleGenerationType).titles;
}

/**
 * Generate detailed chapter outline with subsections
 * Replaces: ebook-outline-generator edge function
 */
async function generateOutline(request: EbookWriterRequest): Promise<EbookOutline> {
  const preferences = request.content_preferences || {};
  const title = request.title || `The Complete Guide to ${request.topic}`;
  
  // Process uploaded documents for context
  let documentContext = '';
  if (request.uploaded_documents && request.uploaded_documents.length > 0) {
    const { processedText, totalTokens, truncated } = processDocumentsForContext(request.uploaded_documents, 100000); // 100K token limit for outline
    documentContext = processedText;
    
    if (truncated) {
      console.log(`Document context truncated. Total tokens: ${totalTokens}`);
    }
  }
  
  // Dynamic chapter count based on word count level
  const chapterCounts = {
    short: 5,
    medium: 8,
    long: 12
  };
  
  const wordCountLevel = (preferences as any).word_count_level || 'medium';
  const targetChapters = chapterCounts[wordCountLevel as keyof typeof chapterCounts];
  
  // Switch to Gemini 2.0 Flash - 200x cheaper than O1-preview!
  // O1-preview: $15/1M input tokens
  // Gemini 2.0 Flash: $0.075/1M input tokens
  const result = await generateObject({
    model: google('gemini-2.0-flash-exp'),
    schema: OutlineGenerationSchema,
    prompt: `
      Create a comprehensive outline for an ebook titled: "${title}"
      Topic: ${request.topic}
      
      ${documentContext ? `Reference Context from Uploaded Documents:\n${documentContext}\n\nUse this reference material to:\n1. Structure the outline around the specific concepts and frameworks mentioned\n2. Ensure chapters build upon the knowledge from the documents\n3. Include specific methodologies, tools, or insights from the provided content\n4. Create a logical flow that enhances rather than duplicates the uploaded material\n\n` : ''}
      
      Content Requirements:
      - Target Chapters: ${targetChapters}
      - Complexity: ${(preferences as any).complexity || 'intermediate'}
      - Writing Tone: ${(preferences as any).writing_tone || 'professional'}
      - Target Audience: ${(preferences as any).target_audience || 'General learners'}
      - Include Images: ${(preferences as any).include_images ? 'Yes' : 'No'}
      - Include CTAs: ${(preferences as any).include_ctas ? 'Yes' : 'No'}
      
      ${request.outline_preferences?.focus_areas ? 
        `Focus Areas: ${request.outline_preferences.focus_areas.join(', ')}` : ''}
      ${request.outline_preferences?.avoid_topics ? 
        `Avoid: ${request.outline_preferences.avoid_topics.join(', ')}` : ''}
      
      Structure Requirements:
      1. Each chapter should have 3-5 subsections
      2. Progressive learning flow from basic to advanced concepts
      3. Logical transitions between chapters
      4. Actionable content in each section
      5. Balance of theory and practical application
      ${documentContext ? '6. Build upon and reference the uploaded context materials throughout' : ''}
      
      For each chapter:
      - Create compelling, descriptive title
      - Define 3-5 subsections with specific content hints
      - Include key learning objectives
      - Estimate word count (aim for 1,500-2,500 words per chapter)
      ${documentContext ? '- Reference specific concepts from the uploaded documents where relevant' : ''}
      
      Ensure the overall structure tells a complete story about ${request.topic} and provides genuine value to readers${documentContext ? ', leveraging the insights from the uploaded materials' : ''}.
    `
  });

  const outline = result.object as OutlineGenerationType;
  
  return {
    id: `outline_${Date.now()}`,
    chapters: outline.chapters.map((chapter, index) => ({
      id: `chapter_${index + 1}`,
      title: chapter.title,
      description: chapter.key_learning_objectives.join(' • '), // Use learning objectives as description
      subsections: chapter.subsections.map((section, sIndex) => ({
        id: `section_${index + 1}_${sIndex + 1}`,
        title: section.title,
        hint: section.content_hint,
        status: 'pending' as const
      })),
      status: 'pending' as const
    })),
    total_chapters: outline.chapters.length,
    estimated_word_count: outline.estimated_total_words,
    complexity_level: (preferences as any).complexity || 'intermediate',
    writing_tone: (preferences as any).writing_tone || 'professional',
    target_audience: (preferences as any).target_audience || 'General audience',
    include_images: (preferences as any).include_images ?? true,
    include_ctas: (preferences as any).include_ctas ?? true,
    generated_at: new Date().toISOString()
  };
}

/**
 * Generate content for specific sections or chapters
 * Replaces: ebook-content-generator edge function
 */
async function generateContent(request: EbookWriterRequest): Promise<{ 
  chapter_id: string; 
  section_id: string; 
  content: string; 
  word_count: number; 
}[]> {
  if (!request.continuation_context?.existing_chapters) {
    throw new Error('Content generation requires existing outline structure');
  }

  const preferences = request.content_preferences || {};
  const generatedContent: { chapter_id: string; section_id: string; content: string; word_count: number; }[] = [];

  // For each chapter that needs content generation
  for (const chapter of request.continuation_context.existing_chapters) {
    for (const section of chapter.subsections) {
      if (!(section as any).content) { // Only generate missing content
        const content = await generateSectionContent({
          topic: request.topic,
          ebook_title: request.title || `Guide to ${request.topic}`,
          chapter_title: chapter.title,
          section_title: section.title,
          section_hint: section.hint,
          writing_tone: (preferences as any).writing_tone || 'professional',
          target_word_count: section.estimated_word_count || 500,
          context: {
            previous_sections: generatedContent.slice(-2), // Last 2 sections for context
            chapter_objectives: chapter.key_points || [],
            overall_audience: (preferences as any).target_audience || 'general readers'
          },
          uploadedDocuments: request.uploaded_documents
        });

        generatedContent.push({
          chapter_id: chapter.id,
          section_id: section.id,
          content: content.content,
          word_count: content.word_count
        });
      }
    }
  }

  return generatedContent;
}

/**
 * Generate individual section content with context awareness
 */
async function generateSectionContent(params: {
  topic: string;
  ebook_title: string;
  chapter_title: string;
  section_title: string;
  section_hint: string;
  writing_tone: string;
  target_word_count: number;
  context: {
    previous_sections: { chapter_id: string; section_id: string; content: string; word_count: number; }[];
    chapter_objectives: string[];
    overall_audience: string;
  };
  uploadedDocuments?: UploadedDocument[]; // Reference content from uploaded documents
}): Promise<{ content: string; word_count: number }> {
  
  // Process uploaded documents for context
  let documentContext = '';
  if (params.uploadedDocuments && params.uploadedDocuments.length > 0) {
    const { processedText, totalTokens, truncated } = processDocumentsForContext(params.uploadedDocuments, 200000); // 200K token limit for content generation
    documentContext = processedText;
    
    if (truncated) {
      console.log(`Document context truncated for content generation. Total tokens: ${totalTokens}`);
    }
  }
  
  // Gemini 2.0 Flash is 40x cheaper than O1-mini!
  // O1-mini: $3/1M input, $12/1M output
  // Gemini: $0.075/1M input, $0.30/1M output
  const result = await generateObject({
    model: google('gemini-2.0-flash-exp'),
    schema: ContentGenerationSchema,
    prompt: `
      Write comprehensive content for this ebook section:
      
      Ebook: "${params.ebook_title}"
      Chapter: "${params.chapter_title}"
      Section: "${params.section_title}"
      
      ${documentContext ? `Reference Material from Uploaded Documents:\n${documentContext}\n\nUse this reference material to:\n1. Support your content with specific examples, data, or insights from the documents\n2. Reference methodologies, frameworks, or best practices mentioned\n3. Provide concrete examples that build upon the uploaded material\n4. Ensure accuracy by grounding claims in the provided context\n5. Add depth and authority by citing specific points from the documents\n\n` : ''}
      
      Content Guidelines:
      - Topic Focus: ${params.topic}
      - Section Hint: ${params.section_hint}
      - Writing Tone: ${params.writing_tone}
      - Target Length: ${params.target_word_count} words
      - Target Audience: ${params.context.overall_audience}
      
      Content Requirements:
      1. Start with a clear introduction to the section topic
      2. Provide detailed, actionable information
      3. Include practical examples or case studies where relevant
      4. Use clear, engaging language appropriate to the tone
      5. End with key takeaways or transition to next concepts
      6. Ensure content flows naturally from previous sections
      ${documentContext ? '7. Reference and build upon the uploaded context materials throughout the content' : ''}
      ${documentContext ? '8. Cite specific examples, data points, or methodologies from the uploaded documents' : ''}
      
      ${params.context.previous_sections.length > 0 ? 
        `Previous Context: Build upon concepts from previous sections while introducing new material.` : ''}
      
      ${params.context.chapter_objectives.length > 0 ?
        `Chapter Objectives to Address: ${params.context.chapter_objectives.join(', ')}` : ''}
      
      Write engaging, valuable content that genuinely helps readers understand and apply concepts related to ${params.topic}.
      The content should be informative, well-structured, and maintain consistent quality throughout${documentContext ? ', with strong grounding in the provided reference materials' : ''}.
    `
  });

  const content = result.object as ContentGenerationType;
  return {
    content: content.content,
    word_count: content.word_count
  };
}

/**
 * Generate professional book cover using Ideogram V3 Turbo
 * Replaces: ebook-cover-generator edge function
 */
async function generateCover(request: EbookWriterRequest): Promise<{ image_url: string; style_details: string }> {
  const preferences = request.cover_preferences;
  if (!preferences) {
    throw new Error('Cover generation requires cover preferences');
  }

  const title = request.title || `The Complete Guide to ${request.topic}`;
  
  // Create optimized prompt for professional ebook cover generation
  const coverPrompt = `
    Professional ebook cover design for "${title}"
    
    Style: ${preferences.style} design
    Color Scheme: ${preferences.color_scheme} colors
    Typography: ${preferences.font_style} font style
    Author: ${preferences.author_name}
    ${preferences.subtitle ? `Subtitle: ${preferences.subtitle}` : ''}
    
    Topic: ${request.topic}
    
    Design Requirements:
    - Clean, professional layout suitable for digital sales and Amazon KDP
    - Title text clearly readable at thumbnail size (bold, prominent placement)
    - Appropriate imagery and visual elements related to ${request.topic}
    - Modern, marketable design that stands out on bookstore shelves
    - 2:3 aspect ratio (standard ebook proportions)
    - High contrast text for readability
    - Professional typography with proper text hierarchy
    - Visual elements that convey expertise and value
    - Target audience appeal for ${request.topic} learners
    
    Create a visually striking cover that immediately communicates the book's value and professionalism.
  `;

  try {
    console.log(`🎨 Generating ebook cover for: "${title}"`);
    
    // Create prediction using Ideogram V3 Turbo - optimized for professional designs
    const prediction = await createIdeogramV3TurboPrediction({
      prompt: coverPrompt,
      aspect_ratio: '2:3', // Standard ebook aspect ratio
      style_type: 'Design', // Optimal for professional covers
      magic_prompt_option: 'On', // Enhanced prompts for better results
      resolution: '832x1216', // High quality for ebook covers
    });

    // Wait for completion with 5-minute timeout
    const result = await waitForIdeogramV3TurboCompletion(prediction.id);
    
    if (result.status === 'succeeded' && result.output && result.output.length > 0) {
      const imageUrl = result.output[0]; // First generated image
      console.log(`✅ Ebook cover generated successfully: ${imageUrl}`);
      
      return {
        image_url: imageUrl,
        style_details: `Generated ${preferences.style} ebook cover with ${preferences.color_scheme} color scheme and ${preferences.font_style} typography using Ideogram V3 Turbo`
      };
    } else {
      console.error(`❌ Cover generation failed: ${result.error || 'Unknown error'}`);
      throw new Error(`Cover generation failed: ${result.error || 'No output received'}`);
    }
    
  } catch (error) {
    console.error('Cover generation error:', error);
    
    // Fallback to placeholder if Ideogram fails
    const fallbackUrl = `https://via.placeholder.com/400x600/${preferences.color_scheme.replace('#', '')}/ffffff?text=${encodeURIComponent(title)}`;
    
    return {
      image_url: fallbackUrl,
      style_details: `Fallback placeholder cover (Ideogram API unavailable) - ${preferences.style} style with ${preferences.color_scheme} colors`
    };
  }
}

/**
 * Calculate estimated credits for a request
 */
function calculateEstimatedCredits(request: EbookWriterRequest): number {
  let credits = 0;
  
  switch (request.workflow_intent) {
    case 'title_only':
      credits = 0; // Free
      break;
    case 'outline_only':
      credits = 5;
      break;
    case 'full_content':
      credits = calculateContentCredits(request);
      break;
    case 'cover_only':
      credits = 10;
      break;
    case 'complete_ebook':
      credits = 5 + calculateContentCredits(request) + (request.cover_preferences ? 10 : 0);
      break;
  }
  
  return credits;
}

/**
 * Calculate credits needed for content generation
 */
function calculateContentCredits(request: EbookWriterRequest): number {
  const preferences = request.content_preferences || {};
  const wordCountMultipliers = {
    short: 5,    // 5 chapters
    medium: 8,   // 8 chapters  
    long: 12     // 12 chapters
  };
  
  const wordLevel = (preferences as any).word_count_level || 'medium';
  const chapters = wordCountMultipliers[wordLevel as keyof typeof wordCountMultipliers];
  return chapters * 8; // 8 credits per chapter (matching analysis)
}

/**
 * Generate content for a specific chapter
 * Uses AI to create detailed chapter content based on outline
 */
export async function generateEbookChapterContent(
  chapterTitle: string,
  chapterDescription: string,
  subsections: { id: string; title: string; description?: string }[],
  ebookTitle: string,
  ebookTopic: string,
  targetWordCount: number = 2000,
  writingTone: string = 'engaging',
  uploadedDocuments?: UploadedDocument[]
): Promise<{ success: boolean; content?: string; error?: string }> {
  
  try {
    // Process any uploaded documents for context
    const documentContext = uploadedDocuments?.length 
      ? await processDocumentsForContext(uploadedDocuments)
      : null;
    
    // Build the prompt with chapter context
    const prompt = `You are writing Chapter "${chapterTitle}" for the ebook titled "${ebookTitle}".

Topic: ${ebookTopic}
Chapter Description: ${chapterDescription}
Target Word Count: ${targetWordCount} words
Writing Tone: ${writingTone}

${subsections.length > 0 ? `
This chapter should cover the following sections:
${subsections.map((s, i) => `${i+1}. ${s.title}${s.description ? ` - ${s.description}` : ''}`).join('\n')}
` : ''}

${documentContext ? `
Reference Materials:
${documentContext}
` : ''}

Write comprehensive, engaging content for this chapter. Include:
- An engaging introduction that hooks the reader
- Clear explanations with real-world examples
- Actionable insights and practical advice
- Smooth transitions between sections
- A compelling conclusion that summarizes key points

Format the content with proper paragraphs and sections. IMPORTANT: Do not include the chapter title "${chapterTitle}" in your response - start directly with the content.`;

    // Generate the chapter content
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      maxTokens: 4000,
      temperature: 0.7,
    });

    return {
      success: true,
      content: text
    };
    
  } catch (error) {
    console.error('Chapter content generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate chapter content'
    };
  }
}

/**
 * Export ebook to various formats
 * Replaces: ebook-writer-export edge function
 */
export async function exportEbook(
  ebookId: string,
  format: 'pdf' | 'epub' | 'docx',
  _userId: string
): Promise<{ success: boolean; download_url?: string; error?: string }> {
  
  try {
    // This would integrate with export services
    // For now, return a mock response
    
    const mockUrl = `https://example.com/exports/${ebookId}.${format}`;
    
    return {
      success: true,
      download_url: mockUrl
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    };
  }
}

/**
 * Get ebook generation history
 * Replaces: History functionality from ebook-writer-service
 */
export async function getEbookHistory(
  _userId: string,
  _limit: number = 20,
  _offset: number = 0
): Promise<{
  success: boolean;
  ebooks?: unknown[];
  total_count?: number;
  error?: string;
}> {
  
  try {
    // This would query the database
    // For now, return mock data
    
    return {
      success: true,
      ebooks: [],
      total_count: 0
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch history'
    };
  }
}