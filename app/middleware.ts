import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './src/app/supabase/middleware'
import { createClient } from './src/app/supabase/server'

export async function middleware(request: NextRequest) {
  // Apply Supabase session management
  let response = await updateSession(request)
  
  // Admin route protection
  if (request.nextUrl.pathname.startsWith('/admin')) {
    try {
      const supabase = await createClient()
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return NextResponse.redirect(new URL('/login?message=Admin access required', request.url))
      }

      // Get user profile with role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        return NextResponse.redirect(new URL('/login?message=Admin access required', request.url))
      }

      // Check if user has admin role (checking both role field and username/email for legacy support)
      const isAdmin = profile.role === 'admin' || 
                     profile.username === 'admin' || 
                     user.email === 'contact@bluefx.net'

      if (!isAdmin) {
        return NextResponse.redirect(new URL('/?message=Access denied', request.url))
      }
    } catch (error) {
      console.error('Admin middleware error:', error)
      return NextResponse.redirect(new URL('/login?message=Authentication error', request.url))
    }
  }
  
  // Rate limiting for webhook endpoints
  if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    
    // Simple rate limiting (in production, use Redis or similar)
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute
    const maxRequests = 10
    
    // This is a simplified example - in production use proper rate limiting
    const requestCount = parseInt(request.headers.get('x-request-count') || '0')
    
    if (requestCount > maxRequests) {
      return new NextResponse('Rate limit exceeded', { status: 429 })
    }
  }

  // Security headers
  if (response instanceof NextResponse) {
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    )
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}