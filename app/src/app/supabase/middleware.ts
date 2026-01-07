import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Allow auth callback processing to handle tokens properly
  // Only skip for static assets or specific non-auth routes if needed

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options || {})
          )
        },
      },
    }
  )

  // IMPORTANT: DO NOT REMOVE auth.getUser() - maintains session state
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user is suspended (only for dashboard routes)
  if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
    // Skip suspension check for the suspended page itself
    if (!request.nextUrl.pathname.startsWith('/dashboard/suspended')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_suspended, suspension_reason')
        .eq('id', user.id)
        .single()

      if (profile?.is_suspended) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/suspended'
        return NextResponse.redirect(url)
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}