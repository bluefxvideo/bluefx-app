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

export async function GET(_request: NextRequest) {
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

    // Check admin by role OR by email (for contact@bluefx.net)
    const isAdmin = profile?.role === 'admin' || user.email === 'contact@bluefx.net'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Now use admin client for fetching all users
    const adminClient = createAdminClient()

    // Get ALL profiles (no limit) - fetch in batches if needed
    let allProfiles: Tables<'profiles'>[] = []
    let from = 0
    const batchSize = 1000

    while (true) {
      const { data: batch, error: batchError } = await adminClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + batchSize - 1)

      if (batchError) {
        console.error('Error fetching profiles batch:', batchError)
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
      }

      if (!batch || batch.length === 0) break

      allProfiles = [...allProfiles, ...batch]
      if (batch.length < batchSize) break
      from += batchSize
    }

    const profiles = allProfiles

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ users: [] })
    }

    // Get ALL auth users with pagination
    let allAuthUsers: any[] = []
    let page = 1
    const perPage = 100

    while (true) {
      const { data: { users: pageUsers } } = await adminClient.auth.admin.listUsers({
        page,
        perPage
      })

      if (!pageUsers || pageUsers.length === 0) break

      allAuthUsers = [...allAuthUsers, ...pageUsers]
      if (pageUsers.length < perPage) break
      page++
    }

    const authUsers = allAuthUsers
    
    // Create a map of user IDs to emails for quick lookup
    const emailMap = new Map<string, string>()
    authUsers?.forEach(user => {
      emailMap.set(user.id, user.email || '')
    })

    // Get subscription and credit data for each user
    const usersWithStats: UserWithStats[] = await Promise.all(
      profiles.map(async (profile) => {
        // Get email from auth users (profiles table doesn't have email field)
        const email = emailMap.get(profile.id) || ''
        
        // Get subscription (any status - take the most recent)
        const { data: subscriptions } = await adminClient
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', profile.id)
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