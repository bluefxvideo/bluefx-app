import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple image regeneration API that runs in the editor
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image_prompt, style_settings = {} } = body;

    // Check for Replicate token
    const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
    if (!REPLICATE_TOKEN) {
      return NextResponse.json(
        { error: 'Image generation not configured' },
        { status: 503 }
      );
    }

    // Generate with Replicate
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'aa776ca45ce7f7d185418f700df8ec6ca6cb367bfd88e9cd225666c4c179d1d7',
        input: {
          prompt: image_prompt,
          aspect_ratio: style_settings.aspect_ratio || '16:9',
          output_format: 'png',
          safety_tolerance: 2,
        }
      }),
    });

    const prediction = await response.json();

    // Poll for result
    let result = prediction;
    let attempts = 0;

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));

      const statusRes = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: { 'Authorization': `Token ${REPLICATE_TOKEN}` },
        }
      );

      result = await statusRes.json();
      attempts++;
    }

    if (result.status === 'succeeded' && result.output) {
      const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;

      return NextResponse.json({
        success: true,
        image_url: imageUrl
      });
    }

    throw new Error('Generation failed');

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}