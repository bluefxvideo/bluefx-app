import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/app/supabase/server'

/**
 * Debug endpoint to check why a user might be missing from admin panel
 * GET /api/admin/debug-user?email=contact@bluefx.net
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if requester is admin
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single()

    const isAdmin = adminProfile?.role === 'admin' || currentUser.email === 'contact@bluefx.net'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const email = request.nextUrl.searchParams.get('email') || currentUser.email
    const adminClient = createAdminClient()

    // Step 1: Check auth.users (listUsers has pagination, default is 50)
    // First try to find by current user ID directly
    let authUser = null
    let allAuthUsers: any[] = []

    // Get all users with pagination
    let page = 1
    const perPage = 100
    let hasMore = true

    while (hasMore) {
      const { data: { users: pageUsers } } = await adminClient.auth.admin.listUsers({
        page,
        perPage
      })

      if (pageUsers && pageUsers.length > 0) {
        allAuthUsers = [...allAuthUsers, ...pageUsers]
        hasMore = pageUsers.length === perPage
        page++
      } else {
        hasMore = false
      }
    }

    // Search case-insensitively
    authUser = allAuthUsers.find(u => u.email?.toLowerCase() === email.toLowerCase())

    // Step 2: Check profiles table by email
    const { data: profileByEmail } = await adminClient
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()

    // Step 3: If auth user exists, check profiles by ID
    let profileById = null
    if (authUser) {
      const { data } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      profileById = data
    }

    // Step 4: Check user_credits
    let credits = null
    if (authUser) {
      const { data } = await adminClient
        .from('user_credits')
        .select('*')
        .eq('user_id', authUser.id)
        .single()
      credits = data
    }

    // Step 5: Count total profiles
    const { count: totalProfiles } = await adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    const totalAuthUsers = allAuthUsers.length

    return NextResponse.json({
      current_user: {
        id: currentUser.id,
        email: currentUser.email,
        is_admin_by_role: adminProfile?.role === 'admin',
        is_admin_by_email: currentUser.email === 'contact@bluefx.net',
      },
      searched_email: email,
      diagnosis: {
        auth_user_exists: !!authUser,
        auth_user_id: authUser?.id || null,
        profile_by_email_exists: !!profileByEmail,
        profile_by_id_exists: !!profileById,
        profile_id_matches_auth_id: profileByEmail?.id === authUser?.id,
        has_credits_record: !!credits,
      },
      details: {
        auth_user: authUser ? {
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at,
        } : null,
        profile_by_email: profileByEmail,
        profile_by_id: profileById,
        credits: credits,
      },
      counts: {
        total_auth_users: totalAuthUsers,
        total_profiles: totalProfiles,
      },
      recommendation: !authUser
        ? 'User does not exist in auth.users'
        : !profileById
          ? 'ISSUE FOUND: User exists in auth but has no profile. Need to create profile with matching ID.'
          : profileByEmail?.id !== authUser?.id
            ? 'ISSUE FOUND: Profile email exists but ID does not match auth user ID'
            : 'User setup looks correct'
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
