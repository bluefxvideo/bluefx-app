import { createAdminClient } from '@/app/supabase/server'
import { AdminUserTable } from './admin-user-table'
import { AdminUserCreateDialog } from './admin-user-create-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
// import { Badge } from '@/components/ui/badge'
import { 
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
  const supabase = createAdminClient()
  
  try {
    // Get all users with their profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100) // Increase limit for proper admin view

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


  return (
    <div className="space-y-8">
      {/* Action buttons */}
      <div className="flex justify-end items-center space-x-2">
        <AdminUserCreateDialog />
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
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