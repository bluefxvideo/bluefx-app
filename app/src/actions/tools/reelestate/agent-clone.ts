'use server';

import { createClient } from '@/app/supabase/server';
import { generateWithFalNanaBanana2 } from '@/actions/models/fal-nano-banana-2';
import { createVideoGenerationPrediction, getVideoGenerationPrediction } from '@/actions/models/video-generation-v1';
import { deductCredits } from '@/actions/database/cinematographer-database';
import { getUserCredits } from '@/actions/credit-management';
import { downloadAndUploadImage, downloadAndUploadVideo } from '@/actions/supabase-storage';
import { storeAgentCloneGeneration, updateAgentCloneGeneration } from '@/actions/database/agent-clone-database';
import type { Json } from '@/types/supabase';
import type { AgentCloneCameraMotion, AgentCloneDuration } from '@/types/reelestate';

const CREDITS = {
  COMPOSITE: 2,
  ANIMATION_PER_SECOND: 1,
};

// ─── Helpers ────────────────────────────────

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

async function fetchImageAsBase64(url: string): Promise<string> {
  // If already base64, return as-is
  if (url.startsWith('data:')) return url;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${contentType};base64,${base64}`;
}

// ─── Generate Composite (NB2) ───────────────

export async function generateAgentComposite(
  agentPhotoUrl: string,
  backgroundUrl: string,
  prompt: string,
  aspectRatio: '16:9' | '9:16',
): Promise<{ success: boolean; compositeUrl?: string; generationId?: string; error?: string }> {
  try {
    const user = await getAuthenticatedUser();

    // Check credits
    const creditResult = await getUserCredits(user.id);
    if (!creditResult.success || (creditResult.credits || 0) < CREDITS.COMPOSITE) {
      return { success: false, error: `Not enough credits (need ${CREDITS.COMPOSITE})` };
    }

    console.log('🧑‍💼 Agent Clone: generating composite...');

    // Proxy both images to base64 (Zillow blocks direct access)
    const [agentBase64, bgBase64] = await Promise.all([
      fetchImageAsBase64(agentPhotoUrl),
      fetchImageAsBase64(backgroundUrl),
    ]);

    const result = await generateWithFalNanaBanana2({
      prompt,
      image_input: [agentBase64, bgBase64],
      aspect_ratio: aspectRatio,
      resolution: '2K',
      output_format: 'jpeg',
    });

    if (!result.success || !result.imageUrl) {
      return { success: false, error: result.error || 'Composite generation failed' };
    }

    // Persist to Supabase Storage
    const stored = await downloadAndUploadImage(result.imageUrl, 'agent-clone', user.id, {
      bucket: 'images',
      folder: `agent-clone/${user.id}`,
      contentType: 'image/jpeg',
    });
    const compositeUrl = stored.success && stored.url ? stored.url : result.imageUrl;

    // Deduct credits
    await deductCredits(user.id, CREDITS.COMPOSITE, 'agent-clone-composite', {
      aspect_ratio: aspectRatio,
    } as unknown as Json);

    // Persist to database for history
    const dbResult = await storeAgentCloneGeneration({
      user_id: user.id,
      agent_photo_url: agentPhotoUrl,
      background_url: backgroundUrl,
      composite_url: compositeUrl,
      prompt,
      aspect_ratio: aspectRatio,
      credits_used: CREDITS.COMPOSITE,
    });

    console.log('✅ Agent Clone: composite generated');
    return { success: true, compositeUrl, generationId: dbResult.id };
  } catch (error) {
    console.error('❌ Agent Clone composite error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Composite generation failed',
    };
  }
}

// ─── Start Animation (LTX) ──────────────────

export async function startAgentAnimation(
  compositeUrl: string,
  prompt: string,
  dialogue: string,
  action: string,
  cameraMotion: AgentCloneCameraMotion,
  duration: AgentCloneDuration,
  aspectRatio: '16:9' | '9:16',
  generationId?: string,
): Promise<{ success: boolean; predictionId?: string; error?: string }> {
  try {
    const user = await getAuthenticatedUser();

    const creditCost = duration * CREDITS.ANIMATION_PER_SECOND;
    const creditResult = await getUserCredits(user.id);
    if (!creditResult.success || (creditResult.credits || 0) < creditCost) {
      return { success: false, error: `Not enough credits (need ${creditCost})` };
    }

    // Build LTX prompt
    let ltxPrompt = prompt;

    // Add action description
    if (action.trim()) {
      ltxPrompt += `. The person is ${action.trim()}`;
    }

    // Add dialogue
    if (dialogue.trim()) {
      ltxPrompt += `. The person is speaking to the camera, saying: "${dialogue.trim()}"`;
    }

    // Default movement if neither action nor dialogue specified
    if (!action.trim() && !dialogue.trim()) {
      ltxPrompt += '. The person has subtle natural movement, looking at the camera.';
    }

    ltxPrompt += ' Photorealistic, professional real estate video, natural lighting.';

    console.log('🎬 Agent Clone: starting animation...');

    const prediction = await createVideoGenerationPrediction({
      prompt: ltxPrompt,
      image: compositeUrl,
      duration,
      resolution: '1080p',
      aspect_ratio: aspectRatio,
      camera_motion: cameraMotion,
      generate_audio: true,
    });

    // Deduct credits
    await deductCredits(user.id, creditCost, 'agent-clone-animate', {
      duration,
      camera_motion: cameraMotion,
      prediction_id: prediction.id,
    } as unknown as Json);

    // Update database record with animation params
    if (generationId) {
      await updateAgentCloneGeneration(generationId, {
        status: 'animating',
        prediction_id: prediction.id,
        dialogue,
        action,
        camera_motion: cameraMotion,
        duration,
        credits_used: CREDITS.COMPOSITE + creditCost,
      });
    }

    console.log('✅ Agent Clone: animation started, prediction:', prediction.id);
    return { success: true, predictionId: prediction.id };
  } catch (error) {
    console.error('❌ Agent Clone animation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Animation failed to start',
    };
  }
}

// ─── Poll Animation Status ──────────────────

export async function pollAgentAnimation(
  predictionId: string,
  generationId?: string,
): Promise<{ status: string; videoUrl?: string; error?: string }> {
  try {
    const prediction = await getVideoGenerationPrediction(predictionId);

    if (prediction.status === 'succeeded') {
      let videoUrl = typeof prediction.output === 'string'
        ? prediction.output
        : Array.isArray(prediction.output)
          ? prediction.output[0]
          : undefined;

      // Persist video to Supabase Storage
      if (videoUrl) {
        const user = await getAuthenticatedUser();
        const stored = await downloadAndUploadVideo(videoUrl, 'agent-clone', user.id, {
          folder: `agent-clone/${user.id}`,
        });
        if (stored.success && stored.url) videoUrl = stored.url;
      }

      // Update database record with video URL
      if (generationId) {
        await updateAgentCloneGeneration(generationId, {
          status: 'ready',
          video_url: videoUrl,
        });
      }

      return { status: 'succeeded', videoUrl };
    }

    if (prediction.status === 'failed') {
      if (generationId) {
        await updateAgentCloneGeneration(generationId, {
          status: 'failed',
          error_message: prediction.error || 'Animation failed',
        });
      }
      return { status: 'failed', error: prediction.error || 'Animation failed' };
    }

    if (prediction.status === 'canceled') {
      return { status: 'failed', error: 'Animation was canceled' };
    }

    return { status: prediction.status };
  } catch (error) {
    console.error('❌ Agent Clone poll error:', error);
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Failed to check animation status',
    };
  }
}
