'use client'

import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CancellationWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onKeepPlan: () => void
  onProceedToCancel: () => void
  currentPrice?: string
  futurePrice?: string
}

export function CancellationWarningModal({
  isOpen,
  onClose,
  onKeepPlan,
  onProceedToCancel,
  currentPrice = "$37",
  futurePrice = "$67"
}: CancellationWarningModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-3" />
            <h2 className="text-xl font-semibold">
              Wait! Don&apos;t lose your special rate
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-8 space-y-8">
          {/* Pricing Comparison */}
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-yellow-800 dark:text-yellow-200">
                You&apos;re Currently Getting a Special Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-6 bg-blue-100 dark:bg-blue-100/30 rounded-lg border border-blue-200 dark:border-green-800">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-600">
                    {currentPrice}
                  </div>
                  <div className="text-base text-blue-600 dark:text-blue-600 mt-2">
                    Your Current Rate
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-600 mt-1">
                    50% Discount
                  </div>
                </div>
                <div className="text-center p-6 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="text-3xl font-bold text-red-800 dark:text-red-200">
                    {futurePrice}
                  </div>
                  <div className="text-base text-red-700 dark:text-red-300 mt-2">
                    Regular Price
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                    If You Re-subscribe
                  </div>
                </div>
              </div>
              
              <div className="text-center text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                💰 You&apos;re saving {Math.round(((parseInt(futurePrice.replace('$', '')) - parseInt(currentPrice.replace('$', ''))) / parseInt(futurePrice.replace('$', ''))) * 100)}% per month with your current plan!
              </div>
            </CardContent>
          </Card>

          {/* Warning Text */}
          <div className="space-y-3">
            <h3 className="font-medium text-foreground">
              If you cancel, you will lose:
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start">
                <span className="text-red-500 mr-2 mt-0.5">•</span>
                <span>Your special {currentPrice}/month discounted rate forever</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2 mt-0.5">•</span>
                <span>Access to all your generated content and files</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2 mt-0.5">•</span>
                <span>Your account data and creation history</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2 mt-0.5">•</span>
                <span>Any remaining credits in your account</span>
              </li>
            </ul>
          </div>

          {/* Re-subscription Warning */}
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
            <CardContent className="p-4">
              <div className="text-sm text-orange-800 dark:text-orange-200 font-medium mb-2">
                ⚠️ Important Note
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-300">
                If you decide to re-subscribe later, you&apos;ll pay the full {futurePrice}/month rate. 
                Special discounts are typically only available to new customers.
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={onKeepPlan}
              className="flex-1 bg-blue-100 hover:bg-blue-100 text-white"
            >
              Keep My Discounted Plan
            </Button>
            <Button
              variant="outline"
              onClick={onProceedToCancel}
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              Yes, Cancel Anyway
            </Button>
          </div>

          {/* Small Print */}
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            We hate to see you go! If you have any issues, our support team is here to help.
          </div>
        </div>
      </div>
    </div>
  )
}