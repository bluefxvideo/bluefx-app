import { NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (code) {
    const supabase = await createClient();
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Auth callback error:', error);
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message)}`);
      }
      
      if (data.session && data.user) {
        // Get the provider information from the session
        const provider = data.user.app_metadata?.provider;
        const providerToken = data.session.provider_token;
        const providerRefreshToken = data.session.provider_refresh_token;
        
        console.log('OAuth success:', {
          provider,
          userId: data.user.id,
          email: data.user.email,
          hasProviderToken: !!providerToken,
        });
        
        // TODO: Store the social platform connection in your database
        // This would map the OAuth provider to your content multiplier platform
        
        // Redirect back to content multiplier with success
        return NextResponse.redirect(`${origin}/dashboard/content-multiplier?connected=${provider}`);
      }
    } catch (error) {
      console.error('Auth callback unexpected error:', error);
      return NextResponse.redirect(`${origin}/auth/error?message=Unexpected error occurred`);
    }
  }
  
  // No code provided, redirect to error
  return NextResponse.redirect(`${origin}/auth/error?message=No authorization code provided`);
}