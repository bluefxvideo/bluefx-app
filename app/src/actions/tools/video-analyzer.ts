'use server';

import { createClient } from '@/app/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

// Analysis type prompts
const PROMPTS = {
  storyboard_recreation: `You are a professional video breakdown specialist for storyboard recreation.

Your task is to create a COMPREHENSIVE shot-by-shot breakdown that captures EVERY detail needed to recreate this video as a storyboard.

## OUTPUT FORMAT

### VIDEO OVERVIEW
- **Total Duration:** [duration]
- **Total Shots/Scenes:** [number]
- **Pacing Style:** [fast cuts / medium / slow cinematic]
- **Overall Mood Arc:** [e.g., "Builds from calm to intense"]
- **Visual Style:** [e.g., "Cinematic realism, desaturated colors"]
- **Target Audience:** [inferred from content]

### AUDIO ANALYSIS
- **Music:** [Genre, tempo, instruments, emotional quality, when it changes]
- **Voiceover/Narration:** [Full transcript with timestamps if present]
- **Dialogue:** [Full transcript with timestamps, speaker identification]
- **Sound Effects:** [Key SFX and when they occur]
- **Audio Mix:** [What dominates - music, voice, SFX]

---

## SHOT-BY-SHOT BREAKDOWN

For EACH shot/cut, provide:

### SHOT [X] | [start time]-[end time] | [duration]

**S - Subject:**
- Primary focus (person, product, object)
- Character details: appearance, age, gender, wardrobe, accessories
- Expressions and body language
- Position in frame (center, rule of thirds, etc.)

**E - Environment:**
- Location/setting (specific details)
- Background elements
- Props visible
- Color palette of scene

**A - Action:**
- What is happening (be specific)
- Movement and gestures
- Interaction between elements
- Transition from previous shot

**L - Lighting:**
- Light source (natural/artificial, direction)
- Quality (soft, hard, diffused)
- Contrast level (high/low)
- Mood created by lighting

**Ca - Camera:**
- Shot type (extreme wide, wide, medium wide, medium, medium close-up, close-up, extreme close-up, insert)
- Camera angle (eye level, low angle, high angle, bird's eye, dutch/tilted)
- Camera movement (static, pan, tilt, dolly, tracking, crane, handheld, zoom)
- Lens feel (wide angle, standard, telephoto)
- Composition notes

**On-Screen Text:** [Any text/graphics visible - exact wording]
**Narration/Dialogue:** [What is being said during this shot - exact words]
**Music/Sound:** [What audio is playing]

---

[Continue for ALL shots]

---

## STORYBOARD RECREATION NOTES
- Visual style consistency requirements
- Color grading notes
- Key recurring visual elements
- Character consistency notes (wardrobe, appearance)
- Transition patterns used
- Pacing rhythm description

CRITICAL INSTRUCTIONS:
- Be EXTREMELY precise with timings - note EVERY cut/transition
- Include ALL dialogue and narration verbatim with timestamps
- Describe visuals in enough detail to recreate in AI image generation
- Note mood shifts and emotional beats
- Include composition details (rule of thirds, centered, leading lines, etc.)
- Capture the PURPOSE of each shot (hook, problem, solution, CTA, etc.)`,

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

// Social Media Video Analysis (TikTok, Instagram, Facebook, Twitter)
export interface AnalyzeSocialVideoRequest {
  socialUrl: string;
  // Direct CDN URL (e.g. winning_ads.video_url from a recent scrape).
  // When provided, the analyzer skips the Apify/HTML-extraction download step
  // and fetches this URL directly — needed for TikTok Creative Center URLs
  // because TikTok now client-renders the video URLs, so HTML scraping fails.
  directVideoUrl?: string;
  analysisType: string;
  customPrompt?: string;
}

export async function analyzeSocialMediaVideo(request: AnalyzeSocialVideoRequest): Promise<AnalyzeVideoResponse> {
  console.log('🎬 Server Action: analyzeSocialMediaVideo called');

  // Import the social video downloader and utils
  const { downloadSocialVideo } = await import('./social-video-downloader');
  const { detectPlatform } = await import('@/lib/social-video-utils');

  const platform = detectPlatform(request.socialUrl);

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

    // For social videos, we charge 6 credits (same as YouTube)
    const creditsUsed = 6;

    // Step 1: Resolve the actual video URL.
    // Prefer the caller-supplied direct URL when available (winning-ads flow);
    // otherwise fall back to Apify / HTML extraction.
    let resolvedVideoUrl: string;
    let resolvedTitle: string | undefined;

    if (request.directVideoUrl) {
      console.log(`🎯 Using direct video URL provided by caller, skipping Apify`);
      resolvedVideoUrl = request.directVideoUrl;
    } else {
      console.log(`📥 Downloading ${platform} video via Apify...`);
      const downloadResult = await downloadSocialVideo(request.socialUrl);

      if (!downloadResult.success || !downloadResult.videoUrl) {
        return {
          success: false,
          error: downloadResult.error || 'Failed to download video'
        };
      }
      resolvedVideoUrl = downloadResult.videoUrl;
      resolvedTitle = downloadResult.title;
    }

    console.log(`✅ Video URL obtained: ${resolvedVideoUrl.slice(0, 100)}...`);

    // Step 2: Download the video content and convert to base64.
    // Gemini doesn't support arbitrary URLs, so we fetch and send as inline data.
    // TikTok signed CDN URLs validate Referer/User-Agent — send them so the
    // fetch isn't 403'd when the URL is a tiktokcdn host.
    const isTikTokCdn = /tiktokcdn(?:-us)?\.com/i.test(resolvedVideoUrl);
    console.log(`📥 Fetching video content${isTikTokCdn ? ' (TikTok CDN)' : ''}...`);

    const videoResponse = await fetch(resolvedVideoUrl, {
      headers: isTikTokCdn
        ? {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://ads.tiktok.com/',
            Origin: 'https://ads.tiktok.com',
          }
        : undefined,
    });

    if (!videoResponse.ok) {
      const hint = isTikTokCdn && (videoResponse.status === 403 || videoResponse.status === 410)
        ? ' The TikTok CDN signed URL may have expired — the winning ads library refreshes every 3 days, so this ad may need a re-scrape.'
        : '';
      return {
        success: false,
        error: `Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}.${hint}`
      };
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBase64 = Buffer.from(videoBuffer).toString('base64');

    console.log(`✅ Video fetched (${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB), analyzing with Gemini...`);

    // Step 3: Build the prompt based on analysis type
    const finalPrompt = buildPrompt(request.analysisType as AnalysisType, request.customPrompt);

    // Step 4: Use Gemini to analyze the video as inline base64 data
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY is not set on the server');
      return { success: false, error: 'Gemini API key is not configured on the server. Contact support.' };
    }
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const geminiStart = Date.now();
    let result;
    try {
      result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'video/mp4',
            data: videoBase64,
          },
        },
        { text: finalPrompt },
      ]);
    } catch (geminiErr) {
      const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      console.error(`❌ Gemini generateContent threw after ${Date.now() - geminiStart}ms:`, msg);
      return { success: false, error: `Gemini request failed: ${msg}` };
    }
    console.log(`🧠 Gemini returned in ${Date.now() - geminiStart}ms`);

    const response = await result.response;
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;

    // response.text() throws if the candidate has no text parts (e.g. blocked
    // by safety filters, MAX_TOKENS with no output, or RECITATION). Log the
    // structured reason so failures are diagnosable from container logs.
    let analysisText = '';
    try {
      analysisText = response.text();
    } catch (textErr) {
      const msg = textErr instanceof Error ? textErr.message : String(textErr);
      console.error(`❌ response.text() threw — finishReason=${finishReason}, safetyRatings=`, candidate?.safetyRatings);
      console.error('   raw candidate (first 600 chars):', JSON.stringify(candidate || {}).slice(0, 600));
      return {
        success: false,
        error: `Gemini returned no text (finishReason=${finishReason || 'UNKNOWN'}): ${msg}`,
      };
    }

    if (!analysisText) {
      console.error(`❌ Empty analysis text — finishReason=${finishReason}, promptFeedback=`, response.promptFeedback);
      return {
        success: false,
        error: `No analysis generated (finishReason=${finishReason || 'UNKNOWN'}). The video may have been blocked by safety filters or exceeded token limits.`,
      };
    }

    console.log(`✅ ${platform} video analysis generated successfully (${analysisText.length} chars, finishReason=${finishReason})`);

    // Generate a title for the analysis
    const title = resolvedTitle
      ? `${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${resolvedTitle.slice(0, 50)}`
      : `${platform.charAt(0).toUpperCase() + platform.slice(1)} Video`;

    // Save to database
    const { error: saveError } = await supabase
      .from('video_analyses')
      .insert({
        user_id: user.id,
        title,
        video_url: request.socialUrl,
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
    console.error(`💥 ${platform} video analysis error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Social media video analysis failed'
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

// ---------------------------------------------------------------------------
// Clone Studio structured scene analysis
// ---------------------------------------------------------------------------
// Same finetuned breakdown framework as PROMPTS.storyboard_recreation
// (S-E-A-L-Ca per shot, verbatim dialogue, shot purpose), upgraded to
// structured JSON aligned to ffmpeg-detected cuts, plus the two rules the
// animation stage requires (verified on a real ad remake):
// - Keyframe-state rule: i2v models refuse to CREATE physically absurd states
//   mid-clip; gag states must be described as ALREADY TRUE in start_state so
//   the image-edit stage paints them into the starting frame.
// - Action-arc rule: "struggles to pull his hand out" gets animated as the
//   hand coming OUT; every scene needs start → attempts → LOCKED end state
//   plus invariants repeated verbatim in the motion prompt.

const CLONE_GLOBAL_ANALYSIS_PROMPT = `You are a professional video breakdown specialist for shot-by-shot ad recreation.

You will receive a full video ad. Extract the GLOBAL context that later per-scene analysis depends on.

## CHARACTER PROFILES (most important)
Identify every person who appears in the ad. Give each a stable ID ("MAIN CHARACTER", "CHARACTER A", ...) and a detailed profile: age, gender, ethnicity, hair (color/length/style), facial features, build, wardrobe per outfit, distinguishing features.

## FIELDS
- "summary": one paragraph — what the ad is, its structure, pacing style, and mood arc.
- "characters": the profiles above.
- "products": every distinct product/brand shown.
- "visual_style": grade, lighting character, lens/format feel, era — enough to keep regenerated frames consistent.
- "music_brief": one sentence for re-scoring (genre, tempo, instrumentation, emotional quality, how it changes).

Output valid JSON only:
{ "summary": "...", "characters": [{ "id": "MAIN CHARACTER", "description": "..." }], "products": ["..."], "visual_style": "...", "music_brief": "..." }`;

const CLONE_SCENE_CLIP_PROMPT = `You are a professional video breakdown specialist. You will receive ONE short clip — a single scene cut from a longer ad — plus the ad's global context (summary + character profiles).

THE CLIP IS THE ENTIRE SCENE. Describe ONLY what is visible and audible inside this clip. Do not anticipate, continue, or reference anything from other scenes. If the clip is under ~2 seconds it is a quick cut — describe exactly its brief content, however minimal.

Refer to people ONLY by the provided character IDs when they match a profile.

Output valid JSON only, matching:
{
  "subject": "primary focus: who/what, expression, body language, position in frame",
  "environment": "location specifics, background elements, visible props, color palette",
  "lighting": "light source and direction, quality, contrast, mood",
  "camera": "shot type, angle, movement, lens feel, composition notes",
  "action_arc": {
    "start_state": "COMPLETE visual description of the clip's FIRST moment — a paintable still frame; any physically impossible/comedic state described as ALREADY TRUE",
    "action": "what happens across THIS CLIP ONLY, as beats; movement only, no camera talk",
    "end_state": "the LOCKED final state at the clip's last frame; explicit about what has NOT changed",
    "invariants": ["hard rules that hold for the whole clip, phrased as absolutes; [] if none"]
  },
  "dialog": "every word spoken/narrated INSIDE this clip, verbatim; empty string if silent",
  "on_screen_text": "overlay text/graphics in this clip, exact wording; empty string if none",
  "purpose": "one of: hook, problem, solution, proof, CTA, transition, story",
  "swap_targets": ["character IDs and product names visible in this clip"]
}`;

const CLONE_SCENE_ANALYSIS_PROMPT = `You are a professional video breakdown specialist for shot-by-shot ad recreation.

You will receive the full video plus a list of scenes detected with exact start/end timestamps. Analyze EACH listed scene (use the timestamps to know which part of the video each scene covers).

## CHARACTER PROFILES (do this first)
Identify every person who appears in more than one scene. Give each a stable ID ("MAIN CHARACTER", "CHARACTER A", ...) and a detailed profile: age, gender, ethnicity, hair (color/length/style), facial features, build, wardrobe per outfit, distinguishing features. Refer to people ONLY by these IDs in scene analyses.

## PER-SCENE FIELDS
For every scene output:

1. "subject" — primary focus (person/product/object), character IDs with expression and body language, position in frame.
2. "environment" — location/setting specifics, background elements, visible props, color palette.
3. "lighting" — light source and direction, quality (soft/hard/diffused), contrast level, mood created.
4. "camera" — shot type (extreme wide … extreme close-up, insert), angle (eye level/low/high/bird's eye/dutch), movement (static/pan/tilt/dolly/tracking/handheld/zoom), lens feel, composition notes.
5. "action_arc" — the motion blueprint:
   - "start_state": a COMPLETE visual description of the scene's FIRST moment — subjects, pose, expression, props, setting, lighting. If the scene contains a physically impossible or comedic state (hand stuck inside a bottle, person shrunk, object floating), describe that state as ALREADY TRUE here. This text is used to paint the starting image, so it must describe a paintable still frame.
   - "action": what happens across the scene as beats (attempt 1 → attempt 2 → reaction). Movement only, no camera talk.
   - "end_state": the LOCKED final state of the scene. Be explicit about what has NOT changed ("the hand is STILL inside the bottle").
   - "invariants": hard rules that must hold for the entire scene, phrased as absolutes ("the bottle NEVER comes off"). Empty array if none.
6. "dialog" — every word spoken or narrated during this scene, verbatim. Empty string if silent.
7. "on_screen_text" — any overlay text/graphics, exact wording. Empty string if none. (Overlays are re-typed in an editor later — never describe them as part of the image.)
8. "purpose" — the shot's narrative role: one of "hook", "problem", "solution", "proof", "CTA", "transition", "story".
9. "swap_targets" — the entities in THIS scene a user might replace — character IDs and product names visible in frame.

## GLOBAL FIELDS
- "summary": one paragraph — what the ad is, its structure, pacing style, and mood arc.
- "products": every distinct product/brand shown.
- "visual_style": grade, lighting character, lens/format feel, era — enough to keep regenerated frames consistent.
- "music_brief": one sentence for re-scoring (genre, tempo, instrumentation, emotional quality, how it changes).

CRITICAL INSTRUCTIONS:
- Be EXTREMELY precise — respect the provided cut timestamps exactly.
- Include ALL dialogue and narration verbatim.
- Describe visuals in enough detail to recreate with AI image generation.
- Characters must be referenced ONLY by their stable IDs.

## KEYFRAME GROUND TRUTH
Each scene's midpoint keyframe is attached and labeled ("Keyframe of Scene N"). A scene's subject, environment, and action MUST be consistent with ITS OWN keyframe — it shows what is literally in that shot. If a keyframe shows only a product close-up with no person, that scene contains NO person and its subject/action must describe the product shot. Ultra-short scenes (under ~1.5s) are quick insert shots — describe exactly what the insert shows, never the surrounding scenes' action. Attribute dialog strictly by timestamp: if no words are spoken inside a scene's time range, its "dialog" is an empty string.

Output valid JSON only, matching:
{
  "summary": "...",
  "characters": [{ "id": "MAIN CHARACTER", "description": "..." }],
  "products": ["..."],
  "visual_style": "...",
  "music_brief": "...",
  "scenes": [
    {
      "n": 1,
      "subject": "...", "environment": "...", "lighting": "...", "camera": "...",
      "action_arc": { "start_state": "...", "action": "...", "end_state": "...", "invariants": ["..."] },
      "dialog": "...", "on_screen_text": "...", "purpose": "...", "swap_targets": ["..."]
    }
  ]
}
Every scene in the provided list MUST appear exactly once in "scenes", with the same "n".`;

interface CloneSceneRange {
  n: number;
  start: number;
  end: number;
}

export interface AnalyzeCloneScenesInput {
  /** Inline video (base64 mp4) — the default path. */
  videoBase64?: string;
  /** YouTube source: Gemini ingests the URL natively (same path the Video Analyzer uses). */
  youtubeUrl?: string;
  sceneRanges: CloneSceneRange[];
  /**
   * Small labeled midpoint keyframes — ground truth per scene for the
   * single-pass fallback path.
   */
  sceneKeyframes?: Array<{ n: number; jpegBase64: string }>;
  /**
   * Per-scene clips (physically cut at the detected boundaries). When
   * present, each scene is analyzed from ITS OWN clip in its own request —
   * exact attribution by construction. Gemini's timeline attribution drifts
   * ±1-2s, which is wider than a fast-cut ad's shots, so the timestamped
   * single-pass path mis-assigns action/dialog on short scenes.
   */
  sceneClips?: Array<{ n: number; clipBase64: string }>;
}

export interface AnalyzeCloneScenesResult {
  success: boolean;
  summary?: {
    summary: string;
    characters: Array<{ id: string; description: string }>;
    products: string[];
    visual_style: string;
    music_brief: string;
  };
  /** Keyed by scene number `n`. */
  scenes?: Record<number, {
    action_arc: { start_state: string; action: string; end_state: string; invariants: string[] };
    subject: string;
    environment: string;
    lighting: string;
    dialog: string;
    camera: string;
    on_screen_text: string;
    purpose: string;
    swap_targets: string[];
  }>;
  error?: string;
}

function formatCloneTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

function coerceCloneSceneAnalysis(raw: Record<string, unknown>) {
  const arc = (raw.action_arc || {}) as Record<string, unknown>;
  return {
    action_arc: {
      start_state: String(arc.start_state || ''),
      action: String(arc.action || ''),
      end_state: String(arc.end_state || ''),
      invariants: Array.isArray(arc.invariants) ? arc.invariants.map(String) : [],
    },
    subject: String(raw.subject || ''),
    environment: String(raw.environment || ''),
    lighting: String(raw.lighting || ''),
    dialog: String(raw.dialog || ''),
    camera: String(raw.camera || ''),
    on_screen_text: String(raw.on_screen_text || ''),
    purpose: String(raw.purpose || ''),
    swap_targets: Array.isArray(raw.swap_targets) ? raw.swap_targets.map(String) : [],
  };
}

type GeminiVideoPart =
  | { fileData: { mimeType: string; fileUri: string } }
  | { inlineData: { mimeType: string; data: string } };

function parseJsonResponse(text: string): Record<string, unknown> | null {
  try {
    let clean = text.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    return JSON.parse(clean.trim());
  } catch {
    return null;
  }
}

async function runCloneGlobalAnalysis(videoPart: GeminiVideoPart) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent([videoPart, { text: CLONE_GLOBAL_ANALYSIS_PROMPT }]);
  const parsed = parseJsonResponse(result.response.text() || '');
  if (!parsed) return null;
  return {
    summary: String(parsed.summary || ''),
    characters: Array.isArray(parsed.characters)
      ? (parsed.characters as Array<Record<string, unknown>>).map((c) => ({
          id: String(c.id || ''),
          description: String(c.description || ''),
        }))
      : [],
    products: Array.isArray(parsed.products) ? (parsed.products as unknown[]).map(String) : [],
    visual_style: String(parsed.visual_style || ''),
    music_brief: String(parsed.music_brief || ''),
  };
}

async function runCloneSceneClipAnalysis(opts: {
  clipBase64: string;
  n: number;
  durationSeconds: number;
  contextText: string;
}) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent([
    { inlineData: { mimeType: 'video/mp4', data: opts.clipBase64 } },
    {
      text: `${CLONE_SCENE_CLIP_PROMPT}\n\n## GLOBAL CONTEXT\n${opts.contextText}\n\n## THIS CLIP\nScene ${opts.n}, duration ${opts.durationSeconds.toFixed(1)}s. Remember: this clip is the whole scene.`,
    },
  ]);
  const parsed = parseJsonResponse(result.response.text() || '');
  return parsed ? coerceCloneSceneAnalysis(parsed) : null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Structured per-scene analysis for Clone Studio, aligned to ffmpeg-detected
 * cut timestamps. Lives here so all video analysis shares one Gemini client
 * and one finetuned prompt lineage.
 */
export async function analyzeCloneScenes(
  input: AnalyzeCloneScenesInput
): Promise<AnalyzeCloneScenesResult> {
  try {
    if (!input.videoBase64 && !input.youtubeUrl) {
      return { success: false, error: 'Provide videoBase64 or youtubeUrl' };
    }

    const videoPart: GeminiVideoPart = input.youtubeUrl
      ? { fileData: { mimeType: 'video/mp4', fileUri: input.youtubeUrl } }
      : { inlineData: { mimeType: 'video/mp4', data: input.videoBase64! } };

    // Preferred path: per-scene clips — exact attribution by construction.
    if (input.sceneClips && input.sceneClips.length > 0) {
      const summary = await runCloneGlobalAnalysis(videoPart);
      if (!summary) {
        return { success: false, error: 'Global analysis returned invalid JSON' };
      }
      const contextText =
        `Ad summary: ${summary.summary}\n` +
        `Characters:\n${summary.characters.map((c) => `- ${c.id}: ${c.description}`).join('\n') || '(none)'}\n` +
        `Products: ${summary.products.join(', ') || '(none)'}`;

      const clipByScene = new Map(input.sceneClips.map((c) => [c.n, c.clipBase64]));
      const analyses = await mapWithConcurrency(input.sceneRanges, 5, async (range) => {
        const clipBase64 = clipByScene.get(range.n);
        if (!clipBase64) return null;
        const opts = {
          clipBase64,
          n: range.n,
          durationSeconds: range.end - range.start,
          contextText,
        };
        try {
          return (await runCloneSceneClipAnalysis(opts)) ?? (await runCloneSceneClipAnalysis(opts));
        } catch (error) {
          console.warn(`Clone scene analysis: clip ${range.n} failed, retrying once:`, error);
          try {
            return await runCloneSceneClipAnalysis(opts);
          } catch {
            return null;
          }
        }
      });

      const scenes: AnalyzeCloneScenesResult['scenes'] = {};
      input.sceneRanges.forEach((range, i) => {
        if (analyses[i]) {
          scenes[range.n] = analyses[i]!;
        } else {
          console.warn(`Clone scene analysis: no result for scene ${range.n}, inserting empty analysis`);
          scenes[range.n] = coerceCloneSceneAnalysis({});
        }
      });
      return { success: true, summary, scenes };
    }

    // Fallback: timestamped single pass over the full video (+ keyframe anchors)
    const sceneList = input.sceneRanges
      .map((s) => `Scene ${s.n}: ${formatCloneTimestamp(s.start)} – ${formatCloneTimestamp(s.end)} (${(s.end - s.start).toFixed(1)}s)`)
      .join('\n');

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const keyframeParts = (input.sceneKeyframes || []).flatMap((k) => [
      { text: `Keyframe of Scene ${k.n} (midpoint frame):` },
      { inlineData: { mimeType: 'image/jpeg', data: k.jpegBase64 } },
    ]);

    const result = await model.generateContent([
      videoPart,
      ...keyframeParts,
      { text: `${CLONE_SCENE_ANALYSIS_PROMPT}\n\n## DETECTED SCENES (analyze each)\n${sceneList}` },
    ]);

    const responseText = result.response.text();
    if (!responseText) {
      return { success: false, error: 'Scene analysis returned an empty response' };
    }

    let parsed: Record<string, unknown>;
    try {
      let clean = responseText.trim();
      if (clean.startsWith('```json')) clean = clean.slice(7);
      if (clean.startsWith('```')) clean = clean.slice(3);
      if (clean.endsWith('```')) clean = clean.slice(0, -3);
      parsed = JSON.parse(clean.trim());
    } catch {
      console.error('Clone scene analysis: unparseable response:', responseText.slice(0, 500));
      return { success: false, error: 'Scene analysis returned invalid JSON' };
    }

    const summary = {
      summary: String(parsed.summary || ''),
      characters: Array.isArray(parsed.characters)
        ? (parsed.characters as Array<Record<string, unknown>>).map((c) => ({
            id: String(c.id || ''),
            description: String(c.description || ''),
          }))
        : [],
      products: Array.isArray(parsed.products) ? (parsed.products as unknown[]).map(String) : [],
      visual_style: String(parsed.visual_style || ''),
      music_brief: String(parsed.music_brief || ''),
    };

    const scenes: AnalyzeCloneScenesResult['scenes'] = {};
    if (Array.isArray(parsed.scenes)) {
      for (const raw of parsed.scenes as Array<Record<string, unknown>>) {
        const n = Number(raw.n);
        if (Number.isInteger(n) && n > 0) {
          scenes[n] = coerceCloneSceneAnalysis(raw);
        }
      }
    }
    // Guarantee every detected scene has an analysis object even if the model
    // skipped one — the board can still render and the user can fill it in.
    for (const range of input.sceneRanges) {
      if (!scenes[range.n]) {
        console.warn(`Clone scene analysis: model skipped scene ${range.n}, inserting empty analysis`);
        scenes[range.n] = coerceCloneSceneAnalysis({});
      }
    }

    return { success: true, summary, scenes };
  } catch (error) {
    console.error('Clone scene analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Scene analysis failed',
    };
  }
}
