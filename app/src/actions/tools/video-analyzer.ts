'use server';

import { createClient } from '@/app/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

// Analysis type prompts
const PROMPTS = {
  storyboard_recreation: `You are a professional video breakdown specialist for storyboard recreation.

Your task is to create a PRECISE shot-by-shot breakdown that can be used to recreate this video as a storyboard.

OUTPUT FORMAT - Use this EXACT format for each shot/cut:

## SHOT LIST FOR STORYBOARD RECREATION

**Total Shots:** [number]
**Total Duration:** [duration]
**Pacing Style:** [fast cuts / medium / slow cinematic]

---

**SHOT 1** | 0:00-0:03 | 3s
**Type:** [Close-up / Medium shot / Wide shot / etc.]
**Camera:** [Static / Pan left / Dolly in / etc.]
**Description:** [Precise visual description of what's in frame]
**Key Elements:** [Subject, props, background elements]
**Lighting:** [Natural daylight / Studio lighting / etc.]
**Mood:** [Energetic / Calm / Dramatic / etc.]

---

**SHOT 2** | 0:03-0:06 | 3s
[Same format...]

---

[Continue for ALL shots in the video]

## STORYBOARD NOTES
- Visual style consistency notes
- Color palette
- Key recurring elements
- Transition patterns

IMPORTANT:
- Be EXTREMELY precise with timings - every cut/transition should be noted
- Describe visuals in enough detail to recreate in AI image generation
- Include composition details (rule of thirds, centered, etc.)
- Note any on-screen text or graphics`,

  full_breakdown: `You are an expert video analyst and cinematic breakdown specialist.

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
- Suggested adaptations for different products/brands`,

  shot_list: `You are a professional cinematographer and video editor.

Analyze this video and create a detailed SHOT LIST focusing on the visual and camera aspects:

## SHOT LIST

For each distinct shot/cut in the video:

### Shot [X]
- **Timing:** [start - end] ([duration]s)
- **Shot Type:** (extreme wide, wide, medium wide, medium, medium close-up, close-up, extreme close-up, insert)
- **Camera Angle:** (eye level, low angle, high angle, bird's eye, dutch/tilted)
- **Camera Movement:** (static, pan left/right, tilt up/down, dolly in/out, tracking, crane, handheld, zoom)
- **Lens:** (wide angle, standard, telephoto, macro - estimate focal length if possible)
- **Composition:** (rule of thirds, centered, leading lines, symmetry, depth)
- **Subject/Focus:** What is in frame and what is in focus
- **Transition:** How this shot connects to the next (cut, dissolve, fade, wipe)

## TECHNICAL SUMMARY
- Total number of shots
- Average shot duration
- Dominant shot types used
- Camera movement patterns
- Editing rhythm/pacing style`,

  script_extraction: `You are a professional transcriptionist and script analyst.

Analyze this video and extract all spoken and written content:

## NARRATION/VOICEOVER
Transcribe any voiceover narration with timestamps:
[00:00] "Text here..."
[00:05] "Next line..."

## DIALOGUE
If there are speaking characters, transcribe their dialogue:
[00:00] SPEAKER NAME: "Dialogue here..."

## ON-SCREEN TEXT
List all text that appears on screen:
- [00:00-00:05] "Text content" (location: lower third / center / etc.)

## SOUND CUES
Note significant audio cues that support the narrative:
- [00:00] Music begins (describe mood)
- [00:10] Sound effect (describe)

## SCRIPT STRUCTURE
- Hook/Opening (what grabs attention)
- Main message/body
- Call to action (if any)
- Closing

## TONE ANALYSIS
- Speaking pace (words per minute estimate)
- Emotional tone
- Target audience implied by language choices`,

  custom_only: '', // Will be replaced with user's custom prompt
};

type AnalysisType = 'storyboard_recreation' | 'full_breakdown' | 'shot_list' | 'script_extraction' | 'custom_only';

interface AnalyzeVideoRequest {
  videoBase64: string;
  videoMimeType: string;
  videoDurationSeconds: number;
  analysisType: AnalysisType;
  customPrompt?: string;
  title: string;
}

interface AnalyzeYouTubeRequest {
  youtubeUrl: string;
  analysisType: AnalysisType;
  customPrompt?: string;
}

interface AnalyzeVideoResponse {
  success: boolean;
  analysis?: string;
  error?: string;
}

function buildPrompt(analysisType: AnalysisType, customPrompt?: string): string {
  if (analysisType === 'custom_only') {
    if (!customPrompt) {
      throw new Error('Custom prompt is required when using custom_only analysis type');
    }
    return customPrompt;
  }

  let prompt = PROMPTS[analysisType];
  if (customPrompt) {
    prompt += `\n\n## ADDITIONAL INSTRUCTIONS\n${customPrompt}`;
  }
  return prompt;
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

    console.log('📝 Analyzing video with Gemini 2.0 Flash...', {
      mimeType: request.videoMimeType,
      duration: request.videoDurationSeconds,
      analysisType: request.analysisType,
      creditsUsed
    });

    // Build the prompt based on analysis type
    const finalPrompt = buildPrompt(request.analysisType, request.customPrompt);

    // Use Gemini 2.0 Flash for video analysis
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
        analysis_prompt: request.analysisType,
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

export async function analyzeYouTubeVideo(request: AnalyzeYouTubeRequest): Promise<AnalyzeVideoResponse> {
  console.log('🎬 Server Action: analyzeYouTubeVideo called');

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

    // For YouTube videos, we charge a flat 6 credits (assuming ~2 min average)
    const creditsUsed = 6;

    console.log('📝 Analyzing YouTube video with Gemini 2.0 Flash...', {
      url: request.youtubeUrl,
      analysisType: request.analysisType,
      creditsUsed
    });

    // Build the prompt based on analysis type
    const finalPrompt = buildPrompt(request.analysisType, request.customPrompt);

    // Use Gemini 2.0 Flash for video analysis
    // Gemini can analyze YouTube URLs directly
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: 'video/mp4',
          fileUri: request.youtubeUrl
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

    console.log('✅ YouTube video analysis generated successfully');

    // Extract video title from URL for saving
    const videoId = request.youtubeUrl.match(/(?:v=|youtu\.be\/|shorts\/)([^&?/]+)/)?.[1] || 'youtube-video';
    const title = `YouTube: ${videoId}`;

    // Save to database
    const { error: saveError } = await supabase
      .from('video_analyses')
      .insert({
        user_id: user.id,
        title,
        video_url: request.youtubeUrl,
        analysis_prompt: request.analysisType,
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
    console.error('💥 YouTube video analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'YouTube video analysis failed'
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
