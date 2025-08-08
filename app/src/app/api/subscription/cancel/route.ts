import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/supabase/server'
import { deleteUserAccount } from '@/app/actions/account-deletion'

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

    // Cancel subscription via FastSpring API
    const fastSpringResult = await cancelFastSpringSubscription(subscriptionId)

    if (!fastSpringResult.success) {
      return NextResponse.json({ 
        error: 'Failed to cancel subscription', 
        details: fastSpringResult.error 
      }, { status: 500 })
    }

    // Update subscription status in database
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('fastspring_subscription_id', subscriptionId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to update subscription status:', updateError)
    }

    // Delete user account and all data immediately
    console.log('Starting complete account deletion for user:', user.id)
    const deletionResult = await deleteUserAccount(user.id)

    if (!deletionResult.success) {
      console.error('Failed to delete user data:', deletionResult.error)
      // Continue anyway - subscription is already cancelled
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Subscription cancelled and account deleted successfully' 
    })

  } catch (error) {
    console.error('Cancellation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

async function cancelFastSpringSubscription(subscriptionId: string) {
  const fastSpringApiKey = process.env.FASTSPRING_API_KEY
  const fastSpringUsername = process.env.FASTSPRING_USERNAME

  if (!fastSpringApiKey || !fastSpringUsername) {
    console.error('FastSpring credentials not configured')
    return { success: false, error: 'FastSpring credentials not configured' }
  }

  try {
    const auth = Buffer.from(`${fastSpringUsername}:${fastSpringApiKey}`).toString('base64')
    
    const response = await fetch(`https://api.fastspring.com/subscriptions/${subscriptionId}`, {
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