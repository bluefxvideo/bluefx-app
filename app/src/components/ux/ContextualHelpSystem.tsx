import React, { useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HelpItem {
  target: string
  title: string
  content: string
  trigger: 'hover' | 'click'
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

const HELP_CONTENT: Record<string, HelpItem[]> = {
  dashboard: [
    {
      target: '.credits-display',
      title: 'Credit System',
      content: 'Credits are used for AI generation. Different tools use different amounts. Your credits renew monthly with your subscription.',
      trigger: 'hover',
      placement: 'bottom'
    },
    {
      target: '.tool-grid',
      title: 'AI Tools',
      content: 'Access 10+ powerful AI tools for content creation. Click any tool to get started.',
      trigger: 'hover',
      placement: 'bottom'
    },
    {
      target: '.membership-status',
      title: 'Membership Status',
      content: 'Your current subscription status. Active members get unlimited access to all tools.',
      trigger: 'hover',
      placement: 'bottom'
    }
  ],
  'ai-cinematographer': [
    {
      target: '.script-input',
      title: 'Script Input',
      content: 'Describe your video scene in detail. Be specific about the setting, characters, and actions for better results!',
      trigger: 'click',
      placement: 'top'
    },
    {
      target: '.style-selector',
      title: 'Video Style',
      content: 'Choose the visual style that best matches your content. Different styles work better for different types of videos.',
      trigger: 'hover',
      placement: 'right'
    }
  ],
  'thumbnail-machine': [
    {
      target: '.prompt-input',
      title: 'Thumbnail Prompt',
      content: 'Describe what you want in your thumbnail. Include colors, emotions, and key elements for best results.',
      trigger: 'click',
      placement: 'top'
    },
    {
      target: '.aspect-ratio-selector',
      title: 'Aspect Ratio',
      content: 'Choose the right dimensions for your platform. YouTube thumbnails work best with 16:9 ratio.',
      trigger: 'hover',
      placement: 'bottom'
    }
  ]
}

interface ContextualHelpProps {
  page: string
}

interface ContextualTooltipProps {
  item: HelpItem
  onDismiss: () => void
  isDismissed: boolean
}

const ContextualTooltip: React.FC<ContextualTooltipProps> = ({ item, onDismiss, isDismissed }) => {
  const [isOpen, setIsOpen] = useState(false)

  if (isDismissed) return null

  const targetElement = document.querySelector(item.target)
  if (!targetElement) return null

  return (
    <Tooltip open={isOpen} onOpenChange={setIsOpen}>
      <TooltipTrigger asChild>
        <div
          className="absolute z-40 pointer-events-none"
          style={{
            top: targetElement.getBoundingClientRect().top + window.scrollY - 8,
            left: targetElement.getBoundingClientRect().right + window.scrollX + 8,
          }}
        >
          <Button
            size="sm"
            variant="outline"
            className="pointer-events-auto w-6 h-6 p-0 rounded-full "
            onClick={() => {
              if (item.trigger === 'click') {
                setIsOpen(!isOpen)
              }
            }}
            onMouseEnter={() => {
              if (item.trigger === 'hover') {
                setIsOpen(true)
              }
            }}
            onMouseLeave={() => {
              if (item.trigger === 'hover') {
                setIsOpen(false)
              }
            }}
          >
            <HelpCircle className="h-3 w-3" />
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side={item.placement || 'bottom'}
        className="max-w-xs p-3 bg-white border shadow-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-sm text-gray-900 mb-1">
              {item.title}
            </div>
            <div className="text-xs text-gray-600 leading-relaxed">
              {item.content}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-4 h-4 p-0 text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
              setIsOpen(false)
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export const ContextualHelpSystem: React.FC<ContextualHelpProps> = ({ page }) => {
  const [dismissedHelp, setDismissedHelp] = useState<Set<string>>(new Set())
  const helpItems = HELP_CONTENT[page] || []

  const dismissHelp = (target: string) => {
    setDismissedHelp(prev => new Set(prev).add(target))
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="contextual-help-system">
        {helpItems.map((item, index) => (
          <ContextualTooltip
            key={`${item.target}-${index}`}
            item={item}
            onDismiss={() => dismissHelp(item.target)}
            isDismissed={dismissedHelp.has(item.target)}
          />
        ))}
      </div>
    </TooltipProvider>
  )
}