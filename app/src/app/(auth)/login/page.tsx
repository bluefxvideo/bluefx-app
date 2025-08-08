import { createClient } from '@/app/supabase/server'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import LoginForm from './login-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Sign In - BlueFX',
  description: 'Sign in to your BlueFX account to access your AI-powered tools.',
}

export default async function LoginPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-center">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-center">
              Sign in to access your BlueFX dashboard and AI tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            New to BlueFX?{' '}
            <Link href="/pricing" className="text-primary hover:underline">
              Get started with a plan
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}