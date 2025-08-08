import { createClient } from '@/app/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  console.log('Auth confirm hit with URL:', request.url)
  
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const errorCode = searchParams.get('error_code')

  console.log('Auth confirm params:', { 
    token_hash: !!token_hash, 
    type, 
    error, 
    errorDescription, 
    errorCode, 
    next 
  })

  if (error) {
    console.error('Auth confirm error:', error, errorDescription, errorCode)
    return NextResponse.redirect(`${origin}/error?message=${encodeURIComponent(errorDescription || error)}`)
  }

  if (token_hash && type) {
    const supabase = await createClient()
    
    try {
      console.log('Verifying OTP with token_hash and type:', type)
      
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      })
      
      if (verifyError) {
        console.error('OTP verification error:', verifyError)
        return NextResponse.redirect(`${origin}/error?message=${encodeURIComponent(verifyError.message)}`)
      }
      
      console.log('OTP verification successful')

      // Check if user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('No user session after confirmation:', userError)
        return NextResponse.redirect(`${origin}/error?message=Authentication+failed`)
      }

      console.log('User authenticated:', user.email)

      // Check if this is a legacy user setup by looking at user metadata
      const isLegacySetup = user?.user_metadata?.is_legacy_setup

      if (isLegacySetup || type === 'recovery') {
        console.log('Redirecting to password setup...')
        return NextResponse.redirect(`${origin}/setup-password?legacy=${isLegacySetup}`)
      }

      // Success - redirect to intended destination
      console.log('Redirecting to:', next)
      return NextResponse.redirect(`${origin}${next}`)
      
    } catch (error) {
      console.error('Unexpected auth confirm error:', error)
      return NextResponse.redirect(`${origin}/error?message=Authentication+failed`)
    }
  }

  // No token_hash parameter - invalid callback
  console.log('No token_hash parameter found')
  return NextResponse.redirect(`${origin}/error?message=Invalid+authentication+confirmation`)
}