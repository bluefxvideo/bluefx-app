'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Shield } from 'lucide-react'
import type { Tables } from '@/types/database'

interface UserWithStats extends Tables<'profiles'> {
  subscription?: Tables<'user_subscriptions'> | null
  credits?: Tables<'user_credits'> | null
}

interface SuspendUserDialogProps {
  user: UserWithStats
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function SuspendUserDialog({ user, open, onOpenChange, onSuccess }: SuspendUserDialogProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  
  const isSuspended = user.is_suspended || false

  const handleSuspendToggle = async () => {
    if (!isSuspended && !reason.trim()) {
      alert('Please provide a reason for suspension')
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/admin/suspend-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          suspend: !isSuspended,
          reason: reason.trim() || 'No reason provided'
        })
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message)
        onSuccess?.()
        onOpenChange(false)
        setReason('')
      } else {
        alert('Error: ' + result.error)
      }
    } catch (error) {
      alert('Failed to update user suspension status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {isSuspended ? (
              <>
                <Shield className="h-5 w-5 text-blue-600" />
                <span>Unsuspend User</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span>Suspend User</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isSuspended 
              ? `Restore access for ${user.username} (${user.full_name})`
              : `Suspend access for ${user.username} (${user.full_name})`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          <div className="p-3 border rounded-md">
            <h4 className="font-medium mb-2">Current Status</h4>
            <div className="flex items-center space-x-2">
              {isSuspended ? (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-red-600 font-medium">Suspended</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-blue-100 rounded-full"></div>
                  <span className="text-sm text-blue-600 font-medium">Active</span>
                </>
              )}
            </div>
            {isSuspended && user.suspension_reason && (
              <p className="text-sm text-gray-600 mt-2">
                <strong>Reason:</strong> {user.suspension_reason}
              </p>
            )}
          </div>

          {!isSuspended && (
            <>
              {/* Reason for Suspension */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Suspension *</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter the reason for suspending this user..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-gray-500">
                  This reason will be logged and may be visible to the user.
                </p>
              </div>

              {/* Warning */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Warning</span>
                </div>
                <p className="text-sm text-red-700 mt-1">
                  Suspending this user will immediately block their access to all platform features.
                  They will not be able to log in or use any services.
                </p>
              </div>
            </>
          )}

          {isSuspended && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Restore Access</span>
              </div>
              <p className="text-sm text-blue-600 mt-1">
                Unsuspending this user will restore their full access to the platform.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              variant={isSuspended ? "default" : "destructive"}
              onClick={handleSuspendToggle}
              disabled={loading || (!isSuspended && !reason.trim())}
            >
              {loading 
                ? (isSuspended ? 'Unsuspending...' : 'Suspending...') 
                : (isSuspended ? 'Unsuspend User' : 'Suspend User')
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}