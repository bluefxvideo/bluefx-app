import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/app/supabase/server'
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

export async function GET(request: NextRequest) {
  try {
    // Use regular client to check if user is admin
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Now use admin client for fetching all users
    const adminClient = createAdminClient()
    
    // Get all users with their profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (profilesError || !profiles) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Get all auth users to have their emails
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers()
    
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
        const { data: subscriptions } = await adminClient
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', profile.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
        
        const subscription = subscriptions?.[0] || null

        // Get current credits (handle multiple credit records - take the most recent)
        const { data: creditRecords } = await adminClient
          .from('user_credits')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
        
        const credits = creditRecords?.[0] || null

        // Get total credits used from user_credits table
        const totalCreditsUsed = credits?.used_credits || 0

        // Get last activity from credit_transactions table
        const { data: lastActivityData } = await adminClient
          .from('credit_transactions')
          .select('created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        return {
          ...profile,
          email,
          subscription,
          credits,
          totalCreditsUsed,
          lastActivity: lastActivityData?.created_at || null
        }
      })
    )

    return NextResponse.json({ users: usersWithStats })
    
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}