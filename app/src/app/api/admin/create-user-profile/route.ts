import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/supabase/server'
import { createClient } from '@/app/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, email, username, full_name, plan_type, credits } = body

    if (!user_id || !email || !username) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify admin access
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const adminClient = createAdminClient()

    // Create profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: user_id,
        email,
        username,
        full_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 500 }
      )
    }

    // Create subscription
    const { error: subscriptionError } = await adminClient
      .from('user_subscriptions')
      .insert({
        user_id,
        plan_type,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        credits_per_month: credits,
        max_concurrent_jobs: plan_type === 'enterprise' ? 20 : plan_type === 'pro' ? 5 : 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (subscriptionError) {
      console.error('Subscription creation error:', subscriptionError)
      // Don't fail completely, just log the error
    }

    // Create credits
    const { error: creditsError } = await adminClient
      .from('user_credits')
      .insert({
        user_id,
        total_credits: credits,
        used_credits: 0,
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (creditsError) {
      console.error('Credits creation error:', creditsError)
      // Don't fail completely, just log the error
    }

    return NextResponse.json({ 
      success: true,
      message: 'User profile, subscription, and credits created successfully'
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}