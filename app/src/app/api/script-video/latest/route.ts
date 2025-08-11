import { NextRequest, NextResponse } from 'next/server';
import { getLatestScriptVideoResults } from '@/actions/database/script-video-database';

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();
    
    if (!user_id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const response = await getLatestScriptVideoResults(user_id);
    return NextResponse.json(response);
  } catch (error) {
    console.error('API error getting latest script video results:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}