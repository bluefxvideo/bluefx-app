'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react'
import { signIn } from '@/actions/auth'
import Link from 'next/link'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  })

  const email = watch('email')

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('email', data.email)
      formData.append('password', data.password)

      const result = await signIn(formData)
      
      if (result.success) {
        router.push('/dashboard')
      } else if (result.error?.includes('LEGACY_USER_NEEDS_SETUP')) {
        // Handle legacy user
        await handleLegacyUserSetup(data.email)
      } else {
        setError(result.error || 'Invalid credentials')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLegacyUserSetup = async (email: string) => {
    try {
      const { setupLegacyUserPassword } = await import('@/actions/auth')
      const formData = new FormData()
      formData.append('email', email)
      
      const result = await setupLegacyUserPassword(formData)
      
      if (result.success) {
        setResetSent(true)
        setError('')
      } else {
        setError(result.error || 'Failed to set up legacy account')
      }
    } catch {
      setError('Failed to set up legacy account')
    }
  }

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email first')
      return
    }

    try {
      const formData = new FormData()
      formData.append('email', email)

      // Using existing resetPassword action
      const { resetPassword } = await import('@/actions/auth')
      const result = await resetPassword(formData)
      
      if (result.success) {
        setResetSent(true)
        setError('')
      } else {
        setError(result.error || 'Failed to send reset email')
      }
    } catch {
      setError('Failed to send reset email')
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              className="pl-10"
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              className="pl-10"
              {...register('password')}
            />
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {resetSent && (
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Account setup email sent! Check your inbox and follow the instructions to complete your account setup with your legacy data.
            </AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>

        {/* Forgot Password */}
        <div className="flex flex-col space-y-2">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={handleResetPassword}
            disabled={!email || loading}
            className="text-sm"
          >
            Forgot your password?
          </Button>
          
          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/pricing" className="text-primary hover:underline">
              Choose a plan
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}