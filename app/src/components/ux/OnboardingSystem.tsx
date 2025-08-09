import React, { useState, useEffect } from 'react'
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride'
import { createClient } from '@/app/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

const ONBOARDING_STEPS = {
  creator: [
    {
      target: '.dashboard-welcome',
      title: 'Welcome to BlueFX AI!',
      content: 'You&apos;re all set to create amazing content with AI tools designed for creators like you.',
      placement: 'center'
    },
    {
      target: '.tool-grid',
      title: 'Your AI Toolkit',
      content: 'Choose from 10+ powerful AI tools for content creation. Each tool is designed to help you create professional content quickly.',
      placement: 'bottom'
    },
    {
      target: '.credits-display',
      title: 'Credit System',
      content: 'Track your available credits here. Credits are used for AI generation - different tools use different amounts.',
      placement: 'bottom'
    }
  ],
  marketer: [
    {
      target: '.dashboard-welcome',
      title: 'Welcome to BlueFX AI!',
      content: 'Perfect for marketers! You have access to tools that will boost your marketing campaigns.',
      placement: 'center'
    },
    {
      target: '.content-multiplier',
      title: 'Content Multiplier',
      content: 'Repurpose your content across multiple platforms efficiently. Turn one piece of content into many.',
      placement: 'bottom'
    },
    {
      target: '.viral-trends',
      title: 'Trend Research',
      content: 'Discover what&apos;s trending to create viral content that resonates with your audience.',
      placement: 'bottom'
    }
  ]
}

interface User {
  id: string
  email: string
  ux_preferences?: {
    onboarding_completed?: boolean
    user_role?: string
  }
}

interface OnboardingSystemProps {
  user?: User | null
}

export const OnboardingSystem: React.FC<OnboardingSystemProps> = ({ user }) => {
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [userRole, setUserRole] = useState<'creator' | 'marketer'>('creator')
  const [showRoleSelection, setShowRoleSelection] = useState(false)

  useEffect(() => {
    if (user && !user.ux_preferences?.onboarding_completed) {
      // Show role selection dialog
      setShowRoleSelection(true)
    }
  }, [user])

  const handleJoyrideCallback = (data: Record<string, unknown>) => {
    const { action, index, status, type } = data as { action: string; index: number; status: string; type: string }

    if ([EVENTS.STEP_AFTER, EVENTS.TARGET_NOT_FOUND].includes(type as typeof EVENTS.STEP_AFTER)) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1))
    } else if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as typeof STATUS.FINISHED)) {
      setRun(false)
      completeOnboarding()
    }
  }

  const completeOnboarding = async () => {
    if (!user) return

    try {
      // Update user preferences in database - store in profiles for now
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) {
        console.error('Error updating onboarding status:', error)
      }
    } catch (error) {
      console.error('Error completing onboarding:', error)
    }
  }

  const startOnboarding = (role: 'creator' | 'marketer') => {
    setUserRole(role)
    setShowRoleSelection(false)
    setRun(true)
    setStepIndex(0)
  }

  const skipOnboarding = async () => {
    setShowRoleSelection(false)
    await completeOnboarding()
  }

  return (
    <>
      {/* Role Selection Dialog */}
      <Dialog open={showRoleSelection} onOpenChange={setShowRoleSelection}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Welcome to BlueFX AI!</DialogTitle>
            <DialogDescription>
              Let&apos;s personalize your experience. What best describes you?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => startOnboarding('creator')}
              className="w-full h-auto p-4 text-left"
              variant="outline"
            >
              <div>
                <div className="font-semibold">🎨 Content Creator</div>
                <div className="text-sm text-gray-500">
                  I create videos, thumbnails, and visual content
                </div>
              </div>
            </Button>
            <Button
              onClick={() => startOnboarding('marketer')}
              className="w-full h-auto p-4 text-left"
              variant="outline"
            >
              <div>
                <div className="font-semibold">📈 Marketer</div>
                <div className="text-sm text-gray-500">
                  I focus on marketing campaigns and content strategy
                </div>
              </div>
            </Button>
          </div>
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              onClick={skipOnboarding}
              className="text-sm text-gray-500"
            >
              Skip tour
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Joyride Tour */}
      <Joyride
        steps={ONBOARDING_STEPS[userRole] as any}
        run={run}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous
        showProgress
        showSkipButton
        styles={{
          options: {
            primaryColor: '#3B82F6',
            backgroundColor: '#FFFFFF',
            textColor: '#1F2937',
            arrowColor: '#FFFFFF',
            zIndex: 10000
          },
          tooltip: {
            fontSize: 14,
            padding: 20
          },
          tooltipTitle: {
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 8
          },
          tooltipContent: {
            lineHeight: 1.5
          },
          buttonNext: {
            backgroundColor: '#3B82F6',
            color: '#FFFFFF',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 500
          },
          buttonBack: {
            color: '#6B7280',
            marginRight: 8
          },
          buttonSkip: {
            color: '#6B7280'
          }
        }}
        locale={{
          back: 'Previous',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip tour'
        }}
      />
    </>
  )
}