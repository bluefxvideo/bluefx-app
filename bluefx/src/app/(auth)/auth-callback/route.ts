import { createClient } from '@/app/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  console.log('🔐 Password reset callback hit with URL:', request.url)
  
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const errorCode = searchParams.get('error_code')

  console.log('🔐 Auth callback params:', { 
    token_hash: !!token_hash, 
    type, 
    code: !!code, 
    error, 
    errorDescription, 
    errorCode, 
    next,
    userAgent: request.headers.get('user-agent'),
    referer: request.headers.get('referer')
  })

  if (error) {
    console.error('🚨 Auth callback error:', error, errorDescription, errorCode)
    
    // Handle common password reset errors
    if (errorCode === 'otp_expired') {
      console.error('🕒 Password reset link expired')
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Password reset link expired. Please request a new one.')}`)
    }
    
    if (errorCode === 'invalid_request' || error === 'invalid_request') {
      console.error('🔗 Invalid password reset link')
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Invalid password reset link. Please request a new one.')}`)
    }
    
    console.error('🔥 General auth error:', errorDescription || error)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription || error || 'Password reset failed')}`)
  }

  const supabase = await createClient()
  
  try {
    // Handle token_hash flow (password reset, email confirmation)
    if (token_hash && type) {
      console.log('🔑 Verifying OTP with token_hash and type:', type)
      
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      })
      
      if (verifyError) {
        console.error('❌ OTP verification failed:', verifyError.message)
        
        // Handle specific OTP errors
        if (verifyError.message?.includes('expired')) {
          return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Password reset link has expired. Please request a new one.')}`)
        }
        
        if (verifyError.message?.includes('invalid')) {
          return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Invalid password reset link. Please request a new one.')}`)
        }
        
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(verifyError.message)}`)
      }
      
      console.log('✅ OTP verification successful for user:', verifyData?.user?.email)
    }
    
    // Handle OAuth code flow (social logins, etc.)
    else if (code) {
      console.log('Exchanging code for session...')
      
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('Code exchange error:', exchangeError)
        return NextResponse.redirect(`${origin}/error?message=${encodeURIComponent(exchangeError.message)}`)
      }
      
      console.log('Code exchange successful')
    }

    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('❌ No user session after callback:', userError?.message)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Authentication failed. Please request a new password reset link.')}`)
    }

    console.log('User authenticated:', user.email)

    // Check if this is a legacy user setup by looking at user metadata
    const isLegacySetup = user?.user_metadata?.is_legacy_setup

    console.log('User metadata:', { 
      email: user?.email, 
      isLegacySetup, 
      metadata: user?.user_metadata 
    })

    if (isLegacySetup || type === 'recovery') {
      console.log('🔄 Password reset detected - redirecting to setup page')
      return NextResponse.redirect(`${origin}/setup-password?legacy=${isLegacySetup}&from=reset`)
    }

    // Success - redirect to intended destination
    console.log('✅ Auth successful - redirecting to:', next)
    return NextResponse.redirect(`${origin}${next}`)
    
  } catch (error) {
    console.error('💥 Unexpected auth callback error:', error)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Password reset failed. Please try again.')}`)
  }
}