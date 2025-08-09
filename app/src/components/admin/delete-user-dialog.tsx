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
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Tables } from '@/types/database'

interface UserWithStats extends Tables<'profiles'> {
  email?: string
  is_suspended?: boolean
  suspension_reason?: string | null
  subscription?: Tables<'user_subscriptions'> | null
  credits?: Tables<'user_credits'> | null
  totalCreditsUsed?: number
  lastActivity?: string | null
}

interface DeleteUserDialogProps {
  user: UserWithStats
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess
}: DeleteUserDialogProps) {
  const [confirmation, setConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expectedConfirmation = `DELETE ${user.username}`
  const isConfirmationValid = confirmation === expectedConfirmation

  const handleDelete = async () => {
    if (!isConfirmationValid) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          confirmation: expectedConfirmation
        }),
      })

      if (response.ok) {
        onOpenChange(false)
        onSuccess?.()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Delete user error:', error)
      setError('Failed to delete user. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    setConfirmation('')
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-red-600">
            <Trash2 className="h-5 w-5 mr-2" />
            Delete User Account
          </DialogTitle>
          <DialogDescription>
            This will permanently delete the user account and all associated data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Info */}
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                  <span className="font-medium text-red-800 dark:text-red-200">
                    Account to be deleted:
                  </span>
                </div>
                <div className="ml-6 space-y-1 text-sm">
                  <div><strong>Username:</strong> {user.username}</div>
                  <div><strong>Email:</strong> {user.email}</div>
                  <div><strong>Role:</strong> {user.role || 'user'}</div>
                  {user.subscription && (
                    <div><strong>Subscription:</strong> {user.subscription.status}</div>
                  )}
                  {user.credits && (
                    <div><strong>Credits:</strong> {user.credits.available_credits} available</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warning */}
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
            <CardContent className="p-4">
              <div className="text-sm text-red-800 dark:text-red-200">
                <div className="font-medium mb-2">⚠️ This action will permanently delete:</div>
                <ul className="space-y-1 ml-4">
                  <li>• All user-generated content (images, videos, etc.)</li>
                  <li>• Subscription and billing records</li>
                  <li>• Credit usage history</li>
                  <li>• Account data and login access</li>
                  <li>• All files in storage</li>
                </ul>
                <div className="font-medium mt-3 text-red-900 dark:text-red-100">
                  This action cannot be undone.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Type <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono text-sm">
                {expectedConfirmation}
              </code> to confirm:
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={expectedConfirmation}
              className={confirmation && !isConfirmationValid ? 'border-red-500' : ''}
              disabled={isDeleting}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmationValid || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}