import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/supabase/server'
import { createClient } from '@/app/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, email, username, full_name, plan_type, payment_type, credits } = body

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

    // Use a transaction to ensure all records are created atomically
    const currentTime = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    
    // Track what was created for potential cleanup
    let profileCreated = false
    let subscriptionCreated = false
    let creditsCreated = false
    
    try {
      // Create profile
      const { error: profileError } = await adminClient
        .from('profiles')
        .insert({
          id: user_id,
          email,
          username,
          full_name,
          created_at: currentTime,
          updated_at: currentTime
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        return NextResponse.json(
          { error: `Failed to create profile: ${profileError.message}` },
          { status: 500 }
        )
      }
      profileCreated = true
      console.log(`✅ Created profile for user ${email}`)

      // Create subscription based on payment type
      const getSubscriptionId = () => {
        switch (payment_type) {
          case 'fastspring':
            return `manual_fs_${user_id}_${Date.now()}`
          case 'clickbank':
            return `manual_cb_${user_id}_${Date.now()}`
          case 'manual':
          default:
            return `manual_${user_id}_${Date.now()}`
        }
      }

      const subscriptionData = {
        user_id,
        plan_type: 'pro', // Always pro as requested
        status: 'active',
        current_period_start: currentTime,
        current_period_end: periodEnd,
        credits_per_month: credits,
        max_concurrent_jobs: 5, // Pro plan gets 5 concurrent jobs
        created_at: currentTime,
        updated_at: currentTime,
        fastspring_subscription_id: getSubscriptionId()
      }

      const { error: subscriptionError } = await adminClient
        .from('user_subscriptions')
        .insert(subscriptionData)

      if (subscriptionError) {
        console.error('Subscription creation error:', subscriptionError)
        // Rollback profile if subscription fails
        if (profileCreated) {
          await adminClient.from('profiles').delete().eq('id', user_id)
        }
        return NextResponse.json(
          { error: `Failed to create subscription: ${subscriptionError.message}` },
          { status: 500 }
        )
      }
      subscriptionCreated = true
      console.log(`✅ Created ${payment_type} subscription for user ${email}`)

      // Create credits (note: available_credits is a generated column, don't include it)
      const { error: creditsError } = await adminClient
        .from('user_credits')
        .insert({
          user_id,
          total_credits: credits,
          used_credits: 0,
          period_start: currentTime,
          period_end: periodEnd,
          created_at: currentTime,
          updated_at: currentTime
        })

      if (creditsError) {
        console.error('Credits creation error:', creditsError)
        // Rollback profile and subscription if credits fail
        if (subscriptionCreated) {
          await adminClient.from('user_subscriptions').delete().eq('user_id', user_id)
        }
        if (profileCreated) {
          await adminClient.from('profiles').delete().eq('id', user_id)
        }
        return NextResponse.json(
          { error: `Failed to create credits: ${creditsError.message}` },
          { status: 500 }
        )
      }
      creditsCreated = true
      console.log(`✅ Created ${credits} credits for user ${email}`)

      // All successful - verify the records were created
      const { data: verifyProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', user_id)
        .single()
      
      const { data: verifyCredits } = await adminClient
        .from('user_credits')
        .select('user_id, total_credits')
        .eq('user_id', user_id)
        .single()
      
      if (!verifyProfile || !verifyCredits) {
        console.error('Verification failed - records may not have been created properly')
        return NextResponse.json(
          { error: 'Records created but verification failed. Please check the database.' },
          { status: 500 }
        )
      }

      console.log(`✅ Successfully created all records for user ${email}`)
      return NextResponse.json({ 
        success: true,
        message: 'User profile, subscription, and credits created successfully',
        data: {
          user_id,
          email,
          username,
          credits: verifyCredits.total_credits,
          plan_type: 'pro'
        }
      })

    } catch (unexpectedError) {
      console.error('Unexpected error during user profile creation:', unexpectedError)
      
      // Attempt cleanup of any partially created records
      try {
        if (creditsCreated) {
          await adminClient.from('user_credits').delete().eq('user_id', user_id)
        }
        if (subscriptionCreated) {
          await adminClient.from('user_subscriptions').delete().eq('user_id', user_id)
        }
        if (profileCreated) {
          await adminClient.from('profiles').delete().eq('id', user_id)
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
      
      return NextResponse.json(
        { error: 'Failed to create user profile due to unexpected error' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}