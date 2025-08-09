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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Shield, User, Headphones, TestTube } from 'lucide-react'
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

interface ChangeRoleDialogProps {
  user: UserWithStats
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const roles = [
  { value: 'user', label: 'User', icon: User, description: 'Standard user access' },
  { value: 'admin', label: 'Admin', icon: Shield, description: 'Full administrative access' },
  { value: 'support', label: 'Support', icon: Headphones, description: 'Customer support access' },
  { value: 'tester', label: 'Tester', icon: TestTube, description: 'Beta testing access' },
]

export function ChangeRoleDialog({ user, open, onOpenChange, onSuccess }: ChangeRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string>(user.role || 'user')
  const [loading, setLoading] = useState(false)

  const handleChangeRole = async () => {
    if (selectedRole === user.role) {
      alert('No changes to save')
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/admin/change-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          newRole: selectedRole
        })
      })

      const result = await response.json()

      if (result.success) {
        alert(`User role changed to ${selectedRole}`)
        onSuccess?.()
        onOpenChange(false)
      } else {
        alert('Error: ' + result.error)
      }
    } catch (_error) {
      alert('Failed to change user role')
    } finally {
      setLoading(false)
    }
  }

  const currentRole = roles.find(role => role.value === (user.role || 'user'))
  const newRole = roles.find(role => role.value === selectedRole)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change User Role</DialogTitle>
          <DialogDescription>
            Update the role for {user.username} ({user.full_name})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Role */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Role</label>
            <div className="flex items-center space-x-2">
              {currentRole && <currentRole.icon className="h-4 w-4" />}
              <Badge variant="outline">
                {currentRole?.label || 'User'}
              </Badge>
              <span className="text-sm text-gray-500">
                {currentRole?.description}
              </span>
            </div>
          </div>

          {/* New Role Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">New Role</label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    <div className="flex items-center space-x-2">
                      <role.icon className="h-4 w-4" />
                      <span>{role.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {newRole && (
              <p className="text-sm text-gray-500">{newRole.description}</p>
            )}
          </div>

          {/* Warning for Admin Role */}
          {selectedRole === 'admin' && user.role !== 'admin' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Warning</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                Admin role grants full access to all system functions. Use with caution.
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
              onClick={handleChangeRole}
              disabled={loading || selectedRole === user.role}
            >
              {loading ? 'Changing...' : 'Change Role'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}