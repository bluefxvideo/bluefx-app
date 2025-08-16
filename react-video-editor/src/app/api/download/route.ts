import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy endpoint for downloading videos
 * This solves CORS issues by making the server fetch the video
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');
    const filename = request.nextUrl.searchParams.get('filename') || 'video.mp4';
    
    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }
    
    console.log(`📥 Proxying download for: ${url}`);
    
    // Fetch the video from Remotion server
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }
    
    // Get the video as array buffer
    const videoBuffer = await response.arrayBuffer();
    
    // Return the video with proper download headers
    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': videoBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
      },
    });
    
  } catch (error) {
    console.error('Download proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    );
  }
}