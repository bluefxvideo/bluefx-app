import { NextRequest, NextResponse } from 'next/server';
import { generateScriptFromIdeaAPI } from '@/services/script-generation-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.idea || !body.user_id) {
      return NextResponse.json(
        { 
          success: false, 
          script: '',
          credits_used: 0,
          error: 'Missing required fields: idea and user_id' 
        },
        { status: 400 }
      );
    }
    
    const result = await generateScriptFromIdeaAPI({
      idea: body.idea,
      user_id: body.user_id,
      style: body.style
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Script generation API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        script: '',
        credits_used: 0,
        error: error instanceof Error ? error.message : 'Script generation failed' 
      },
      { status: 500 }
    );
  }
}