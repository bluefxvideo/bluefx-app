'use server'

import { createClient } from '@/app/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  SubscriptionUpgradeSchema,
  SubscriptionCancelSchema,
  createApiSuccess,
  createApiError,
  type ApiResponse,
} from "@/types/validation";
import { Tables } from '@/types/database'

// === Subscription Management Actions ===

export async function upgradeSubscription(formData: FormData): Promise<ApiResponse<{
  subscription: Tables<'user_subscriptions'>
  credits: Tables<'user_credits'>
}>> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return createApiError('User not authenticated')
    }

    // Parse form data
    const plan_type = formData.get('plan_type') as string
    const payment_method_id = formData.get('payment_method_id') as string

    // Validate form data
    const validation = SubscriptionUpgradeSchema.safeParse({
      plan_type,
      payment_method_id
    })
    
    if (!validation.success) {
      return createApiError(validation.error.issues.map(i => i.message).join(', '))
    }

    // Get current subscription
    const { data: currentSubscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (subError || !currentSubscription) {
      return createApiError('No active subscription found')
    }

    if (currentSubscription.plan_type === plan_type) {
      return createApiError('You are already on this plan')
    }

    // Calculate new credits based on plan
    const creditsForPlan = {
      trial: 100,
      pro: 1000,
      enterprise: 5000
    }[plan_type as 'trial' | 'pro' | 'enterprise'] || 100

    // Update subscription
    const { data: subscription, error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        plan_type: plan_type as 'trial' | 'pro' | 'enterprise',
        credits_per_month: creditsForPlan,
        max_concurrent_jobs: plan_type === 'trial' ? 1 : plan_type === 'pro' ? 3 : 10,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      return createApiError(updateError.message)
    }

    // Update credits allocation
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .update({
        total_credits: creditsForPlan,
        credits_per_month: creditsForPlan,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (creditsError) {
      return createApiError(creditsError.message)
    }

    revalidatePath('/', 'layout')
    
    return createApiSuccess(
      { subscription, credits },
      `Successfully upgraded to ${plan_type} plan!`
    )

  } catch (error) {
    console.error('Upgrade subscription error:', error)
    return createApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    )
  }
}

export async function cancelSubscription(formData: FormData): Promise<ApiResponse<Tables<'user_subscriptions'>>> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return createApiError('User not authenticated')
    }

    // Parse form data
    const cancel_at_period_end = formData.get('cancel_at_period_end') === 'true'
    const cancellation_reason = formData.get('cancellation_reason') as string

    // Validate form data
    const validation = SubscriptionCancelSchema.safeParse({
      cancel_at_period_end,
      cancellation_reason
    })
    
    if (!validation.success) {
      return createApiError(validation.error.issues.map(i => i.message).join(', '))
    }

    // Get current subscription
    const { data: currentSubscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (subError || !currentSubscription) {
      return createApiError('No active subscription found')
    }

    if (currentSubscription.status !== 'active') {
      return createApiError('Subscription is not active')
    }

    // Cancel subscription
    const { data: cancelledSubscription, error: cancelError } = await supabase
      .from('user_subscriptions')
      .update({
        status: cancel_at_period_end ? 'active' : 'cancelled',
        cancel_at_period_end: cancel_at_period_end,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (cancelError) {
      return createApiError(cancelError.message)
    }

    revalidatePath('/', 'layout')
    
    return createApiSuccess(
      cancelledSubscription,
      cancel_at_period_end 
        ? 'Subscription will be cancelled at the end of the current period'
        : 'Subscription cancelled successfully'
    )

  } catch (error) {
    console.error('Cancel subscription error:', error)
    return createApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    )
  }
}

export async function reactivateSubscription(): Promise<ApiResponse<Tables<'user_subscriptions'>>> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return createApiError('User not authenticated')
    }

    // Get current subscription
    const { data: currentSubscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (subError || !currentSubscription) {
      return createApiError('No subscription found')
    }

    if (currentSubscription.status !== 'cancelled' && !currentSubscription.cancel_at_period_end) {
      return createApiError('Subscription is not cancelled')
    }

    // Reactivate subscription
    const { data: reactivatedSubscription, error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        cancel_at_period_end: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      return createApiError(updateError.message)
    }

    revalidatePath('/', 'layout')
    
    return createApiSuccess(
      reactivatedSubscription,
      'Subscription reactivated successfully!'
    )

  } catch (error) {
    console.error('Reactivate subscription error:', error)
    return createApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    )
  }
}

// === Credit Management Actions ===

export async function addBonusCredits(
  userId: string,
  amount: number,
): Promise<ApiResponse<Tables<'user_credits'>>> {
  try {
    const supabase = await createClient()

    // Validate admin permissions (you might want to add proper admin checks)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return createApiError('User not authenticated')
    }

    if (amount <= 0) {
      return createApiError('Credit amount must be positive')
    }

    // Get current credits
    const { data: currentCredits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!currentCredits) {
      return createApiError('User credits not found')
    }

    // Update credits
    const { data: updatedCredits, error: updateError } = await supabase
      .from('user_credits')
      .update({
        bonus_credits: (currentCredits.bonus_credits || 0) + amount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      return createApiError(updateError.message)
    }

    revalidatePath('/', 'layout')
    
    return createApiSuccess(
      updatedCredits,
      `Added ${amount} bonus credits successfully!`
    )

  } catch (error) {
    console.error('Add bonus credits error:', error)
    return createApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    )
  }
}

// === Subscription Info Actions ===

export async function getSubscriptionInfo(): Promise<ApiResponse<{
  subscription: Tables<'user_subscriptions'> | null
  credits: Tables<'user_credits'> | null
}>> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return createApiError('User not authenticated')
    }

    // Get subscription and credits
    const [subscriptionResult, creditsResult] = await Promise.all([
      supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single()
    ])

    return createApiSuccess({
      subscription: subscriptionResult.data,
      credits: creditsResult.data
    })

  } catch (error) {
    console.error('Get subscription info error:', error)
    return createApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    )
  }
}