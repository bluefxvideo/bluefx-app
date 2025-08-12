import { NextRequest, NextResponse } from 'next/server';
import { generateScriptFromIdea } from '@/actions/services/script-generation-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const result = await generateScriptFromIdea({
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