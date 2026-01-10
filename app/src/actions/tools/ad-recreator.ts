'use server';

import { createClient } from '@/app/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

// Types
export interface GenerateScenePromptsRequest {
  // The raw analysis text from Video Analyzer
  analysisText: string;
  // User's product/offer details
  productDescription: string;
  productName?: string;
  // Custom instructions for adaptation
  customInstructions?: string;
  // Visual style preference
  visualStyle?: string;
}

export interface Scene {
  sceneNumber: number;
  startTime: string;
  endTime: string;
  duration: string;
  originalDescription: string;
  adaptedDescription: string;
  purpose: string; // Hook, Agitate, Solution, CTA, etc.
}

export interface StoryboardPrompt {
  gridNumber: number;
  scenesCovered: string; // "1-9" or "10-12"
  prompt: string;
}

export interface GenerateScenePromptsResponse {
  success: boolean;
  // Summary
  videoSummary?: string;
  totalDuration?: string;
  sceneCount?: number;
  gridsNeeded?: number;
  // Structured data
  scenes?: Scene[];
  storyboardPrompts?: StoryboardPrompt[];
  // Error handling
  error?: string;
}

const SCENE_PROMPT_SYSTEM = `You are an expert ad recreation specialist. Your job is to analyze a video breakdown and help users recreate similar ads for their own products.

You will receive:
1. A detailed video analysis (scene breakdown, shots, timing)
2. The user's product/offer description
3. Optional custom instructions

Your task:
1. Extract all distinct scenes from the analysis
2. Identify the PURPOSE of each scene (Hook, Problem, Agitate, Solution, Benefit, Social Proof, CTA, etc.)
3. Adapt each scene description for the user's product while keeping the same structure/purpose
4. Group scenes into 3x3 grids (9 scenes per grid)
5. Generate ready-to-use storyboard prompts

CRITICAL RULES FOR STORYBOARD PROMPTS:
- Each grid prompt must describe exactly 9 frames
- Use "Frame 1:", "Frame 2:", etc. format
- Include visual style consistency notes
- Add "NO gaps, NO borders, NO black bars between frames" instruction
- Make prompts detailed enough for AI image generation
- If the video has fewer than 9 scenes, create additional supporting frames (variations, alternate angles, B-roll concepts)
- If the video has more than 9 scenes, create multiple grid prompts

Output your response as valid JSON matching this exact structure:
{
  "videoSummary": "Brief summary of the original video style and approach",
  "totalDuration": "Estimated total duration",
  "scenes": [
    {
      "sceneNumber": 1,
      "startTime": "0:00",
      "endTime": "0:03",
      "duration": "3s",
      "originalDescription": "What happens in the original",
      "adaptedDescription": "How to recreate for user's product",
      "purpose": "Hook"
    }
  ],
  "storyboardPrompts": [
    {
      "gridNumber": 1,
      "scenesCovered": "1-9",
      "prompt": "Create a 3x3 cinematic storyboard grid (3 columns, 3 rows = 9 frames).\\n\\nCRITICAL: NO gaps, NO borders, NO black bars between frames. All frames must touch edge-to-edge in a seamless grid.\\n\\nFrame 1: [detailed description]\\nFrame 2: [detailed description]\\n...\\nFrame 9: [detailed description]\\n\\nSTYLE: [visual style notes], consistent characters throughout all frames."
    }
  ]
}`;

export async function generateScenePrompts(
  request: GenerateScenePromptsRequest
): Promise<GenerateScenePromptsResponse> {
  console.log('🎬 Server Action: generateScenePrompts called');

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

## USER'S PRODUCT/OFFER
${request.productName ? `Product Name: ${request.productName}\n` : ''}${request.productDescription}

${request.customInstructions ? `## CUSTOM INSTRUCTIONS\n${request.customInstructions}` : ''}

${request.visualStyle ? `## PREFERRED VISUAL STYLE\n${request.visualStyle}` : ''}

Now analyze this video breakdown and generate:
1. A scene-by-scene breakdown adapted for the user's product
2. Ready-to-use 3x3 storyboard grid prompts

Remember: Output valid JSON only, no markdown code blocks.`;

    console.log('📝 Generating scene prompts with Gemini...');

    // Use Gemini 2.0 Flash for fast generation
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const result = await model.generateContent([
      { text: SCENE_PROMPT_SYSTEM },
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

    console.log('✅ Scene prompts generated successfully');

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
      totalDuration: parsedResponse.totalDuration,
      sceneCount: parsedResponse.scenes?.length || 0,
      gridsNeeded: parsedResponse.storyboardPrompts?.length || 0,
      scenes: parsedResponse.scenes,
      storyboardPrompts: parsedResponse.storyboardPrompts,
    };

  } catch (error) {
    console.error('💥 Scene prompt generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate scene prompts'
    };
  }
}

/**
 * Save ad recreation project to database
 */
export async function saveAdRecreatorProject(data: {
  name: string;
  sourceAnalysisId?: string;
  productDescription: string;
  customInstructions?: string;
  scenes: Scene[];
  storyboardPrompts: StoryboardPrompt[];
}): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data: project, error: insertError } = await supabase
      .from('ad_projects')
      .insert({
        user_id: user.id,
        name: data.name,
        status: 'scripting',
        source_type: data.sourceAnalysisId ? 'video_analyzer' : 'manual',
        source_video_analysis_id: data.sourceAnalysisId || null,
        script_content: JSON.stringify({
          scenes: data.scenes,
          storyboardPrompts: data.storyboardPrompts,
        }),
        storyboard_prompt: data.storyboardPrompts[0]?.prompt || '',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error saving project:', insertError);
      return { success: false, error: 'Failed to save project' };
    }

    return { success: true, projectId: project.id };
  } catch (error) {
    console.error('Error saving ad recreator project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save project'
    };
  }
}
