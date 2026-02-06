import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const results: any = {
    email,
    timestamp: new Date().toISOString(),
    checks: {}
  }

  try {
    // Check auth users
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const user = authUsers.users.find(u => u.email === email)

    if (!user) {
      results.checks.authUser = { found: false }

      // Check recent webhook events
      const { data: webhookEvents } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('processor', 'clickbank')
        .order('created_at', { ascending: false })
        .limit(10)

      results.recentWebhooks = webhookEvents?.map(event => ({
        type: event.event_type,
        email: event.payload?.customer?.email || event.payload?.customer_email,
        eventId: event.event_id,
        createdAt: event.created_at
      }))

      return NextResponse.json(results)
    }

    results.checks.authUser = {
      found: true,
      id: user.id,
      email: user.email,
      emailConfirmed: !!user.email_confirmed_at,
      createdAt: user.created_at,
      metadata: user.user_metadata
    }

    // Check profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    results.checks.profile = profile ? {
      found: true,
      username: profile.username,
      fullName: profile.full_name,
      email: profile.email
    } : { found: false }

    // Check subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    results.checks.subscription = subscription ? {
      found: true,
      planType: subscription.plan_type,
      status: subscription.status,
      periodStart: subscription.current_period_start,
      periodEnd: subscription.current_period_end,
      creditsPerMonth: subscription.credits_per_month,
      maxConcurrentJobs: subscription.max_concurrent_jobs
    } : { found: false }

    // Check credits
    const { data: credits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    results.checks.credits = credits ? {
      found: true,
      total: credits.total_credits,
      used: credits.used_credits,
      bonus: credits.bonus_credits || 0,
      available: credits.available_credits ?? (credits.total_credits - credits.used_credits + (credits.bonus_credits || 0)),
      periodStart: credits.period_start,
      periodEnd: credits.period_end
    } : { found: false }

    // Check webhook events for this user
    const { data: webhookEvents } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('processor', 'clickbank')
      .order('created_at', { ascending: false })
      .limit(50)

    const userWebhooks = webhookEvents?.filter(event => {
      const payload = event.payload
      const customerEmail = payload?.customer?.email || payload?.customer_email
      return customerEmail === email
    })

    results.webhookEvents = userWebhooks?.map(event => ({
      type: event.event_type,
      eventId: event.event_id,
      createdAt: event.created_at,
      payload: event.payload
    })) || []

    return NextResponse.json(results, { status: 200 })

  } catch (error) {
    console.error('Error checking user:', error)
    return NextResponse.json({
      error: 'Failed to check user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
