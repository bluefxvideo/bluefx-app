'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Users, 
  Search,
  Shield,
  CreditCard,
  Download,
  Trash2,
  UserX,
  UserCheck
} from 'lucide-react'
import { AddCreditsDialog } from './add-credits-dialog'
import { ChangeRoleDialog } from './change-role-dialog'
import { SuspendUserDialog } from './suspend-user-dialog'
import { DeleteUserDialog } from './delete-user-dialog'
import { AdminUserCreateDialog } from './admin-user-create-dialog'
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

interface AdminUserTableProps {
  users: UserWithStats[]
}

/**
 * Get role badge styling
 */
function getRoleBadge(role?: string | null, isSuspended?: boolean) {
  const roleElement = (() => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive" className="text-xs">Admin</Badge>
      case 'support':
        return <Badge variant="secondary" className="text-xs">Support</Badge>
      case 'tester':
        return <Badge variant="outline" className="text-xs">Tester</Badge>
      default:
        return <Badge variant="default" className="text-xs">User</Badge>
    }
  })()

  return (
    <div className="flex items-center space-x-1">
      {roleElement}
      {isSuspended && (
        <Badge variant="destructive" className="text-xs bg-red-100 text-red-800">
          Suspended
        </Badge>
      )}
    </div>
  )
}

/**
 * Get subscription status badge
 * All users are Pro users - just show their subscription status
 */
function getSubscriptionBadge(subscription?: Tables<'user_subscriptions'> | null) {
  // Everyone is a Pro user - show status or default to Pro
  if (!subscription) {
    // User should have a subscription, but if missing, they're still Pro
    return <Badge variant="default" className="text-xs bg-blue-100 text-blue-600">Pro</Badge>
  }

  switch (subscription.status) {
    case 'active':
      return <Badge variant="default" className="text-xs bg-blue-100 text-blue-600">Pro (Active)</Badge>
    case 'cancelled':
      return <Badge variant="secondary" className="text-xs">Pro (Cancelled)</Badge>
    case 'expired':
      return <Badge variant="outline" className="text-xs">Pro (Expired)</Badge>
    case 'pending':
      return <Badge variant="outline" className="text-xs">Pro (Pending)</Badge>
    default:
      return <Badge variant="default" className="text-xs bg-blue-100 text-blue-600">Pro</Badge>
  }
}

export function AdminUserTable({ users }: AdminUserTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null)
  const [isAddCreditsOpen, setIsAddCreditsOpen] = useState(false)
  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false)
  const [isSuspendUserOpen, setIsSuspendUserOpen] = useState(false)
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false)
  
  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddCredits = (user: UserWithStats) => {
    setSelectedUser(user)
    setIsAddCreditsOpen(true)
  }

  const handleChangeRole = (user: UserWithStats) => {
    setSelectedUser(user)
    setIsChangeRoleOpen(true)
  }

  const handleSuspendUser = (user: UserWithStats) => {
    setSelectedUser(user)
    setIsSuspendUserOpen(true)
  }

  const handleDeleteUser = (user: UserWithStats) => {
    setSelectedUser(user)
    setIsDeleteUserOpen(true)
  }

  const handleSuccess = () => {
    // Refresh page to get updated data
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* Action buttons and Search */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <AdminUserCreateDialog />
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              Registered accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.subscription?.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Paying customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'admin' || u.username === 'admin').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Administrative accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search Results Info */}
      {searchTerm && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} users 
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Complete list of registered users with their account details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Table Header */}
          <div className="grid gap-4 py-3 border-b bg-muted/50" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
            <div className="font-medium text-muted-foreground">User</div>
            <div className="font-medium text-muted-foreground">Role</div>
            <div className="font-medium text-muted-foreground">Subscription</div>
            <div className="font-medium text-muted-foreground">Credits</div>
            <div className="font-medium text-muted-foreground">Last Activity</div>
            <div className="font-medium text-muted-foreground">Actions</div>
          </div>
          
          {/* Table Body */}
          <div className="divide-y">
            {filteredUsers.map((user) => (
              <div key={user.id} className="grid gap-4 py-3 hover:bg-accent/50" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
                <div>
                  <div className="font-medium text-foreground">{user.email || user.username}</div>
                  <div className="text-sm text-muted-foreground">{user.full_name || user.username}</div>
                </div>
                <div>
                  {getRoleBadge(user.role, user.is_suspended ?? undefined)}
                </div>
                <div>
                  {getSubscriptionBadge(user.subscription)}
                </div>
                <div className="text-sm">
                  <div>{user.credits?.available_credits || 0} available</div>
                  <div className="text-muted-foreground">{user.totalCreditsUsed || 0} used</div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {user.lastActivity 
                    ? new Date(user.lastActivity).toLocaleDateString()
                    : 'Never'
                  }
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleAddCredits(user)}
                    className="h-8 w-8"
                    title="Add credits"
                  >
                    <CreditCard className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleChangeRole(user)}
                    className="h-8 w-8"
                    title="Change role"
                  >
                    <Shield className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleSuspendUser(user)}
                    className="h-8 w-8"
                    title={user.is_suspended ? 'Unsuspend user' : 'Suspend user'}
                  >
                    {user.is_suspended ? (
                      <UserCheck className="h-4 w-4 text-blue-600" />
                    ) : (
                      <UserX className="h-4 w-4 text-orange-600" />
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleDeleteUser(user)}
                    className="h-8 w-8 hover:text-red-600"
                    title="Delete account"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filteredUsers.length === 0 && searchTerm && (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No users found</h3>
              <p className="text-muted-foreground">Try adjusting your search term.</p>
            </div>
          )}

          {users.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No users found</h3>
              <p className="text-muted-foreground">Get started by adding your first user.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs - rendered via portals, won't affect layout */}
      {selectedUser && (
        <>
          <AddCreditsDialog
            user={{
              id: selectedUser.id,
              username: selectedUser.username,
              full_name: selectedUser.full_name,
              credits: selectedUser.credits ? {
                available_credits: selectedUser.credits.available_credits ?? 0
              } : null
            }}
            open={isAddCreditsOpen}
            onOpenChange={setIsAddCreditsOpen}
            onSuccess={handleSuccess}
          />
          <ChangeRoleDialog
            user={selectedUser}
            open={isChangeRoleOpen}
            onOpenChange={setIsChangeRoleOpen}
            onSuccess={handleSuccess}
          />
          <SuspendUserDialog
            user={selectedUser}
            open={isSuspendUserOpen}
            onOpenChange={setIsSuspendUserOpen}
            onSuccess={handleSuccess}
          />
          <DeleteUserDialog
            user={selectedUser}
            open={isDeleteUserOpen}
            onOpenChange={setIsDeleteUserOpen}
            onSuccess={handleSuccess}
          />
        </>
      )}
    </div>
  )
}