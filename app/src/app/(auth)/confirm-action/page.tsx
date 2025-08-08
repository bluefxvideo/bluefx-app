'use client'

import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ConfirmActionPage() {
  const searchParams = useSearchParams()
  const confirmationUrl = searchParams.get('confirmation_url')
  const action = searchParams.get('action') || 'confirm'

  const handleConfirm = () => {
    if (confirmationUrl) {
      // Redirect to the actual confirmation URL
      window.location.href = confirmationUrl
    }
  }

  const actionText = {
    reset: {
      title: 'Reset Your Password',
      description: 'Click the button below to reset your password.',
      button: 'Reset Password'
    },
    signup: {
      title: 'Confirm Your Email',
      description: 'Click the button below to confirm your email address.',
      button: 'Confirm Email'
    },
    default: {
      title: 'Confirm Action',
      description: 'Click the button below to continue.',
      button: 'Confirm'
    }
  }

  const text = actionText[action as keyof typeof actionText] || actionText.default

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>{text.title}</CardTitle>
          <CardDescription>{text.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {confirmationUrl ? (
            <Button onClick={handleConfirm} className="w-full">
              {text.button}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Invalid or expired confirmation link. Please request a new one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}