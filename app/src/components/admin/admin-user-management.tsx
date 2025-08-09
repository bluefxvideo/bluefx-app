import { createClient } from '@/app/supabase/server'
import { AdminUserTable } from './admin-user-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
// import { Badge } from '@/components/ui/badge'
import { 
  Crown, 
  CreditCard, 
  UserPlus,
  Search,
  Filter,
  Download
} from 'lucide-react'
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

/**
 * Fetch users with their subscription and credit information
 */
async function getUsersWithStats(): Promise<UserWithStats[]> {
  const supabase = await createClient()
  
  try {
    // Get all users with their profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50) // Limit for MVP

    if (profilesError || !profiles) {
      console.error('Error fetching profiles:', profilesError)
      return []
    }

    // Get subscription and credit data for each user
    const usersWithStats: UserWithStats[] = await Promise.all(
      profiles.map(async (profile) => {
        // Get active subscription
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', profile.id)
          .eq('status', 'active')
          .single()

        // Get current credits
        const { data: credits } = await supabase
          .from('user_credits')
          .select('*')
          .eq('user_id', profile.id)
          .single()

        // Get total credits used
        const { data: creditUsage } = await supabase
          .from('credit_usage')
          .select('credits_used')
          .eq('user_id', profile.id)

        const totalCreditsUsed = creditUsage?.reduce((sum, usage) => sum + usage.credits_used, 0) || 0

        // Get last activity
        const { data: lastActivityData } = await supabase
          .from('credit_usage')
          .select('created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        return {
          ...profile,
          subscription,
          credits,
          totalCreditsUsed,
          lastActivity: lastActivityData?.created_at || null
        }
      })
    )

    return usersWithStats
  } catch (error) {
    console.error('Error fetching users with stats:', error)
    return []
  }
}

/**
 * AdminUserManagement - User management interface for admins
 * 
 * Follows the established design system patterns with card-based layout,
 * consistent spacing, and proper action buttons
 */
export async function AdminUserManagement() {
  const users = await getUsersWithStats()
  const adminUsers = users.filter(user => user.role === 'admin').length
  const totalCreditsAllocated = users.reduce((sum, user) => sum + (user.credits?.available_credits || 0), 0)

  const stats = [
    {
      title: 'Admin Users',
      value: adminUsers.toLocaleString(),
      description: 'System administrators',
      icon: Crown,
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Total Credits Allocated',
      value: totalCreditsAllocated.toLocaleString(),
      description: 'Credits currently allocated',
      icon: CreditCard,
      gradient: 'from-emerald-500 to-teal-500'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Action buttons */}
      <div className="flex justify-end items-center space-x-2">
        <Button className="bg-blue-500 hover:bg-blue-600 text-white">
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={index} className="rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </span>
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-sm`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </div>
            )
          })}
        </div>
        {/* User directory */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>User Directory</CardTitle>
              <CardDescription>
                View and manage all user accounts
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AdminUserTable users={users} />
        </CardContent>
      </Card>
    </div>
  )
}