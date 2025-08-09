'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

interface CancellationFeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmitAndCancel: (feedback: CancellationFeedback) => Promise<void>
  isSubmitting: boolean
}

export interface CancellationFeedback {
  primaryReason: string
  secondaryReasons: string[]
  feedbackText: string
  wouldRecommendScore: number | null
}

const PRIMARY_REASONS = [
  { id: 'too_expensive', label: 'Too expensive / Cost concerns' },
  { id: 'not_using_enough', label: 'Not using the service enough' },
  { id: 'missing_features', label: 'Missing features I need' },
  { id: 'poor_quality', label: 'Quality of results not meeting expectations' },
  { id: 'switching_service', label: 'Switching to a different service' },
  { id: 'technical_issues', label: 'Technical issues or bugs' },
  { id: 'customer_service', label: 'Customer service experience' },
  { id: 'other', label: 'Other reason' }
]

const SECONDARY_REASONS = [
  'Difficult to use interface',
  'Slow generation times',
  'Limited customization options',
  'Not enough credits per month',
  'Found a better alternative',
  'No longer need AI content creation',
  'Budget constraints',
  'Company policy change'
]

export function CancellationFeedbackModal({
  isOpen,
  onClose,
  onSubmitAndCancel,
  isSubmitting
}: CancellationFeedbackModalProps) {
  const [primaryReason, setPrimaryReason] = useState('')
  const [secondaryReasons, setSecondaryReasons] = useState<string[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [wouldRecommendScore, setWouldRecommendScore] = useState<number | null>(null)

  if (!isOpen) return null

  const handleSecondaryReasonChange = (reason: string, checked: boolean) => {
    if (checked) {
      setSecondaryReasons(prev => [...prev, reason])
    } else {
      setSecondaryReasons(prev => prev.filter(r => r !== reason))
    }
  }

  const handleSubmit = async () => {
    if (!primaryReason) return

    const feedback: CancellationFeedback = {
      primaryReason,
      secondaryReasons,
      feedbackText,
      wouldRecommendScore
    }

    await onSubmitAndCancel(feedback)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            Help us improve - Quick feedback
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0"
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Intro Text */}
          <div className="text-sm text-muted-foreground">
            We&apos;re sorry to see you go! Your feedback helps us improve BlueFX for everyone. 
            This will only take a minute and is completely optional.
          </div>

          {/* Primary Reason */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              What&apos;s the main reason you&apos;re canceling? *
            </Label>
            <div className="space-y-2">
              {PRIMARY_REASONS.map((reason) => (
                <label
                  key={reason.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
                >
                  <input
                    type="radio"
                    name="primaryReason"
                    value={reason.id}
                    checked={primaryReason === reason.id}
                    onChange={(e) => setPrimaryReason(e.target.value)}
                    className="text-primary"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm">{reason.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Secondary Reasons */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Any additional factors? (Select all that apply)
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SECONDARY_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex items-center space-x-3 p-2 rounded cursor-pointer hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={secondaryReasons.includes(reason)}
                    onCheckedChange={(checked) => 
                      handleSecondaryReasonChange(reason, checked as boolean)
                    }
                    disabled={isSubmitting}
                  />
                  <span className="text-sm">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Recommendation Score */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              How likely are you to recommend BlueFX to others?
            </Label>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Not at all likely</span>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setWouldRecommendScore(score)}
                    disabled={isSubmitting}
                    className={`w-8 h-8 text-sm rounded border transition-colors ${
                      wouldRecommendScore === score
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Extremely likely</span>
            </div>
          </div>

          {/* Additional Comments */}
          <div className="space-y-3">
            <Label htmlFor="feedback" className="text-base font-medium">
              Anything else you&apos;d like us to know?
            </Label>
            <Textarea
              id="feedback"
              placeholder="Your feedback helps us improve... (optional)"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              maxLength={500}
              disabled={isSubmitting}
              className="resize-none"
            />
            <div className="text-xs text-muted-foreground text-right">
              {feedbackText.length}/500 characters
            </div>
          </div>

          {/* Final Warning */}
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
            <CardContent className="p-4">
              <div className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
                ⚠️ Final Confirmation - Complete Account Deletion
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                By proceeding, your subscription will be cancelled with FastSpring and your entire account will be permanently deleted immediately. This includes:
                • All generated content (images, videos, music, etc.)
                • Your account data and creation history
                • All remaining credits
                • Your login access
                This action cannot be undone.
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Go Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!primaryReason || isSubmitting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
'Yes, Delete My Account & Cancel'
              )}
            </Button>
          </div>

          {/* Small Print */}
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            We value your feedback and will use it to improve our service for future users.
          </div>
        </div>
      </div>
    </div>
  )
}