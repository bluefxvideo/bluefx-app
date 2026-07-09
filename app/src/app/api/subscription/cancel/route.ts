import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/app/supabase/server'

interface CancellationFeedback {
  primaryReason: string
  secondaryReasons: string[]
  feedbackText: string
  wouldRecommendScore: number | null
}

interface CancelRequest {
  subscriptionId: string
  feedback: CancellationFeedback
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subscriptionId, feedback }: CancelRequest = await request.json()

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 })
    }

    // Save feedback to database
    const { error: feedbackError } = await supabase
      .from('cancellation_feedback')
      .insert({
        user_id: user.id,
        subscription_id: subscriptionId,
        primary_reason: feedback.primaryReason,
        secondary_reasons: feedback.secondaryReasons,
        feedback_text: feedback.feedbackText,
        created_at: new Date().toISOString()
      })

    if (feedbackError) {
      console.error('Failed to save feedback:', feedbackError)
      // Continue with cancellation even if feedback fails
    }

    // Trial cancellations terminate immediately: the $1 trial fee is fully
    // consumed by FastSpring's minimum transaction fee, so a cancelling trial
    // user is pure AI-cost with zero revenue — no reason to leave the tools
    // open until period end (owner policy, 2026-07). Paid subscribers keep
    // access until the end of the period they paid for.
    const { data: subRow } = await supabase
      .from('user_subscriptions')
      .select('status')
      .eq('fastspring_subscription_id', subscriptionId)
      .eq('user_id', user.id)
      .single()
    const isTrial = subRow?.status === 'trial'

    // Cancel subscription via FastSpring API (immediately for trials)
    const fastSpringResult = await cancelFastSpringSubscription(subscriptionId, isTrial)

    if (!fastSpringResult.success) {
      return NextResponse.json({
        error: 'Failed to cancel subscription',
        details: fastSpringResult.error
      }, { status: 500 })
    }

    // NOTE: cancellation must never delete the account or user data (it used
    // to) — access control is enough, and deletion stays a separate flow.
    const admin = createAdminClient()
    if (isTrial) {
      // Immediate: mark cancelled now and zero out the remaining trial credits
      const { error: updateError } = await admin
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('fastspring_subscription_id', subscriptionId)
        .eq('user_id', user.id)
      if (updateError) console.error('Failed to update subscription status:', updateError)

      const { error: creditsError } = await admin
        .from('user_credits')
        .update({ available_credits: 0, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
      if (creditsError) console.error('Failed to zero trial credits:', creditsError)

      return NextResponse.json({
        success: true,
        message: 'Your trial has been cancelled. No charges will be made to your card.'
      })
    }

    // Paid plan: cancel at period end — the user keeps access until the end
    // of the period they paid for; status flips to 'cancelled' when the
    // FastSpring deactivation webhook arrives.
    const { error: updateError } = await admin
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('fastspring_subscription_id', subscriptionId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to update subscription status:', updateError)
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled. You keep access until the end of your current period, and no further charges will be made.'
    })

  } catch (error) {
    console.error('Cancellation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

async function cancelFastSpringSubscription(subscriptionId: string, immediate = false) {
  const fastSpringApiKey = process.env.FASTSPRING_API_KEY
  const fastSpringUsername = process.env.FASTSPRING_USERNAME

  if (!fastSpringApiKey || !fastSpringUsername) {
    console.error('FastSpring credentials not configured')
    return { success: false, error: 'FastSpring credentials not configured' }
  }

  try {
    const auth = Buffer.from(`${fastSpringUsername}:${fastSpringApiKey}`).toString('base64')
    
    // billingPeriod=0 deactivates immediately (trials); default cancels at period end
    const response = await fetch(`https://api.fastspring.com/subscriptions/${subscriptionId}${immediate ? '?billingPeriod=0' : ''}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      return { success: true }
    } else {
      const errorText = await response.text()
      console.error('FastSpring cancellation failed:', response.status, errorText)
      return { 
        success: false, 
        error: `FastSpring API error: ${response.status} ${errorText}` 
      }
    }

  } catch (error) {
    console.error('FastSpring API request failed:', error)
    return { 
      success: false, 
      error: 'Failed to communicate with FastSpring API' 
    }
  }
}