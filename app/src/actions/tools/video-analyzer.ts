'use server';

import { createClient } from '@/app/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

// Full SEALCaM breakdown prompt
const ANALYSIS_PROMPT = `You are an expert video analyst and cinematic breakdown specialist.

Analyze this video and provide a comprehensive breakdown using the following structure:

## VIDEO OVERVIEW
- Total duration
- Overall style/genre
- Target audience (inferred)
- Emotional tone/mood arc

## SCENE-BY-SCENE BREAKDOWN

For each distinct scene/shot, provide:

### Scene [X] - [Brief Title]
**Timing:** [start time - end time] ([duration]s)

**S - Subject:**
- Primary focus (person, product, object)
- Character details: appearance, age, gender, wardrobe, accessories
- Expressions and body language

**E - Environment:**
- Location/setting
- Background elements
- Props visible
- Color palette

**A - Action:**
- What is happening
- Movement and gestures
- Transitions from previous scene

**L - Lighting:**
- Light source (natural/artificial)
- Direction and quality
- Contrast level
- Mood created

**Ca - Camera:**
- Shot type (wide, medium, close-up, extreme close-up)
- Angle (eye level, high, low, dutch)
- Movement (static, pan, tilt, dolly, handheld, zoom)
- Lens feel (wide angle, telephoto, macro)

**M - Metatokens:**
- Visual style tags
- Quality descriptors
- Cinematic references

**On-Screen Text:** [any text/graphics visible]
**Narration/Dialogue:** [what is being said, if any]

## AUDIO ANALYSIS
- Music: genre, tempo, instruments, emotional quality
- Sound effects: list key SFX and when they occur
- Voice: tone, pacing, gender, style
- Overall audio mix balance

## PACING ANALYSIS
- Average shot duration
- Rhythm pattern (fast cuts, slow builds, etc.)
- Key dramatic beats

## RECREATION NOTES
- Key elements essential to replicate
- Suggested adaptations for different products/brands`;

interface AnalyzeVideoRequest {
  videoBase64: string;
  videoMimeType: string;
  videoDurationSeconds: number;
  customPrompt?: string;
  title: string;
}

interface AnalyzeVideoResponse {
  success: boolean;
  analysis?: string;
  error?: string;
}

export async function analyzeVideo(request: AnalyzeVideoRequest): Promise<AnalyzeVideoResponse> {
  console.log('🎬 Server Action: analyzeVideo called');

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

    // Calculate credits (3 per minute, minimum 3)
    const minutes = Math.ceil(request.videoDurationSeconds / 60);
    const creditsUsed = Math.max(3, minutes * 3);

    console.log('📝 Analyzing video with Gemini 3 Flash...', {
      mimeType: request.videoMimeType,
      duration: request.videoDurationSeconds,
      creditsUsed
    });

    // Build the prompt with optional custom instructions
    let finalPrompt = ANALYSIS_PROMPT;
    if (request.customPrompt) {
      finalPrompt += `\n\n## ADDITIONAL INSTRUCTIONS\n${request.customPrompt}`;
    }

    // Use Gemini 3 Flash for video analysis
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: request.videoMimeType,
          data: request.videoBase64
        }
      },
      { text: finalPrompt }
    ]);

    const response = await result.response;
    const analysisText = response.text();

    if (!analysisText) {
      return {
        success: false,
        error: 'No analysis generated'
      };
    }

    console.log('✅ Video analysis generated successfully');

    // Save to database
    const { error: saveError } = await supabase
      .from('video_analyses')
      .insert({
        user_id: user.id,
        title: request.title,
        video_duration_seconds: Math.round(request.videoDurationSeconds),
        custom_prompt: request.customPrompt || null,
        analysis_result: analysisText,
        credits_used: creditsUsed,
      });

    if (saveError) {
      console.error('⚠️ Failed to save analysis (non-blocking):', saveError);
    } else {
      console.log('💾 Analysis saved to database');
    }

    return {
      success: true,
      analysis: analysisText
    };

  } catch (error) {
    console.error('💥 Video analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Video analysis failed'
    };
  }
}

interface VideoAnalysis {
  id: string;
  title: string;
  video_url: string | null;
  video_duration_seconds: number | null;
  analysis_result: string;
  custom_prompt: string | null;
  credits_used: number;
  created_at: string;
}

export async function fetchVideoAnalyses(): Promise<{
  success: boolean;
  analyses?: VideoAnalysis[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('video_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching video analyses:', error);
      return { success: false, error: 'Failed to fetch analyses' };
    }

    return { success: true, analyses: data || [] };
  } catch (error) {
    console.error('Error fetching video analyses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch analyses'
    };
  }
}

export async function deleteVideoAnalysis(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    const { error } = await supabase
      .from('video_analyses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting video analysis:', error);
      return { success: false, error: 'Failed to delete analysis' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting video analysis:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete analysis'
    };
  }
}

export async function toggleAnalysisFavorite(id: string): Promise<{
  success: boolean;
  is_favorite?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get current favorite status
    const { data: current, error: fetchError } = await supabase
      .from('video_analyses')
      .select('is_favorite')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !current) {
      return { success: false, error: 'Analysis not found' };
    }

    // Toggle
    const newStatus = !current.is_favorite;
    const { error: updateError } = await supabase
      .from('video_analyses')
      .update({ is_favorite: newStatus })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error toggling favorite:', updateError);
      return { success: false, error: 'Failed to update favorite status' };
    }

    return { success: true, is_favorite: newStatus };
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle favorite'
    };
  }
}
