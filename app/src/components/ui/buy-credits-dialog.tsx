'use client'

import { useCredits } from '@/hooks/useCredits'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CreditCard, Zap, Star, Crown, ExternalLink } from 'lucide-react'
import { createClient } from '@/app/supabase/client'
import { useEffect, useState } from 'react'

interface BuyCreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CREDIT_PACKAGES = [
  {
    credits: 100,
    price: '$9.99',
    popular: false,
    description: 'Perfect for trying out features',
    icon: CreditCard,
    gradient: 'from-blue-500 to-cyan-500',
    url: 'https://bluefx.onfastspring.com/100-ai-credit-pack'
  },
  {
    credits: 300,
    price: '$24.99',
    popular: true,
    description: 'Most popular choice',
    icon: Zap,
    gradient: 'from-blue-500 to-cyan-500',
    url: 'https://bluefx.onfastspring.com/300-ai-credit-pack'
  },
  {
    credits: 600,
    price: '$44.99',
    popular: false,
    description: 'Great for regular users',
    icon: Star,
    gradient: 'from-blue-500 to-cyan-500',
    url: 'https://bluefx.onfastspring.com/600-ai-credit-pack'
  },
  {
    credits: 1000,
    price: '$69.99',
    popular: false,
    description: 'Best value for power users',
    icon: Crown,
    gradient: 'from-blue-500 to-cyan-500',
    url: 'https://bluefx.onfastspring.com/1000-ai-credit-pack'
  },
]

export function BuyCreditsDialog({ open, onOpenChange }: BuyCreditsDialogProps) {
  const { isPurchasing, credits } = useCredits()
  const [userId, setUserId] = useState<string | null>(null)

  // Get current user ID to pass to FastSpring
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
      }
    })
  }, [])

  // Build purchase URL with user ID tag for webhook identification
  const buildPurchaseUrl = (baseUrl: string) => {
    if (userId) {
      // FastSpring supports tags parameter to pass custom data
      return `${baseUrl}?tags=userId:${userId}`
    }
    return baseUrl
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Buy More Credits</DialogTitle>
          <DialogDescription>
            Choose a credit package to continue creating amazing content.
            {credits && (
              <span className="font-medium text-foreground">
                {' '}Current balance: {credits.available_credits} credits
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isPurchasing && (
          <div className="flex items-center justify-center p-4 ">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
            <span className="text-blue-700 dark:text-blue-300">
              Processing your purchase... This may take a moment.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {CREDIT_PACKAGES.map((pkg) => {
            const Icon = pkg.icon

            return (
              <Card
                key={pkg.credits}
                className={`relative transition-all hover:shadow-lg ${
                  pkg.popular
                    ? 'ring-2 ring-green-500 scale-[1.02]'
                    : ''
                }`}
              >
                {pkg.popular && (
                  <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-100 text-white">
                    Most Popular
                  </Badge>
                )}

                <CardHeader className="text-center">
                  <div className={`mx-auto w-12 h-12 rounded-full bg-gradient-to-r ${pkg.gradient} flex items-center justify-center mb-2`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{pkg.credits.toLocaleString()} Credits</CardTitle>
                  <CardDescription className="text-xs">{pkg.description}</CardDescription>
                </CardHeader>

                <CardContent className="text-center py-2">
                  <div className="mb-2">
                    <span className="text-2xl font-bold">{pkg.price}</span>
                    <div className="text-xs text-muted-foreground mt-1">
                      ${(parseFloat(pkg.price.replace('$', '')) / pkg.credits * 100).toFixed(2)} per 100 credits
                    </div>
                  </div>

                  <a
                    href={buildPurchaseUrl(pkg.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center w-full bg-gradient-to-r ${pkg.gradient} hover:opacity-90 text-white border-0 h-9 rounded-md text-sm font-medium`}
                  >
                    <CreditCard className="mr-2 h-3 w-3" />
                    Purchase Now
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mt-3 p-2 bg-muted rounded-lg">
          <p className="text-md text-muted-foreground">
            💳 All payments are processed securely through FastSpring. Credits are added automatically after payment.
          </p>
        </div>

        <div className="flex justify-end mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPurchasing}
            size="sm"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}