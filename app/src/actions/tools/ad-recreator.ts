'use server';

import { createClient } from '@/app/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

// Types
export interface GenerateStoryboardPromptsRequest {
  // The raw analysis text from Video Analyzer
  analysisText: string;
  // Visual style preference (optional)
  visualStyle?: string;
}

export interface Shot {
  shotNumber: number;
  startTime: string;
  endTime: string;
  duration: string;
  shotType: string;
  camera: string;
  description: string;
}

export interface StoryboardPrompt {
  gridNumber: number;
  shotsCovered: string; // "1-9" or "10-18"
  prompt: string;
}

export interface GenerateStoryboardPromptsResponse {
  success: boolean;
  // Summary
  videoSummary?: string;
  totalShots?: number;
  gridsNeeded?: number;
  // Structured data
  shots?: Shot[];
  storyboardPrompts?: StoryboardPrompt[];
  // Error handling
  error?: string;
}

const STORYBOARD_PROMPT_SYSTEM = `You are a storyboard prompt generator. Your job is to convert video shot breakdowns into ready-to-use AI storyboard generation prompts.

You will receive a video analysis with shot-by-shot breakdown.

Your task:
1. FIRST: Extract detailed CHARACTER PROFILES for ALL recurring characters in the video
2. Extract all distinct shots from the analysis with their exact timings
3. Group shots into 3x3 grids (9 shots per grid)
4. Generate ready-to-use storyboard prompts that EXACTLY recreate each shot

## CHARACTER CONSISTENCY (CRITICAL)
Before generating prompts, identify ALL characters that appear in multiple shots and create detailed profiles:
- Assign each character a consistent identifier (e.g., "MAIN CHARACTER", "CHARACTER A", "CHARACTER B")
- Document: age, gender, ethnicity, hair (color, length, style), facial features, body type
- Document: clothing/wardrobe for each scene (be VERY specific about colors, styles)
- Document: any distinguishing features (scars, glasses, jewelry, tattoos, etc.)

These character profiles MUST be included at the TOP of EVERY grid prompt to ensure the AI generates consistent characters across all grids.

CRITICAL RULES FOR STORYBOARD PROMPTS:
- Each grid prompt must describe exactly 9 frames
- Use "Frame 1:", "Frame 2:", etc. format
- Copy the EXACT visual descriptions from the analysis - do NOT change or "adapt" anything
- Keep all the same subjects, actions, camera angles, lighting
- Include style consistency notes from the original video
- Add "NO gaps, NO borders, NO black bars between frames" instruction
- If the video has fewer than 9 shots, duplicate/extend key shots or add slight variations
- If the video has more than 9 shots, create multiple grid prompts
- ALWAYS include the CHARACTER PROFILES section at the start of each prompt

Output your response as valid JSON matching this exact structure:
{
  "videoSummary": "Brief summary of the video style (e.g., 'Fast-paced fitness ad, 12 shots, dynamic camera work')",
  "characterProfiles": [
    {
      "id": "MAIN CHARACTER",
      "description": "35-year-old Caucasian male, short brown hair with slight wave, light stubble, athletic build, blue eyes"
    },
    {
      "id": "CHARACTER A",
      "description": "40-year-old African male, bald, muscular build, warm brown eyes, wearing earth-toned clothing"
    }
  ],
  "shots": [
    {
      "shotNumber": 1,
      "startTime": "0:00",
      "endTime": "0:03",
      "duration": "3s",
      "shotType": "Close-up",
      "camera": "Static",
      "description": "Exact visual description from the analysis"
    }
  ],
  "storyboardPrompts": [
    {
      "gridNumber": 1,
      "shotsCovered": "1-9",
      "prompt": "Create a 3x3 cinematic storyboard grid (3 columns, 3 rows = 9 frames).\\n\\nCRITICAL: NO gaps, NO borders, NO black bars between frames. All frames must touch edge-to-edge in a seamless grid.\\n\\n## CONSISTENT CHARACTERS (maintain these EXACT appearances in ALL frames):\\n- MAIN CHARACTER: [full character description]\\n- CHARACTER A: [full character description]\\n\\nFrame 1: [exact description, referencing characters by their ID]\\nFrame 2: [exact description]\\n...\\nFrame 9: [exact description]\\n\\nSTYLE: [style notes], maintain visual consistency across all frames. Characters must look IDENTICAL in every frame they appear."
    }
  ]
}`;

