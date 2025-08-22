import { NextRequest, NextResponse } from 'next/server';
import { getLatestScriptVideoResults } from '@/actions/database/script-video-database';

// Add CORS headers for cross-domain requests from editor.bluefx.net
function setCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', 'https://editor.bluefx.net');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

export async function OPTIONS(request: NextRequest) {
  return setCorsHeaders(new NextResponse(null, { status: 200 }));
}

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();
    
    if (!user_id) {
      const response = NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
      return setCorsHeaders(response);
    }

    const result = await getLatestScriptVideoResults(user_id);
    const response = NextResponse.json(result);
    return setCorsHeaders(response);
  } catch (error) {
    console.error('API error getting latest script video results:', error);
    const response = NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
    return setCorsHeaders(response);
  }
}