import { NextRequest, NextResponse } from 'next/server';
import { supabase, checkUserCredits, deductCredits } from '@/lib/supabase';

/**
 * Secure image regeneration with authentication and credit checking
 */

async function generateImageWithReplicate(prompt: string, aspectRatio: string = '16:9') {
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

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
    throw new Error('Replicate API error');
  }

  const prediction = await response.json();

  // Poll for completion
  let result = prediction;
  const maxAttempts = 60;
  let attempts = 0;

  while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const statusResponse = await fetch(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        },
      }
    );

    result = await statusResponse.json();
    attempts++;
  }

  if (result.status !== 'succeeded' || !result.output) {
    throw new Error('Image generation failed');
  }

  return Array.isArray(result.output) ? result.output[0] : result.output;
}

export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify authentication using Authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    // Step 2: Check user credits
    const credits = await checkUserCredits(user.id);
    const REQUIRED_CREDITS = 4;

    if (credits < REQUIRED_CREDITS) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: REQUIRED_CREDITS, available: credits },
        { status: 402 } // Payment Required
      );
    }

    // Step 3: Parse request body
    const body = await request.json();
    const { image_prompt, style_settings = {}, track_item_id, video_id } = body;

    if (!image_prompt?.trim()) {
      return NextResponse.json(
        { error: 'Image prompt is required' },
        { status: 400 }
      );
    }

    console.log('🎨 Generating image for user:', user.email);

    // Step 4: Generate the image
    const imageUrl = await generateImageWithReplicate(
      image_prompt,
      style_settings.aspect_ratio || '16:9'
    );

    // Step 5: Deduct credits
    await deductCredits(user.id, REQUIRED_CREDITS, 'image_regeneration');

    // Step 6: Log to database (optional)
    await supabase
      .from('image_generations')
      .insert({
        user_id: user.id,
        video_id: video_id,
        prompt: image_prompt,
        image_url: imageUrl,
        credits_used: REQUIRED_CREDITS,
        metadata: { track_item_id, style_settings }
      });

    console.log('✅ Image generated and credits deducted');

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      track_item_id,
      credits_deducted: REQUIRED_CREDITS,
      remaining_credits: credits - REQUIRED_CREDITS
    });

  } catch (error) {
    console.error('Secure generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed'
      },
      { status: 500 }
    );
  }
}