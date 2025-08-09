import { createClient } from '@/app/supabase/server'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { Suspense } from 'react'
import PasswordSetupForm from './password-setup-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Shield, Check } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Set Up Password - BlueFX',
  description: 'Complete your BlueFX account setup by creating a secure password.',
}

export default async function SetupPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ legacy?: string; from?: string }>
}) {
  const supabase = await createClient()
  const _params = await searchParams
  
  // Check if user is authenticated (token should already be verified by auth-callback)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    console.error('❌ No authenticated user found for password setup')
    redirect('/login?error=' + encodeURIComponent('Authentication required. Please request a new password reset link.'))
  }

  console.log('✅ User authenticated for password setup:', user.email)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-center">
          <Link 
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>

        {/* Setup Card */}
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-2">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Set Up Your Password
            </CardTitle>
            <CardDescription className="text-center">
              Welcome to BlueFX! Please create a secure password to complete your account setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div>Loading...</div>}>
              <PasswordSetupForm />
            </Suspense>
          </CardContent>
        </Card>

        {/* Security Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Password Security Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">Use at least 8 characters</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">Include uppercase and lowercase letters</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">Add numbers and special characters</span>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Already have a password?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}