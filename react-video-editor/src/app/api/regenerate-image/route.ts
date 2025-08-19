import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint for regenerating AI images in the React Video Editor
 * This connects to the main BlueFX app's image generation service
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { segment_id, image_prompt, style_settings, track_item_id } = body;

    if (!image_prompt?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Image prompt is required' },
        { status: 400 }
      );
    }

    // Get BlueFX API URL from environment or use default
    const bluefxApiUrl = process.env.NEXT_PUBLIC_BLUEFX_API_URL || 'http://localhost:3000';
    
    console.log('🎨 Regenerating image:', {
      segment_id,
      track_item_id,
      prompt: image_prompt.substring(0, 50) + '...',
      style: style_settings
    });

    // Call BlueFX image regeneration service
    const response = await fetch(`${bluefxApiUrl}/api/image/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        segment_id: segment_id || track_item_id,
        image_prompt,
        style_settings: {
          visual_style: style_settings.visual_style || 'realistic',
          quality: style_settings.quality || 'standard',
          aspect_ratio: style_settings.aspect_ratio || '16:9'
        },
        user_id: 'editor-user' // TODO: Get actual user ID from session
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BlueFX API error:', errorText);
      throw new Error(`Image regeneration failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.image_url) {
      console.log('✅ Image regenerated successfully:', result.image_url);
      
      // Return the new image URL to update the editor
      return NextResponse.json({
        success: true,
        image_url: result.image_url,
        track_item_id,
        credits_used: result.credits_used || 4
      });
    } else {
      throw new Error(result.error || 'Image regeneration failed');
    }

  } catch (error) {
    console.error('Image regeneration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to regenerate image' 
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS if needed
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