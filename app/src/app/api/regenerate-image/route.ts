import { NextRequest, NextResponse } from 'next/server';
import { 
  createFluxKontextPrediction, 
  waitForFluxKontextCompletion 
} from '@/actions/models/flux-kontext-pro';

// CORS headers for cross-origin requests from React Video Editor
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, you might want to restrict this
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Enhance prompt based on visual style
 */
function enhancePromptForStyle(prompt: string, styleSettings: any): string {
  const { visual_style = 'realistic' } = styleSettings;
  
  const styleEnhancements: Record<string, string> = {
    'realistic': 'photorealistic, high quality, professional photography, detailed',
    'artistic': 'artistic illustration, creative style, vibrant colors, expressive',
    'minimal': 'minimalist design, clean composition, simple elements, modern aesthetic',
    'dynamic': 'dynamic composition, dramatic lighting, cinematic, action-oriented'
  };
  
  const enhancement = styleEnhancements[visual_style] || styleEnhancements['realistic'];
  return `${prompt}, ${enhancement}`;
}

/**
 * Convert aspect ratio to FLUX format
 */
function convertAspectRatio(aspectRatio: string): string {
  const ratioMap: Record<string, string> = {
    '16:9': '16:9',
    '9:16': '9:16',
    '1:1': '1:1',
    '4:3': '4:3',
    '4:5': '4:5'
  };
  
  return ratioMap[aspectRatio] || '16:9';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      segment_id, 
      image_prompt, 
      style_settings = {}, 
      track_item_id 
    } = body;

    if (!image_prompt || !image_prompt.trim()) {
      return NextResponse.json(
        { success: false, error: 'Image prompt is required' },
        { status: 400 }
      );
    }

    console.log('🎨 Regenerating image for segment:', segment_id);
    console.log('📝 New prompt:', image_prompt);
    console.log('🎯 Track item ID:', track_item_id);

    // Create enhanced prompt based on style
    const enhancedPrompt = enhancePromptForStyle(image_prompt, style_settings);

    // Create FLUX prediction
    const prediction = await createFluxKontextPrediction({
      prompt: enhancedPrompt,
      aspect_ratio: convertAspectRatio(style_settings.aspect_ratio || '16:9'),
      output_format: 'png',
      safety_tolerance: 2,
      prompt_upsampling: style_settings.quality === 'premium',
      seed: undefined // Random generation for variety
    });

    // Wait for completion
    const completedPrediction = await waitForFluxKontextCompletion(
      prediction.id,
      120000, // 2 minute timeout
      2000    // 2 second polling
    );

    if (completedPrediction.status !== 'succeeded' || !completedPrediction.output) {
      throw new Error(`Image generation failed: ${completedPrediction.error || 'No output'}`);
    }

    const imageUrl = Array.isArray(completedPrediction.output) 
      ? completedPrediction.output[0] 
      : completedPrediction.output;

    console.log('✅ Image regenerated successfully:', imageUrl);
    
    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      segment_id,
      track_item_id,
      prompt: image_prompt,
      enhanced_prompt: enhancedPrompt
    }, {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('❌ Error regenerating image:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to regenerate image' 
      },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { 
    status: 200,
    headers: corsHeaders
  });
}