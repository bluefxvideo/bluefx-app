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
    console.log(`📄 Filename: ${filename}`);
    
    // Fetch the video from Remotion server
    const response = await fetch(url, {
      headers: {
        'Accept': 'video/mp4,video/*,*/*',
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch video: ${response.status}`);
    }
    
    // Get the content type
    const contentType = response.headers.get('content-type') || 'video/mp4';
    const contentLength = response.headers.get('content-length');
    
    console.log(`📦 Video fetched: ${contentType}, size: ${contentLength}`);
    
    // Stream the response body directly
    const stream = response.body;
    
    if (!stream) {
      throw new Error('No response body');
    }
    
    // Create response headers
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    
    // Add content length if available
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }
    
    // Return the streamed response
    return new NextResponse(stream, {
      status: 200,
      headers,
    });
    
  } catch (error) {
    console.error('Download proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    );
  }
}