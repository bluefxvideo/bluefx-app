'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, CreditCard } from 'lucide-react'

interface AddCreditsDialogProps {
  user: {
    id: string
    username?: string | null
    full_name?: string | null
    credits?: {
      available_credits: number
    } | null
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddCreditsDialog({ user, open, onOpenChange, onSuccess }: AddCreditsDialogProps) {
  const [credits, setCredits] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleAddCredits = async () => {
    const creditAmount = parseInt(credits)
    
    if (!creditAmount || creditAmount <= 0) {
      alert('Please enter a valid number of credits')
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch('/api/admin/add-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          credits: creditAmount
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add credits')
      }

      alert(`Successfully added ${creditAmount} credits to ${user.username || user.full_name}`)

      setCredits('')
      onOpenChange(false)
      onSuccess?.()
      
    } catch (error) {
      alert('Failed to add credits. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Credits
          </DialogTitle>
          <DialogDescription>
            Add credits to {user.username || user.full_name}&apos;s account
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Current Credits Display */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-background">
            <span className="text-sm font-medium">Current Credits:</span>
            <Badge variant="outline" className="gap-1">
              <CreditCard className="h-3 w-3" />
              {user.credits?.available_credits || 0}
            </Badge>
          </div>

          {/* Add Credits Input */}
          <div className="space-y-2">
            <Label htmlFor="credits">Credits to Add</Label>
            <Input
              id="credits"
              type="number"
              placeholder="Enter amount..."
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              min="1"
              step="1"
            />
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCredits('100')}
            >
              +100
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCredits('500')}
            >
              +500
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCredits('1000')}
            >
              +1000
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAddCredits}
            disabled={isLoading || !credits}
          >
            {isLoading ? 'Adding...' : 'Add Credits'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}