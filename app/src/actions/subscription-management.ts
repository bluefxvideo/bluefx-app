'use server'

import { createClient } from '@/app/supabase/server'

export async function upgradeTrialToPro(userId: string) {
  const supabase = await createClient()
  
  try {
    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (subError || !subscription) {
      return { success: false, error: 'No active subscription found' }
    }

    if (subscription.plan_type !== 'trial') {
      return { success: false, error: 'Only trial plans can be upgraded' }
    }

    // Update to pro plan
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        plan_type: 'pro',
        credits_per_month: 600,
        max_concurrent_jobs: 3,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Update credits allocation
    const { error: creditsError } = await supabase
      .from('user_credits')
      .update({
        total_credits: 600,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (creditsError) {
      return { success: false, error: creditsError.message }
    }

    return { success: true, message: 'Successfully upgraded to Pro plan' }
  } catch (error) {
    console.error('Upgrade failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Upgrade failed' }
  }
}

export async function cancelSubscription(userId: string) {
  const supabase = await createClient()
  
  try {
    // Update subscription to cancel at period end
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'active')

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, message: 'Subscription will be cancelled at the end of the current period' }
  } catch (error) {
    console.error('Cancellation failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Cancellation failed' }
  }
}

export async function getSubscriptionStatus(userId: string) {
  const supabase = await createClient()
  
  try {
    const [subscriptionResult, creditsResult] = await Promise.all([
      supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single(),
      supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .single()
    ])

    return {
      success: true,
      data: {
        subscription: subscriptionResult.data,
        credits: creditsResult.data
      }
    }
  } catch (error) {
    console.error('Failed to get subscription status:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get subscription status' }
  }
}

export async function purchaseCredits(userId: string, creditAmount: number) {
  const supabase = await createClient()
  
  try {
    // Get current credits
    const { data: currentCredits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!currentCredits) {
      return { success: false, error: 'User credits not found' }
    }

    // Update credits
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        total_credits: currentCredits.total_credits + creditAmount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Log the purchase
    const { error: logError } = await supabase
      .from('addon_purchases')
      .insert({
        user_id: userId,
        addon_type: 'extra_credits',
        payment_status: 'completed',
        price_paid: creditAmount * 0.01
      })

    if (logError) {
      console.error('Failed to log purchase:', logError)
    }

    return { success: true, message: `Successfully purchased ${creditAmount} credits` }
  } catch (error) {
    console.error('Credit purchase failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Credit purchase failed' }
  }
}