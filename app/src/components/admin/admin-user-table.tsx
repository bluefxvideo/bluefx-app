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
  UserCheck,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { AddCreditsDialog } from './add-credits-dialog'
import { ChangeRoleDialog } from './change-role-dialog'
import { SuspendUserDialog } from './suspend-user-dialog'
import { DeleteUserDialog } from './delete-user-dialog'
import { AdminUserCreateDialog } from './admin-user-create-dialog'
import { UserUsageDialog } from './user-usage-dialog'
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

type SortField = 'user' | 'role' | 'plan' | 'status' | 'credits' | 'joined' | 'lastActivity'
type SortDirection = 'asc' | 'desc'

/**
 * Determine if subscription is yearly or monthly based on period length
 */
function getBillingType(subscription?: Tables<'user_subscriptions'> | null): 'yearly' | 'monthly' | null {
  if (!subscription?.current_period_start || !subscription?.current_period_end) {
    return null
  }
  const start = new Date(subscription.current_period_start)
  const end = new Date(subscription.current_period_end)
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  return daysDiff > 60 ? 'yearly' : 'monthly'
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
    case 'trial':
      return <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">Trial</Badge>
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

const USERS_PER_PAGE = 25

export function AdminUserTable({ users }: AdminUserTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null)
  const [isAddCreditsOpen, setIsAddCreditsOpen] = useState(false)
  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false)
  const [isSuspendUserOpen, setIsSuspendUserOpen] = useState(false)
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false)
  const [isUsageDialogOpen, setIsUsageDialogOpen] = useState(false)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, start with ascending
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1) // Reset to first page when sorting
  }

  // Get sort icon for column header
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Sort filtered users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortField) return 0

    let comparison = 0
    switch (sortField) {
      case 'user':
        comparison = (a.email || a.username || '').localeCompare(b.email || b.username || '')
        break
      case 'role':
        comparison = (a.role || 'user').localeCompare(b.role || 'user')
        break
      case 'plan':
        const planA = getBillingType(a.subscription) || ''
        const planB = getBillingType(b.subscription) || ''
        comparison = planA.localeCompare(planB)
        break
      case 'status':
        const statusA = a.subscription?.status || ''
        const statusB = b.subscription?.status || ''
        comparison = statusA.localeCompare(statusB)
        break
      case 'credits':
        comparison = (a.credits?.available_credits || 0) - (b.credits?.available_credits || 0)
        break
      case 'joined':
        const joinedA = a.created_at ? new Date(a.created_at).getTime() : 0
        const joinedB = b.created_at ? new Date(b.created_at).getTime() : 0
        comparison = joinedA - joinedB
        break
      case 'lastActivity':
        const dateA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
        const dateB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
        comparison = dateA - dateB
        break
    }

    return sortDirection === 'asc' ? comparison : -comparison
  })

  // Pagination (use sortedUsers for proper ordering)
  const totalPages = Math.ceil(sortedUsers.length / USERS_PER_PAGE)
  const startIndex = (currentPage - 1) * USERS_PER_PAGE
  const paginatedUsers = sortedUsers.slice(startIndex, startIndex + USERS_PER_PAGE)

  // Reset to page 1 when search term changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

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

  const handleViewUsage = (user: UserWithStats) => {
    setSelectedUser(user)
    setIsUsageDialogOpen(true)
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
            onChange={(e) => handleSearchChange(e.target.value)}
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
          <div className="grid gap-3 py-3 border-b bg-muted/50 px-2" style={{ gridTemplateColumns: '200px 70px 70px 150px 100px 100px 85px 85px 140px' }}>
            <button
              onClick={() => handleSort('user')}
              className="font-medium text-muted-foreground flex items-center hover:text-foreground transition-colors text-left"
            >
              User {getSortIcon('user')}
            </button>
            <button
              onClick={() => handleSort('role')}
              className="font-medium text-muted-foreground flex items-center hover:text-foreground transition-colors text-left"
            >
              Role {getSortIcon('role')}
            </button>
            <button
              onClick={() => handleSort('plan')}
              className="font-medium text-muted-foreground flex items-center hover:text-foreground transition-colors text-left"
            >
              Plan {getSortIcon('plan')}
            </button>
            <div className="font-medium text-muted-foreground">Subscription ID</div>
            <button
              onClick={() => handleSort('status')}
              className="font-medium text-muted-foreground flex items-center hover:text-foreground transition-colors text-left"
            >
              Status {getSortIcon('status')}
            </button>
            <button
              onClick={() => handleSort('credits')}
              className="font-medium text-muted-foreground flex items-center hover:text-foreground transition-colors text-left"
            >
              Credits {getSortIcon('credits')}
            </button>
            <button
              onClick={() => handleSort('joined')}
              className="font-medium text-muted-foreground flex items-center hover:text-foreground transition-colors text-left"
            >
              Joined {getSortIcon('joined')}
            </button>
            <button
              onClick={() => handleSort('lastActivity')}
              className="font-medium text-muted-foreground flex items-center hover:text-foreground transition-colors text-left"
            >
              Last Activity {getSortIcon('lastActivity')}
            </button>
            <div className="font-medium text-muted-foreground">Actions</div>
          </div>
          
          {/* Table Body */}
          <div className="divide-y">
            {paginatedUsers.map((user) => (
              <div key={user.id} className="grid gap-3 py-3 hover:bg-accent/50 px-2 items-center" style={{ gridTemplateColumns: '200px 70px 70px 150px 100px 100px 85px 85px 140px' }}>
                <div>
                  <div className="font-medium text-foreground">{user.email || user.username}</div>
                  <div className="text-sm text-muted-foreground">{user.full_name || user.username}</div>
                </div>
                <div>
                  {getRoleBadge(user.role, user.is_suspended ?? undefined)}
                </div>
                <div>
                  {getBillingType(user.subscription) === 'yearly' ? (
                    <Badge variant="default" className="text-xs bg-purple-100 text-purple-700">Yearly</Badge>
                  ) : getBillingType(user.subscription) === 'monthly' ? (
                    <Badge variant="outline" className="text-xs">Monthly</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </div>
                <div
                  className="text-xs font-mono truncate cursor-text select-all"
                  title={(user.subscription as any)?.fastspring_subscription_id || user.subscription?.stripe_subscription_id || 'No subscription ID'}
                >
                  {(user.subscription as any)?.fastspring_subscription_id || user.subscription?.stripe_subscription_id || '-'}
                </div>
                <div>
                  {getSubscriptionBadge(user.subscription)}
                </div>
                <div className="text-sm">
                  <div>{user.credits?.available_credits || 0} available</div>
                  <div className="text-muted-foreground">{user.totalCreditsUsed || 0} used</div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString()
                    : '-'
                  }
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
                    onClick={() => handleViewUsage(user)}
                    className="h-8 w-8"
                    title="View usage details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
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

          {sortedUsers.length === 0 && searchTerm && (
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(startIndex + USERS_PER_PAGE, sortedUsers.length)} of {sortedUsers.length} users
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Show pages around current page
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
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
          <UserUsageDialog
            user={{
              id: selectedUser.id,
              email: selectedUser.email,
              username: selectedUser.username,
              full_name: selectedUser.full_name
            }}
            open={isUsageDialogOpen}
            onOpenChange={setIsUsageDialogOpen}
          />
        </>
      )}
    </div>
  )
}