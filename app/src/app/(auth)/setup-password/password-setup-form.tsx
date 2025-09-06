'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Loader2, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { updatePassword } from '@/actions/auth'

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don&apos;t match",
  path: ["confirmPassword"]
})

type PasswordFormData = z.infer<typeof passwordSchema>

export default function PasswordSetupForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLegacyUser, setIsLegacyUser] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    mode: 'onChange'
  })

  const password = watch('password', '')
  const confirmPassword = watch('confirmPassword', '')

  useEffect(() => {
    // Check if this is a legacy user setup
    setIsLegacyUser(searchParams.get('legacy') === 'true')
  }, [searchParams])

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' }
    
    let score = 0
    const feedback: string[] = []
    
    if (password.length >= 8) score += 1
    else feedback.push('At least 8 characters')
    
    if (/[a-z]/.test(password)) score += 1
    else feedback.push('Lowercase letter')
    
    if (/[A-Z]/.test(password)) score += 1
    else feedback.push('Uppercase letter')
    
    if (/\d/.test(password)) score += 1
    else feedback.push('Number')
    
    if (/[^a-zA-Z0-9]/.test(password)) score += 1
    else feedback.push('Special character')
    
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', '
    
    return {
      score: (score / 5) * 100,
      label: labels[Math.min(score, 4)],
      color: colors[Math.min(score, 4)],
      feedback
    }
  }, [password])

  const onSubmit = async (data: PasswordFormData) => {
    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('password', data.password)
      formData.append('confirmPassword', data.confirmPassword)
      formData.append('isLegacySetup', isLegacyUser.toString())

      const result = await updatePassword(formData)
      
      if (result.success) {
        if (result.data?.migrated) {
          // Show success message for legacy user
          router.push('/dashboard?welcome=legacy')
        } else {
          router.push('/dashboard')
        }
      } else {
        setError(result.error || 'Failed to set password')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const requirements = [
    { test: password.length >= 8, label: 'At least 8 characters' },
    { test: /[a-z]/.test(password), label: 'Lowercase letter' },
    { test: /[A-Z]/.test(password), label: 'Uppercase letter' },
    { test: /\d/.test(password), label: 'Number' },
    { test: /[^a-zA-Z0-9]/.test(password), label: 'Special character' }
  ]

  return (
    <div className="space-y-6">
      {/* Legacy User Welcome Message */}
      {isLegacyUser && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Welcome back! We found your legacy account. Set up your password to restore your credits and data.
          </AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              className="pl-10 pr-10"
              {...register('password')}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
          
          {/* Password Strength Indicator */}
          {password && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Password strength</span>
                <span className="text-sm font-medium">{passwordStrength.label}</span>
              </div>
              <Progress value={passwordStrength.score} className="h-2" />
            </div>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              className="pl-10 pr-10"
              {...register('confirmPassword')}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
          
          {/* Password Match Indicator */}
          {password && confirmPassword && (
            <div className="flex items-center gap-2">
              {password === confirmPassword ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">Passwords match</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">Passwords don&apos;t match</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Password Requirements */}
        {password && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Password Requirements</Label>
            <div className="grid grid-cols-1 gap-1">
              {requirements.map((req, index) => (
                <div key={index} className="flex items-center gap-2">
                  {req.test ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={`text-xs ${req.test ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <Button 
          type="submit" 
          className="w-full" 
          disabled={loading || passwordStrength.score < 60}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting up your password...
            </>
          ) : (
            'Complete Setup'
          )}
        </Button>
      </form>
    </div>
  )
}