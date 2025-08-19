import { NextRequest, NextResponse } from 'next/server';
import { regenerateSegmentImage } from '@/actions/services/image-generation-service';

/**
 * API endpoint for regenerating images from the React Video Editor
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { segment_id, image_prompt, style_settings, user_id } = body;

    console.log('🎨 Image regeneration request:', {
      segment_id,
      prompt: image_prompt?.substring(0, 50) + '...',
      style: style_settings,
      user_id
    });

    // Validate required fields
    if (!segment_id || !image_prompt) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Call the image regeneration service
    const result = await regenerateSegmentImage(
      segment_id,
      image_prompt,
      {
        visual_style: style_settings?.visual_style || 'realistic',
        quality: style_settings?.quality || 'standard',
        aspect_ratio: style_settings?.aspect_ratio || '16:9'
      },
      user_id || 'temp-user'
    );

    if (result.success && result.image_url) {
      console.log('✅ Image regenerated successfully');
      
      // Calculate credits based on quality
      const creditCosts = { draft: 3, standard: 4, premium: 6 };
      const credits_used = creditCosts[style_settings?.quality as keyof typeof creditCosts] || 4;

      return NextResponse.json({
        success: true,
        image_url: result.image_url,
        credits_used
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Image regeneration failed' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Image regeneration API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}