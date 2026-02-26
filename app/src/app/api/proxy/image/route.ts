import { NextRequest, NextResponse } from 'next/server';

/**
 * Image proxy for TikTok CDN thumbnails.
 *
 * TikTok signed CDN URLs (p*-sign*.tiktokcdn.com) return 403 when fetched
 * directly from a browser because they validate the origin IP/region.
 * This proxy fetches them server-side using the TIKTOK_CC_COOKIES session,
 * which gives us a whitelisted origin. Results are cached for 24 hours.
 *
 * Usage: /api/proxy/image?url=<encoded-cdn-url>
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url param', { status: 400 });
  }

  // Only proxy TikTok CDN URLs (safety guard)
  if (!url.includes('tiktokcdn.com') && !url.includes('tiktok.com')) {
    return new NextResponse('Disallowed host', { status: 403 });
  }

  // Build cookie string from TIKTOK_CC_COOKIES env (JSON array of {name, value})
  let cookieHeader = '';
  try {
    const cookies = JSON.parse(process.env.TIKTOK_CC_COOKIES || '[]') as Array<{ name: string; value: string }>;
    cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  } catch {
    // No cookies — proceed without
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://ads.tiktok.com/',
        'Origin': 'https://ads.tiktok.com',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