export async function generateStoryboardPrompts(
  request: GenerateStoryboardPromptsRequest
): Promise<GenerateStoryboardPromptsResponse> {
  console.log('🎬 Server Action: generateStoryboardPrompts called');

  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Build the user prompt
    const userPrompt = `## VIDEO ANALYSIS
${request.analysisText}

${request.visualStyle ? `## PREFERRED VISUAL STYLE\nUse this style: ${request.visualStyle}` : ''}

Convert this video analysis into ready-to-use storyboard prompts.
IMPORTANT: Keep the EXACT shot descriptions - do NOT adapt or change anything.
We want to recreate the original video as closely as possible.

Remember: Output valid JSON only, no markdown code blocks.`;

    console.log('📝 Generating storyboard prompts with Gemini...');

    // Use Gemini 2.0 Flash for fast generation
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const result = await model.generateContent([
      { text: STORYBOARD_PROMPT_SYSTEM },
      { text: userPrompt }
    ]);

    const response = await result.response;
    const responseText = response.text();

    if (!responseText) {
      return {
        success: false,
        error: 'No response generated'
      };
    }

    console.log('✅ Storyboard prompts generated successfully');

    // Parse the JSON response
    let parsedResponse;
    try {
      // Clean up the response (remove markdown code blocks if present)
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.slice(7);
      }
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.slice(0, -3);
      }
      parsedResponse = JSON.parse(cleanJson.trim());
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      console.error('Raw response:', responseText);
      return {
        success: false,
        error: 'Failed to parse AI response. Please try again.'
      };
    }

    return {
      success: true,
      videoSummary: parsedResponse.videoSummary,
      totalShots: parsedResponse.shots?.length || 0,
      gridsNeeded: parsedResponse.storyboardPrompts?.length || 0,
      shots: parsedResponse.shots,
      storyboardPrompts: parsedResponse.storyboardPrompts,
    };

  } catch (error) {
    console.error('💥 Storyboard prompt generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate storyboard prompts'
    };
  }
}

// Keep old function for backwards compatibility but redirect to new one
export interface GenerateScenePromptsRequest {
  analysisText: string;
  productDescription: string;
  productName?: string;
  customInstructions?: string;
  visualStyle?: string;
}

export interface Scene {
  sceneNumber: number;
  startTime: string;
  endTime: string;
  duration: string;
  originalDescription: string;
  adaptedDescription: string;
  purpose: string;
}

export interface GenerateScenePromptsResponse {
  success: boolean;
  videoSummary?: string;
  totalDuration?: string;
  sceneCount?: number;
  gridsNeeded?: number;
  scenes?: Scene[];
  storyboardPrompts?: StoryboardPrompt[];
  error?: string;
}

// Legacy function - kept for backwards compatibility
export async function generateScenePrompts(
  request: GenerateScenePromptsRequest
): Promise<GenerateScenePromptsResponse> {
  // Just call the new simplified function
  const result = await generateStoryboardPrompts({
    analysisText: request.analysisText,
    visualStyle: request.visualStyle,
  });

  // Transform the response to match old format
  return {
    success: result.success,
    videoSummary: result.videoSummary,
    sceneCount: result.totalShots,
    gridsNeeded: result.gridsNeeded,
    scenes: result.shots?.map(shot => ({
      sceneNumber: shot.shotNumber,
      startTime: shot.startTime,
      endTime: shot.endTime,
      duration: shot.duration,
      originalDescription: shot.description,
      adaptedDescription: shot.description, // No adaptation - exact match
      purpose: shot.shotType,
    })),
    storyboardPrompts: result.storyboardPrompts?.map(p => ({
      gridNumber: p.gridNumber,
      shotsCovered: p.shotsCovered,
      prompt: p.prompt,
    })),
    error: result.error,
  };
}
