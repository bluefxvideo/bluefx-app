import { NextRequest, NextResponse } from 'next/server';
import { generateWithSeedreamEdit } from '@/actions/models/fal-seedream-edit';
import { createAdminClient } from '@/app/supabase/server';

/**
 * Editor Edit Image API
 *
 * Modifies / cleans up an image using Seedream v5 Lite via fal.ai.
 * Synchronous (~5-10s) - returns edited image URL directly.
 *
 * Note: Image URLs are proxied through our server and converted to base64
 * data URIs because fal.ai cannot access many image hosts (Zillow, etc.)
 * that block non-browser requests.
 */

/**
 * Download an image and convert it to a base64 data URI.
 * This allows fal.ai to receive the image data directly instead of
 * trying to fetch from potentially restricted URLs.
 */
async function imageUrlToDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${contentType};base64,${base64}`;
}

const ALLOWED_ORIGINS = [
  'https://editor.bluefx.net',
  'http://localhost:3002',
  'http://localhost:3001',
  'http://localhost:3000',
];

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return process.env.NEXT_PUBLIC_VIDEO_EDITOR_URL || 'https://editor.bluefx.net';
}

function corsHeaders(request: NextRequest) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// ─── POST: Edit image with AI ──────────────────────────────────────────

const EDIT_IMAGE_CREDIT_COST = 2;

export async function POST(request: NextRequest) {
  try {
    const { image_url, prompt, reference_images, user_id } = await request.json();

    if (!image_url || !prompt) {
      return NextResponse.json(
        { success: false, error: 'image_url and prompt are required' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Deduct credits if user_id is provided (use admin client — editor has no auth cookies)
    if (user_id) {
      const supabase = createAdminClient();

      const { data: creditData } = await supabase
        .from('user_credits')
        .select('available_credits')
        .eq('user_id', user_id)
        .single();

      const available = creditData?.available_credits || 0;
      if (available < EDIT_IMAGE_CREDIT_COST) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient credits. Need ${EDIT_IMAGE_CREDIT_COST}, have ${available}`,
            remaining_credits: available,
          },
          { status: 402, headers: corsHeaders(request) },
        );
      }

      const { data: deduction, error: deductError } = await supabase
        .rpc('deduct_user_credits', {
          p_user_id: user_id,
          p_amount: EDIT_IMAGE_CREDIT_COST,
          p_operation: 'editor-edit-image',
          p_metadata: { prompt: prompt.substring(0, 100) },
        });

      if (deductError || !deduction?.success) {
        return NextResponse.json(
          { success: false, error: deductError?.message || 'Credit deduction failed' },
          { status: 402, headers: corsHeaders(request) },
        );
      }

      console.log(`💳 Edit-image: deducted ${EDIT_IMAGE_CREDIT_COST} credits (remaining: ${deduction.remaining_credits})`);
    }

    console.log('🎨 Edit-image request:', { prompt: prompt.substring(0, 100) });

    // Proxy all images through our server as base64 data URIs
    // because fal.ai can't access many image hosts (Zillow, etc.)
    const imageUrls: string[] = [image_url, ...(reference_images || [])];
    const proxiedImages: string[] = [];

    for (const url of imageUrls) {
      try {
        console.log('📥 Downloading image for proxy...');
        const dataUri = await imageUrlToDataUri(url);
        console.log(`✅ Image proxied (${Math.round(dataUri.length / 1024)}KB base64)`);
        proxiedImages.push(dataUri);
      } catch (proxyErr) {
        console.error('❌ Failed to proxy image:', proxyErr);
        return NextResponse.json(
          { success: false, error: 'Failed to download image for editing' },
          { status: 400, headers: corsHeaders(request) },
        );
      }
    }

    const result = await generateWithSeedreamEdit({
      prompt,
      image_urls: proxiedImages,
      image_size: 'auto_2K',
    });

    if (!result.success || !result.imageUrl) {
      console.error('❌ Edit-image failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error || 'Image editing failed' },
        { status: 500, headers: corsHeaders(request) },
      );
    }

    console.log('✅ Edit-image completed successfully');

    return NextResponse.json(
      {
        success: true,
        image_url: result.imageUrl,
      },
      { headers: corsHeaders(request) },
    );
  } catch (err) {
    console.error('❌ Edit-image POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to edit image' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

// ─── OPTIONS (CORS preflight) ──────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders(request) });
}
