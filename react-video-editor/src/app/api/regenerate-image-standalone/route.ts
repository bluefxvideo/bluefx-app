import { NextRequest, NextResponse } from 'next/server';

/**
 * Standalone image regeneration API for React Video Editor
 * This version works independently without needing the main app
 */

// Simple FLUX API client (no database needed)
async function generateImageWithReplicate(prompt: string, aspectRatio: string = '16:9') {
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured in editor environment');
  }

  // Call Replicate API directly
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${REPLICATE_API_TOKEN}`,
    },
    body: JSON.stringify({
      version: 'aa776ca45ce7f7d185418f700df8ec6ca6cb367bfd88e9cd225666c4c179d1d7',
      input: {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        output_format: 'png',
        safety_tolerance: 2,
        prompt_upsampling: false,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  const prediction = await response.json();

  // Wait for completion (polling)
  let result = prediction;
  const maxAttempts = 60; // 2 minutes max
  let attempts = 0;

  while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
      },
    });

    result = await statusResponse.json();
    attempts++;
  }

  if (result.status !== 'succeeded' || !result.output) {
    throw new Error(`Image generation failed: ${result.error || 'No output'}`);
  }

  return Array.isArray(result.output) ? result.output[0] : result.output;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      image_prompt,
      style_settings = {},
      track_item_id,
      user_id,
      video_id
    } = body;

    if (!image_prompt?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Image prompt is required' },
        { status: 400 }
      );
    }

    console.log('🎨 Standalone image generation:', {
      prompt: image_prompt.substring(0, 50) + '...',
      user_id,
      video_id
    });

    // Generate the image directly
    const imageUrl = await generateImageWithReplicate(
      image_prompt,
      style_settings.aspect_ratio || '16:9'
    );

    console.log('✅ Image generated successfully:', imageUrl);

    // Optionally report back to main app for credit tracking (fire and forget)
    if (user_id && process.env.NEXT_PUBLIC_MAIN_APP_URL) {
      fetch(`${process.env.NEXT_PUBLIC_MAIN_APP_URL}/api/track-generation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id,
          video_id,
          action: 'image_regeneration',
          credits: 4
        })
      }).catch(err => console.error('Failed to track credits:', err));
    }

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      track_item_id,
      standalone: true // Indicate this was generated without main app
    });

  } catch (error) {
    console.error('Standalone generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
        standalone: true
      },
      { status: 500 }
    );
  }
}

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