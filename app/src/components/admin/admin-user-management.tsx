import { createAdminClient } from '@/app/supabase/server'
import { AdminUserTable } from './admin-user-table'
import { AdminUserCreateDialog } from './admin-user-create-dialog'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
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

    // First, get all auth users to have their emails
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers()
    
    // Create a map of user IDs to emails for quick lookup
    const emailMap = new Map<string, string>()
    authUsers?.forEach(user => {
      emailMap.set(user.id, user.email || '')
    })

    // Get subscription and credit data for each user
    const usersWithStats: UserWithStats[] = await Promise.all(
      profiles.map(async (profile) => {
        // Get email from auth users
        const email = emailMap.get(profile.id) || profile.email || ''
        
        // Get active subscription (handle multiple subscriptions - take the most recent)
        const { data: subscriptions } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', profile.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
        
        const subscription = subscriptions?.[0] || null

        // Get current credits (handle multiple credit records - take the most recent)
        const { data: creditRecords } = await supabase
          .from('user_credits')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
        
        const credits = creditRecords?.[0] || null

        // Get total credits used from user_credits table (already tracked correctly)
        const totalCreditsUsed = credits?.used_credits || 0

        // Get last activity from credit_transactions table
        const { data: lastActivityData } = await supabase
          .from('credit_transactions')
          .select('created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        return {
          ...profile,
          email,  // Add email from auth users
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
    <>
      {/* Action buttons */}
      <div className="flex justify-end items-center space-x-2 mb-6">
        <AdminUserCreateDialog />
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* User table component already has its own layout */}
      <AdminUserTable users={users} />
    </>
  )
}