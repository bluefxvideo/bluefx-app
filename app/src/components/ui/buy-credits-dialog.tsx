'use client'

import { useState } from 'react'
import { useCredits } from '@/hooks/useCredits'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CreditCard, Zap, Star, Crown } from 'lucide-react'

interface BuyCreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CREDIT_PACKAGES = [
  { 
    id: 'ai-credit-pack-100', 
    credits: 100, 
    price: '$9.99',
    popular: false,
    description: 'Perfect for trying out features',
    icon: CreditCard,
    gradient: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'ai-credit-pack-500', 
    credits: 500, 
    price: '$39.99',
    popular: true,
    description: 'Most popular choice',
    icon: Zap,
    gradient: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'ai-credit-pack-1000', 
    credits: 1000, 
    price: '$69.99',
    popular: false,
    description: 'Best value for power users',
    icon: Star,
    gradient: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'ai-credit-pack-2500', 
    credits: 2500, 
    price: '$149.99',
    popular: false,
    description: 'For heavy usage',
    icon: Crown,
    gradient: 'from-blue-500 to-cyan-500'
  },
]

export function BuyCreditsDialog({ open, onOpenChange }: BuyCreditsDialogProps) {
  const { isPurchasing, credits } = useCredits()
  const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null)

  const handlePurchase = (packageId: string) => {
    setPurchasingPackage(packageId)
    
    try {
      // Check if FastSpring is loaded
      if (typeof window !== 'undefined' && window.fastspring) {
        console.log('Launching FastSpring checkout for:', packageId)
        
        // Set up the FastSpring checkout
        window.fastspring.builder.reset()
        window.fastspring.builder.add(packageId)
        
        // Set user email if logged in (you might want to get this from your auth context)
        const userEmail = localStorage.getItem('user-email')
        if (userEmail) {
          window.fastspring.builder.secure({
            contact_email: userEmail
          })
        }
        
        // Launch checkout
        window.fastspring.builder.checkout()
        
        // Close dialog after launching checkout
        onOpenChange(false)
      } else {
        console.warn('FastSpring not loaded, using fallback URL')
        // Fallback: open FastSpring storefront in new window
        const fallbackUrl = `https://bluefx.onfastspring.com/popup-${packageId}`
        window.open(fallbackUrl, '_blank', 'width=600,height=700')
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Error launching FastSpring checkout:', error)
      // Fallback: open storefront URL
      const fallbackUrl = `https://bluefx.onfastspring.com/popup-${packageId}`
      window.open(fallbackUrl, '_blank', 'width=600,height=700')
      onOpenChange(false)
    } finally {
      // Reset purchasing state after a delay
      setTimeout(() => {
        setPurchasingPackage(null)
      }, 2000)
    }
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
            const isCurrentlyPurchasing = purchasingPackage === pkg.id
            
            return (
              <Card 
                key={pkg.id} 
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
                  
                  <Button
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={isPurchasing || isCurrentlyPurchasing}
                    className={`w-full bg-gradient-to-r ${pkg.gradient} hover:opacity-90 text-white border-0 h-9`}
                    size="sm"
                  >
                    {isCurrentlyPurchasing ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Launching...
                      </>
                    ) : isPurchasing ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-3 w-3" />
                        Purchase Now
                      </>
                    )}
                  </Button>
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

// Extend Window interface for FastSpring
declare global {
  interface Window {
    fastspring?: {
      builder: {
        reset(): void
        add(productId: string): void
        secure(options: { contact_email: string }): void
        checkout(): void
      }
    }
  }
}