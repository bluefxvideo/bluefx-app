'use server';

import { createClient } from '@/app/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SceneBreakdownRequest, SceneBreakdownResponse, BreakdownScene } from '@/lib/scene-breakdown/types';
import { MOTION_PRESETS } from '@/lib/scene-breakdown/motion-presets';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

// Build the motion presets reference for the AI
const MOTION_PRESETS_REFERENCE = MOTION_PRESETS.map(p =>
  `${p.id}. ${p.name}: "${p.prompt}"`
).join('\n');

const BREAKDOWN_SYSTEM_PROMPT = `You are a script breakdown specialist for video production. Your job is to convert narration scripts into production-ready scene breakdowns.

Given a script or narration text, break it down into individual scenes/shots.

## RULES FOR SCENE BREAKDOWN:
1. Each scene should contain ONE sentence of narration (~5-6 seconds when spoken)
2. Split on sentence boundaries (periods, exclamation marks, question marks)
3. Keep the exact narration text from the script - do not paraphrase
4. Generate detailed VISUAL PROMPT for image generation (what the viewer sees)
5. Generate appropriate MOTION/CAMERA PROMPT for video generation
6. Select the best matching motion preset ID from the list below

## MOTION PRESETS (choose the best match):
${MOTION_PRESETS_REFERENCE}

## OUTPUT FORMAT:
Return valid JSON matching this exact structure:
{
  "globalAestheticPrompt": "A detailed visual style description that applies to ALL scenes in the video. Include: lighting style, color palette, camera quality, film grain/texture, mood, era/period if applicable. Example: 'Cinematic documentary style, warm golden hour lighting, shallow depth of field, 35mm film grain, historical authenticity, muted earth tones with rich shadows'",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": "5s",
      "narration": "The exact sentence from the script",
      "visualPrompt": "Detailed visual description for image generation. Include: subject, setting, composition, lighting, mood, colors, camera angle. Be specific enough for AI image generation.",
      "motionPrompt": "Camera movement and any action that happens. This guides the video generation after the image is created.",
      "motionPresetId": 6
    }
  ]
}

## IMPORTANT:
- The visualPrompt should describe WHAT WE SEE, not what is said
- The motionPrompt describes HOW THE CAMERA MOVES or what action occurs
- motionPresetId should match the closest preset from the list above
- Aim for 5-6 seconds per scene (approximately one sentence)
- For historical/documentary content, ensure visual authenticity
- Be specific and detailed - these prompts will be used directly for AI generation`;

export async function breakdownScript(
  request: SceneBreakdownRequest
): Promise<SceneBreakdownResponse> {
  console.log('🎬 Server Action: breakdownScript called');

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

    // Validate input
    if (!request.scriptText || request.scriptText.trim().length === 0) {
      return {
        success: false,
        error: 'Script text is required'
      };
    }

    // Build the user prompt
    const userPrompt = `## SCRIPT TO BREAK DOWN:
${request.scriptText}

${request.visualStyle ? `## VISUAL STYLE PREFERENCE:\n${request.visualStyle}\n` : ''}

Break this script into individual scenes. Remember:
- One sentence per scene (~5-6 seconds spoken)
- Keep exact narration text
- Generate detailed visual and motion prompts
- Select appropriate motion preset IDs

Output valid JSON only, no markdown code blocks.`;

    console.log('📝 Breaking down script with Gemini 2.5 Flash...');

    // Use Gemini 2.5 Flash for fast generation
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const result = await model.generateContent([
      { text: BREAKDOWN_SYSTEM_PROMPT },
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

    console.log('✅ Script breakdown generated successfully');

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
      console.error('Raw response:', responseText.substring(0, 500));
      return {
        success: false,
        error: 'Failed to parse AI response. Please try again.'
      };
    }

    // Validate the response structure
    if (!parsedResponse.globalAestheticPrompt || !Array.isArray(parsedResponse.scenes)) {
      return {
        success: false,
        error: 'Invalid response structure from AI'
      };
    }

    // Ensure all scenes have required fields
    const validatedScenes: BreakdownScene[] = parsedResponse.scenes.map((scene: Partial<BreakdownScene>, index: number) => ({
      sceneNumber: scene.sceneNumber ?? index + 1,
      duration: scene.duration ?? '5s',
      narration: scene.narration ?? '',
      visualPrompt: scene.visualPrompt ?? '',
      motionPrompt: scene.motionPrompt ?? '',
      motionPresetId: scene.motionPresetId ?? 1, // Default to Static
    }));

    console.log(`📊 Breakdown complete: ${validatedScenes.length} scenes`);

    return {
      success: true,
      result: {
        globalAestheticPrompt: parsedResponse.globalAestheticPrompt,
        scenes: validatedScenes,
      }
    };

  } catch (error) {
    console.error('💥 Script breakdown error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to break down script'
    };
  }
}

// ============================================================================
// Save/Load Functions for Script Breakdowns
// ============================================================================

export interface SavedBreakdown {
  id: string;
  title: string;
  script_text: string | null;
  global_aesthetic: string;
  scenes: BreakdownScene[];
  created_at: string;
  updated_at: string;
}

export interface SaveBreakdownRequest {
  title: string;
  scriptText?: string;
  globalAesthetic: string;
  scenes: BreakdownScene[];
}

export interface SaveBreakdownResponse {
  success: boolean;
  breakdown?: SavedBreakdown;
  error?: string;
}

export interface ListBreakdownsResponse {
  success: boolean;
  breakdowns?: SavedBreakdown[];
  error?: string;
}

/**
 * Save a script breakdown to the database
 */
export async function saveBreakdown(
  request: SaveBreakdownRequest
): Promise<SaveBreakdownResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('script_breakdowns')
      .insert({
        user_id: user.id,
        title: request.title,
        script_text: request.scriptText || null,
        global_aesthetic: request.globalAesthetic,
        scenes: request.scenes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving breakdown:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      breakdown: {
        id: data.id,
        title: data.title,
        script_text: data.script_text,
        global_aesthetic: data.global_aesthetic,
        scenes: data.scenes as BreakdownScene[],
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    };
  } catch (error) {
    console.error('Save breakdown error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save breakdown',
    };
  }
}

/**
 * List all saved breakdowns for the current user
 */
export async function listBreakdowns(): Promise<ListBreakdownsResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('script_breakdowns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listing breakdowns:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      breakdowns: data.map(row => ({
        id: row.id,
        title: row.title,
        script_text: row.script_text,
        global_aesthetic: row.global_aesthetic,
        scenes: row.scenes as BreakdownScene[],
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    };
  } catch (error) {
    console.error('List breakdowns error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list breakdowns',
    };
  }
}

/**
 * Load a specific breakdown by ID
 */
export async function loadBreakdown(id: string): Promise<SaveBreakdownResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('script_breakdowns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error loading breakdown:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      breakdown: {
        id: data.id,
        title: data.title,
        script_text: data.script_text,
        global_aesthetic: data.global_aesthetic,
        scenes: data.scenes as BreakdownScene[],
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    };
  } catch (error) {
    console.error('Load breakdown error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load breakdown',
    };
  }
}

/**
 * Delete a breakdown by ID
 */
export async function deleteBreakdown(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { error } = await supabase
      .from('script_breakdowns')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting breakdown:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete breakdown error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete breakdown',
    };
  }
}
