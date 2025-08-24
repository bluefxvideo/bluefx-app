/**
 * Hedra API Integration for Talking Avatar Video Generation
 * 
 * This module handles video generation using Hedra's API:
 * 1. Uploads avatar image and voice audio
 * 2. Creates video generation request
 * 3. Polls for completion status
 * 4. Returns generated video URL
 */

interface HedraAsset {
  id: string;
  name: string;
  type: 'image' | 'audio';
  status: string;
}

interface HedraModel {
  id: string;
  name: string;
  type: string;
}

interface HedraGeneration {
  id: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  url?: string; // Hedra API returns video URL in 'url' field, not 'generated_video_url'
  generated_video_url?: string; // Keep for backward compatibility
  error_message?: string;
}

interface HedraVideoRequest {
  avatarImageUrl: string;
  voiceAudioUrl: string;
  textPrompt: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  resolution?: '540p' | '720p';
  duration?: number;
  seed?: number;
}

interface HedraVideoResponse {
  success: boolean;
  generationId?: string;
  videoUrl?: string;
  error?: string;
  status?: string;
}

export class HedraAPI {
  private apiKey: string;
  private baseUrl = 'https://api.hedra.com/web-app/public';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get available AI models
   */
  private async getModels(): Promise<HedraModel[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create an asset (image or audio)
   */
  private async createAsset(name: string, type: 'image' | 'audio'): Promise<HedraAsset> {
    const response = await fetch(`${this.baseUrl}/assets`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        type,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create asset: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Upload file to asset
   */
  private async uploadAsset(assetId: string, fileUrl: string): Promise<void> {
    // Download file from URL
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }

    const fileBlob = await fileResponse.blob();
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fileBlob);

    // Upload to Hedra
    const response = await fetch(`${this.baseUrl}/assets/${assetId}/upload`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload asset: ${response.statusText}`);
    }
  }

  /**
   * Create video generation request
   */
  private async createGeneration(
    modelId: string,
    imageAssetId: string,
    audioAssetId: string,
    textPrompt: string,
    aspectRatio: string = '16:9',
    resolution: string = '720p',
    duration?: number,
    seed?: number
  ): Promise<string> {
    const requestBody: Record<string, unknown> = {
      type: 'video',
      ai_model_id: modelId,
      start_keyframe_id: imageAssetId,
      audio_id: audioAssetId,
      generated_video_inputs: {
        text_prompt: textPrompt,
        resolution,
        aspect_ratio: aspectRatio,
      },
    };

    // DO NOT add duration_ms - Let Hedra calculate it from the uploaded audio file
    // This matches our successful curl test where we uploaded the audio and Hedra figured out duration
    console.log('Not adding duration_ms - Hedra will calculate from uploaded audio file');

    if (seed) {
      (requestBody.generated_video_inputs as { seed?: number }).seed = seed;
    }

    // Debug: Log the exact request body being sent to Hedra
    console.log('📋 Full Hedra request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${this.baseUrl}/generations`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorDetails = response.statusText;
      try {
        const errorData = await response.json();
        console.error('Hedra API error details:', errorData);
        errorDetails = errorData.error || errorData.message || response.statusText;
      } catch (e) {
        console.error('Could not parse error response:', e);
      }
      throw new Error(`Failed to create generation: ${errorDetails}`);
    }

    const result = await response.json();
    return result.id;
  }

  /**
   * Check generation status
   */
  private async getGenerationStatus(generationId: string): Promise<HedraGeneration> {
    const response = await fetch(`${this.baseUrl}/generations/${generationId}/status`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get generation status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Poll for generation completion
   */
  private async pollForCompletion(generationId: string, maxWaitTime = 300000): Promise<HedraGeneration> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getGenerationStatus(generationId);
      
      if (status.status === 'complete') {
        return status;
      } else if (status.status === 'error') {
        throw new Error(`Generation failed: ${status.error_message}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Generation timed out');
  }

  /**
   * Generate talking avatar video
   */
  async generateVideo(request: HedraVideoRequest): Promise<HedraVideoResponse> {
    try {
      console.log('🎬 Starting Hedra video generation...');

      // Step 1: Get available models
      const models = await this.getModels();
      // Use the EXACT model ID that worked in our curl test
      const WORKING_MODEL_ID = 'd1dd37a3-e39a-4854-a298-6510289f9cf2';
      let videoModel = models.find(m => m.id === WORKING_MODEL_ID);
      
      if (!videoModel) {
        console.log('⚠️ Exact model not found, trying Character-3 by name');
        videoModel = models.find(m => m.name === 'Character-3') || models.find(m => m.type === 'video') || models[0];
      }
      
      if (!videoModel) {
        throw new Error('No video models available');
      }

      console.log(`📋 Using model: ${videoModel.name} (${videoModel.id})`);

      // Step 2: Create image asset with unique name
      const timestamp = Date.now();
      const imageAssetName = `avatar_image_${timestamp}.jpg`;
      const imageAsset = await this.createAsset(imageAssetName, 'image');
      console.log('🖼️ Uploading avatar image:', imageAssetName, 'from URL:', request.avatarImageUrl);
      await this.uploadAsset(imageAsset.id, request.avatarImageUrl);
      console.log('🖼️ Avatar image uploaded successfully:', imageAssetName);

      // Step 3: Create audio asset with unique name
      const audioAssetName = `voice_audio_${timestamp}.mp3`;
      const audioAsset = await this.createAsset(audioAssetName, 'audio');
      
      // Debug: Check if audio URL is accessible
      console.log('🔍 Checking audio URL accessibility:', request.voiceAudioUrl);
      try {
        const audioCheckResponse = await fetch(request.voiceAudioUrl, { method: 'HEAD' });
        console.log('🔍 Audio URL check:', audioCheckResponse.status, audioCheckResponse.headers.get('content-length'), 'bytes');
      } catch (e) {
        console.error('❌ Audio URL not accessible:', e);
      }
      
      console.log('🎵 Uploading voice audio:', audioAssetName, 'from URL:', request.voiceAudioUrl);
      await this.uploadAsset(audioAsset.id, request.voiceAudioUrl);
      console.log('🎵 Voice audio uploaded successfully:', audioAssetName);
      
      // Add a longer delay to ensure Hedra fully processes the audio file and calculates duration
      // This is critical - without this, Hedra might not have duration_ms ready
      console.log('⏳ Waiting 5 seconds for Hedra to fully process audio asset and calculate duration...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Step 4: Create generation request
      console.log('🎬 Creating generation with assets:', {
        imageAssetId: imageAsset.id,
        audioAssetId: audioAsset.id,
        textPrompt: request.textPrompt,
        aspectRatio: request.aspectRatio || '16:9',
        resolution: request.resolution || '720p'
      });
      
      const generationId = await this.createGeneration(
        videoModel.id,
        imageAsset.id,
        audioAsset.id,
        request.textPrompt,
        request.aspectRatio || '16:9',
        request.resolution || '720p',
        request.duration,
        request.seed
      );

      console.log(`🚀 Generation started: ${generationId}`);

      return {
        success: true,
        generationId,
        status: 'processing',
      };

    } catch (error) {
      console.error('❌ Hedra generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check video generation status
   */
  async checkGenerationStatus(generationId: string): Promise<HedraVideoResponse> {
    try {
      const status = await this.getGenerationStatus(generationId);

      if (status.status === 'complete') {
        return {
          success: true,
          generationId,
          videoUrl: status.url || status.generated_video_url, // Try both fields
          status: 'complete',
        };
      } else if (status.status === 'error') {
        return {
          success: false,
          generationId,
          error: status.error_message,
          status: 'error',
        };
      } else {
        return {
          success: true,
          generationId,
          status: status.status,
        };
      }
    } catch (error) {
      return {
        success: false,
        generationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      };
    }
  }

  /**
   * Generate video and wait for completion
   */
  async generateVideoAndWait(request: HedraVideoRequest): Promise<HedraVideoResponse> {
    try {
      // Start generation
      const startResult = await this.generateVideo(request);
      if (!startResult.success || !startResult.generationId) {
        return startResult;
      }

      console.log('⏳ Waiting for video generation to complete...');

      // Poll for completion
      const finalStatus = await this.pollForCompletion(startResult.generationId);

      return {
        success: true,
        generationId: startResult.generationId,
        videoUrl: finalStatus.generated_video_url,
        status: 'complete',
      };

    } catch (error) {
      console.error('❌ Hedra generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Create Hedra API instance
 */
export function createHedraAPI(): HedraAPI {
  const apiKey = process.env.HEDRA_API_KEY;
  if (!apiKey) {
    throw new Error('HEDRA_API_KEY environment variable is required');
  }
  return new HedraAPI(apiKey);
}

/**
 * Generate talking avatar video using Hedra API
 */
export async function generateTalkingAvatarVideo(
  avatarImageUrl: string,
  voiceAudioUrl: string,
  textPrompt: string = "A person talking at the camera",
  options: {
    aspectRatio?: '16:9' | '9:16' | '1:1';
    resolution?: '540p' | '720p';
    duration?: number;
    waitForCompletion?: boolean;
  } = {}
): Promise<HedraVideoResponse> {
  const hedra = createHedraAPI();

  const request: HedraVideoRequest = {
    avatarImageUrl,
    voiceAudioUrl,
    textPrompt,
    aspectRatio: options.aspectRatio || '16:9',
    resolution: options.resolution || '720p',
    duration: options.duration,
  };

  if (options.waitForCompletion) {
    return hedra.generateVideoAndWait(request);
  } else {
    return hedra.generateVideo(request);
  }
}