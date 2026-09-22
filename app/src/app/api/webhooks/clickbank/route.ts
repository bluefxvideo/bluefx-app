import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/supabase/server'
import { findAuthUserByEmail } from '@/lib/auth-user-lookup'

// Credit allocation constants - match FastSpring trial handling
const TRIAL_CREDITS = 100;  // Trial users get limited credits (~$3-5 cost if fully used)
const FULL_CREDITS = 600;   // Full allocation for paid subscribers
const TRIAL_AMOUNT_THRESHOLD = 1.50; // $1.00 trial with some buffer for fees

export async function POST(request: NextRequest) {
  let payload: Record<string, unknown>
  
  try {
    // Try to parse as JSON first
    const contentType = request.headers.get('content-type')
    
    if (contentType?.includes('application/json')) {
      payload = await request.json()
    } else {
      // Handle form data from Zapier
      const formData = await request.formData()
      payload = {}
      
      // Convert FormData to object
      for (const [key, value] of formData.entries()) {
        payload[key] = value.toString()
      }
    }
  } catch (error) {
    console.error('Failed to parse webhook payload:', error)
    return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 })
  }
  
  // For Zapier webhooks, we can optionally verify with a simple secret
  const zapierSecret = request.headers.get('x-zapier-secret')
  if (process.env.ZAPIER_WEBHOOK_SECRET && zapierSecret !== process.env.ZAPIER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
  }

  // Handle both direct ClickBank format and Zapier-formatted data
  const transactionType = (payload.transaction_type || payload.transactionType) as string
  
  // Extract customer information - ClickBank might not always provide customer details in test mode
  const customer: { email?: string; firstName?: string; lastName?: string } = (payload.customer as { email?: string; firstName?: string; lastName?: string }) || {
    email: (payload.customer_email || payload.email || payload.customerEmail) as string,
    firstName: (payload.customer_first_name || payload.first_name || payload.firstName) as string,
    lastName: (payload.customer_last_name || payload.last_name || payload.lastName) as string
  }
  
  // If no direct customer email, try to generate a test email for TEST transactions
  if (!customer.email && transactionType?.includes('TEST')) {
    const receipt = (payload.receipt || payload.order_id || payload.transaction_id) as string
    customer.email = `test-${receipt.toLowerCase()}@clickbank-test.com`
    customer.firstName = 'Test'
    customer.lastName = 'Customer'
  }
  
  const lineItems = (payload.line_items || payload.lineItems || [{ 
    amount: payload.amount || payload.total || payload.totalOrderAmount || '1.00'
  }]) as { amount?: string }[]
  const receipt = (payload.receipt || payload.order_id || payload.transaction_id) as string
  
  // Filter by product ID - accept monthly (53, 61), yearly (68), and lifetime (55) products
  const monthlyProductId = process.env.CLICKBANK_PRODUCT_ID || '53'
  const monthlyProductId2 = '61'
  const yearlyProductId = '68'
  const lifetimeProductId = '55'
  // bluefx02 AI Media Machine lifetime cart: item 1 = $297 one-pay, item 2 = 3x$100.
  // These item numbers ALSO existed as old bundle products on other accounts, so
  // they only count when the zap identifies the selling account as bluefx02
  // (the bluefx02 zap must send vendor=bluefx02 in its payload).
  const bluefx02LifetimeItems = ['1', '2']
  const vendor = ((payload.vendor || payload.account || '') as string).toLowerCase()
  const isBluefx02 = vendor === 'bluefx02'
  // Who drove the sale: ClickBank sends the affiliate nickname, empty when the
  // vendor sold it directly. Kept on the event so sales can be attributed later.
  const affiliate = ((payload.affiliate || payload.affiliate_id || '') as string).trim()
  const targetProductIds = [monthlyProductId, monthlyProductId2, yearlyProductId, lifetimeProductId,
                            ...(isBluefx02 ? bluefx02LifetimeItems : [])]

  // Parse lineItemData to check product numbers and detect lifetime/yearly
  let hasTargetProduct = false
  let isLifetimeProduct = false
  let isYearlyProduct = false

  // Zapier's ClickBank trigger flattens lineItemData into discrete fields, so the
  // item number can arrive as a plain value (itemNo / item_no) rather than the raw
  // ClickBank JSON string. Accept both shapes.
  const flatItemNo = String(payload.itemNo || payload.item_no || payload.lineItemDataItemNo || '').trim()
  if (flatItemNo) {
    hasTargetProduct = targetProductIds.includes(flatItemNo)
    isLifetimeProduct = flatItemNo === lifetimeProductId ||
      (isBluefx02 && bluefx02LifetimeItems.includes(flatItemNo))
    isYearlyProduct = flatItemNo === yearlyProductId
  }

  if (payload.lineItemData) {
    try {
      const lineItemData = JSON.parse((payload.lineItemData as string).replace(/'/g, '"'))
      hasTargetProduct = lineItemData.some((item: { itemNo?: string }) => targetProductIds.includes(item.itemNo || ''))
      isLifetimeProduct = lineItemData.some((item: { itemNo?: string }) =>
        item.itemNo === lifetimeProductId || (isBluefx02 && bluefx02LifetimeItems.includes(item.itemNo || '')))
      isYearlyProduct = lineItemData.some((item: { itemNo?: string }) => item.itemNo === yearlyProductId)
    } catch {
      // Fallback: check if product ID appears anywhere in the raw string
      hasTargetProduct = targetProductIds.some(id =>
        (payload.lineItemData as string).includes(`'itemNo': '${id}'`)
      )
      isLifetimeProduct = (payload.lineItemData as string).includes(`'itemNo': '${lifetimeProductId}'`) ||
        (isBluefx02 && bluefx02LifetimeItems.some(id => (payload.lineItemData as string).includes(`'itemNo': '${id}'`)))
      isYearlyProduct = (payload.lineItemData as string).includes(`'itemNo': '${yearlyProductId}'`)
    }
  }
  
  // If this webhook is not for our target products, acknowledge but don't process
  if (!hasTargetProduct) {
    console.log(`ClickBank webhook for different product (not ${targetProductIds.join(' or ')}), skipping processing`)
    return NextResponse.json({ message: 'Product not targeted for processing' }, { status: 200 })
  }
  
  // Log the incoming data for debugging
  console.log('Webhook payload received:', {
    transactionType,
    customer,
    receipt,
    targetProductIds,
    isLifetimeProduct,
    isYearlyProduct,
    rawPayload: payload
  })

  try {
    switch (transactionType) {
      case 'SALE':
      case 'TEST_SALE':  // Handle test transactions
        await handleClickBankSale(customer, lineItems, receipt, isLifetimeProduct, isYearlyProduct,
                                  { affiliate, vendor, itemNo: flatItemNo })
        break
      case 'REFUND':
      case 'TEST_REFUND':
        await handleClickBankRefund(customer)
        break
      case 'CANCEL-REBILL':
      case 'TEST_CANCEL-REBILL':
        await handleClickBankCancelRebill(customer, receipt)
        break
      case 'BILL':
      case 'TEST_BILL':  // Handle recurring billing
        await handleClickBankRenewal(customer, lineItems, receipt, isYearlyProduct)
        break
      default:
        console.log('Unhandled ClickBank transaction:', transactionType)
        // Don't throw error for unknown transaction types, just log them
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ClickBank webhook processing error:', error)

    // The event row is written before provisioning runs, so leaving it behind
    // after a failure would make the duplicate guard skip every retry and the
    // buyer would never be provisioned. Drop it so a retry can do the work.
    // Scoped to the event_type this transaction writes: a CANCEL-REBILL failure
    // must not delete the original SALE's row, which shares its receipt.
    const failedEventType = transactionType?.includes('SALE') ? 'SALE'
      : transactionType?.includes('BILL') && !transactionType?.includes('CANCEL') ? 'BILL'
      : null
    if (failedEventType) {
      try {
        const supabase = createAdminClient()
        await supabase
          .from('webhook_events')
          .delete()
          .eq('event_id', receipt)
          .eq('event_type', failedEventType)
          .eq('processor', 'clickbank')
      } catch (cleanupError) {
        console.error('Failed to clear ClickBank event for retry:', cleanupError)
      }
    }

    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

/**
 * A lifetime owner (paid-in-full via FastSpring) must never be downgraded,
 * cancelled or deleted by events from an OLD ClickBank subscription tied to
 * the same email. Returns true when the user's current plan is lifetime.
 */
async function isLifetimeOwner(supabase: ReturnType<typeof createAdminClient>, userId: string): Promise<boolean> {
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('plan_type')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return sub?.plan_type === 'lifetime'
}

async function handleClickBankSale(customer: { email?: string; firstName?: string; lastName?: string }, lineItems: { amount?: string }[], receipt: string, isLifetimeProduct: boolean = false, isYearlyProduct: boolean = false, meta: { affiliate?: string; vendor?: string; itemNo?: string } = {}) {
  const supabase = createAdminClient()
  
  // Extract customer information
  const { email, firstName, lastName } = customer
  
  if (!email) {
    console.error('Customer email is required for ClickBank sale')
    throw new Error('Customer email is required')
  }
  
  // Check for duplicate processing
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', receipt)
    .eq('processor', 'clickbank')
    .single()

  if (existingEvent) {
    console.log('Duplicate ClickBank event, skipping:', receipt)
    return
  }

  // Log webhook event
  await supabase
    .from('webhook_events')
    .insert({
      event_id: receipt,
      event_type: 'SALE',
      processor: 'clickbank',
      payload: { customer, lineItems, receipt, ...meta }
    })

  // Calculate total amount and determine plan type based on product ID
  const totalAmount = lineItems.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0)
  const isLifetime = isLifetimeProduct // Product 55, or items 1/2 on bluefx02
  const isYearly = isYearlyProduct // Use product ID detection (product 68)
  // Lifetime buyers MUST get plan_type 'lifetime': isLifetimeOwner() and the
  // reconcile cron's .neq('plan_type','lifetime') exclusion both key on it —
  // a lifetime row marked 'pro' would be cancellable by a stale CB receipt.
  const planType = isLifetime ? 'lifetime' : 'pro'

  // Detect $1 trial - give 100 credits like FastSpring trials
  // Yearly and lifetime always get full credits (customer committed)
  const isTrial = totalAmount <= TRIAL_AMOUNT_THRESHOLD && !isYearly && !isLifetime
  const creditsAllocation = isTrial ? TRIAL_CREDITS : FULL_CREDITS

  const subscriptionType = isLifetime ? 'LIFETIME' : (isYearly ? 'YEARLY' : (isTrial ? 'TRIAL' : 'MONTHLY'))
  const productInfo = isLifetime ? '55 (Lifetime)' : (isYearly ? '68 (Yearly)' : '53 or 61 (Monthly)')
  console.log(`ClickBank sale: ${email} -> ${planType} (${creditsAllocation} credits) - ${subscriptionType} - Amount: $${totalAmount} - Product: ${productInfo}`)

  // Check for existing user to decide upgrade vs new user
  const existingUser = await findAuthUserByEmail(supabase, email)
  let userId: string

  if (existingUser) {
    userId = existingUser.id
    console.log(`Found existing ClickBank user: ${userId}`)
    
    // Check if profile exists, create if missing
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (!profileData) {
      console.log(`Creating missing profile for existing user ${userId}`)
      const cleanUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      await supabase.from('profiles').insert({
        id: userId,
        email: email,
        username: cleanUsername,
        full_name: `${firstName} ${lastName}`.trim(),
        bio: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }

    // One subscription row per user (unique on user_id), whatever its status. A
    // returning customer whose row is cancelled or expired is reactivated on that
    // row. Inserting a second row fails, and that failure deleted the sale's own
    // event record and answered Zapier with a 500, so the purchase left no trace:
    // that is how a $297 lifetime purchase of 2026-09-20 was lost.
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('id, plan_type, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSubscription) {
      if (existingSubscription.plan_type === 'lifetime' && !isLifetime) {
        // A lifetime owner is never moved to a lesser plan by a later purchase
        console.log(`♾️ ${email} already owns lifetime; ${subscriptionType} sale leaves the plan as is`)
        return
      }
      const reactivating = !['active', 'trial'].includes(existingSubscription.status)
      const periodStart = new Date()
      const periodDays = isLifetime ? 50 * 365 : (isYearly ? 365 : 30)
      const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000)
      console.log(`${reactivating ? 'Reactivating' : 'Upgrading'} ${existingSubscription.status} ${existingSubscription.plan_type} subscription to ${subscriptionType} for user ${userId}`)

      const { error: subscriptionUpdateError } = await supabase
        .from('user_subscriptions')
        .update({
          plan_type: planType,
          status: isTrial ? 'trial' : 'active',
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          credits_per_month: FULL_CREDITS,  // Always 600 for future renewals (like FastSpring)
          max_concurrent_jobs: 5, // Pro plan gets 5 jobs
          cancel_at_period_end: false,
          // ClickBank is the billing anchor from here on. A lifetime row carries no
          // FastSpring id (nothing may ever cancel a paid-in-full plan), and a
          // reactivated row drops its old one: the reconcile cron would otherwise
          // read the dead FastSpring subscription and cancel the row again.
          ...(isLifetime || reactivating ? { fastspring_subscription_id: null } : {}),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id)

      if (subscriptionUpdateError) {
        console.error('ClickBank subscription update error:', subscriptionUpdateError)
        throw new Error(`Failed to update subscription: ${subscriptionUpdateError.message}`)
      }

      await grantCredits(supabase, userId, creditsAllocation)

      console.log(`✅ ${email} now on ${subscriptionType} via ClickBank - valid until ${periodEnd.toISOString().split('T')[0]}`)
      return // Exit early - the existing row carries the new plan
    }
  } else {
    // Create new user account using admin client
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName,
        payment_processor: 'clickbank',
        receipt: receipt,
        plan_type: planType,
        email_verified: true,
        phone_verified: false
      },
      app_metadata: {
        provider: 'email',
        providers: ['email']
      }
    })

    if (authError) {
      console.error('Failed to create ClickBank user:', authError)
      throw new Error('User creation failed')
    }

    userId = authUser.user.id
    console.log(`Created new ClickBank user: ${userId}`)

    // Create profile with a clean username (remove hyphens/special chars)
    const cleanUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    await supabase.from('profiles').insert({
      id: userId,
      email: email,
      username: cleanUsername,
      full_name: `${firstName} ${lastName}`.trim(),
      bio: null,
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    // Send password reset email via Supabase (uses Brevo SMTP)
    // redirectTo must point to auth-callback which verifies the token and redirects to setup-password
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth-callback`
    })
    if (resetError) {
      console.error('Failed to send password reset email:', resetError)
    } else {
      console.log(`Password reset email sent to ${email}`)
    }
  }

  // Create subscription (following admin pattern) - set correct period based on plan type
  const currentPeriodStart = new Date()
  const periodDays = isLifetime ? 50 * 365 : (isYearly ? 365 : 30) // 50 years for lifetime, 365 days for yearly, 30 days for monthly
  const currentPeriodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000)

  const subscriptionData = {
    user_id: userId,
    plan_type: planType,
    status: isTrial ? 'trial' : 'active',  // Mark as trial status for $1 trials
    current_period_start: currentPeriodStart.toISOString(),
    current_period_end: currentPeriodEnd.toISOString(),
    credits_per_month: FULL_CREDITS,  // Always 600 for future renewals (like FastSpring)
    max_concurrent_jobs: 5, // Pro plan gets 5 jobs like admin
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .insert(subscriptionData)

  if (subscriptionError) {
    console.error('ClickBank subscription creation error:', subscriptionError)
    throw new Error(`Failed to create subscription: ${subscriptionError.message}`)
  } else {
    console.log(`✅ Created ClickBank subscription for user ${email}`)
  }

  await grantCredits(supabase, userId, creditsAllocation)

  console.log(`ClickBank subscription processed successfully for ${email}`)
}

/**
 * Puts `credits` on the account for a fresh 30-day credit period, keeping any
 * purchased bonus credits, on the existing credits row or a new one. The credit
 * period is monthly for every plan, lifetime included: the daily renewal job and
 * the renewal at point of use both key on it, so the 50-year period lifetime
 * rows used to get meant 600 credits once and never again. Never writes
 * available_credits (a generated column).
 */
async function grantCredits(supabase: ReturnType<typeof createAdminClient>, userId: string, credits: number) {
  const periodStart = new Date()
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const fields = {
    total_credits: credits,
    used_credits: 0,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    updated_at: new Date().toISOString()
  }
  const { data: existing } = await supabase
    .from('user_credits')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  const { error } = existing
    ? await supabase.from('user_credits').update(fields).eq('user_id', userId)
    : await supabase.from('user_credits').insert({ user_id: userId, ...fields, created_at: new Date().toISOString() })
  if (error) {
    console.error('ClickBank credits grant error:', error)
    throw new Error(`Failed to grant credits: ${error.message}`)
  }
  console.log(`✅ Granted ${credits} credits to user ${userId} for 30 days`)
}

async function handleClickBankRefund(customer: { email?: string }) {
  const supabase = createAdminClient()
  
  const { email } = customer
  
  if (!email) {
    console.error('No email provided for ClickBank refund')
    return
  }
  
  // Find user by email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!profile) {
    console.error('User not found for ClickBank refund:', email)
    return
  }

  if (await isLifetimeOwner(supabase, profile.id)) {
    console.log(`♾️ Ignoring ClickBank refund for lifetime owner ${email} — old CB subscription no longer governs access`)
    return
  }

  // Update subscription status
  await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: true,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', profile.id)

  // Reset credits to 0
  await supabase
    .from('user_credits')
    .update({
      total_credits: 0,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', profile.id)
}

async function handleClickBankRenewal(customer: { email?: string }, lineItems: { amount?: string }[], receipt: string, isYearlyProduct: boolean = false) {
  const supabase = createAdminClient()
  
  const { email } = customer
  
  // Check for duplicate processing
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', receipt)
    .eq('processor', 'clickbank')
    .single()

  if (existingEvent) {
    console.log('Duplicate ClickBank renewal event, skipping:', receipt)
    return
  }

  // Log webhook event
  await supabase
    .from('webhook_events')
    .insert({
      event_id: receipt,
      event_type: 'BILL',
      processor: 'clickbank',
      payload: { customer, lineItems, receipt }
    })

  // Find user by email (handle test emails)
  const searchEmail = email || `test-${receipt.toLowerCase()}@clickbank-test.com`
  const user = await findAuthUserByEmail(supabase, searchEmail)

  if (!user) {
    console.error('User not found for ClickBank renewal:', searchEmail)
    return
  }

  if (await isLifetimeOwner(supabase, user.id)) {
    console.log(`♾️ Ignoring ClickBank renewal for lifetime owner ${searchEmail} — lifetime plan is not overwritten by CB rebills`)
    return
  }

  // Calculate renewal amount and plan
  const totalAmount = lineItems.reduce((sum, item) => sum + parseFloat(item.amount || '37.00'), 0)
  const planType = 'pro' // Everyone gets pro plan like FastSpring
  const creditsAllocation = 600 // Everyone gets 600 credits like FastSpring

  // Update subscription period - using proper date calculation
  const currentPeriodStart = new Date()
  const periodDays = isYearlyProduct ? 365 : 30 // 365 days for yearly, 30 days for monthly
  const currentPeriodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000)

  await supabase
    .from('user_subscriptions')
    .update({
      plan_type: planType,
      status: 'active',
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      cancel_at_period_end: false, // Reset cancellation flag
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id)

  // Renew credits - reset for new period
  await supabase
    .from('user_credits')
    .update({
      total_credits: creditsAllocation,
      used_credits: 0, // Reset usage for new period
      period_start: currentPeriodStart.toISOString(),
      period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id)

  const renewalType = isYearlyProduct ? 'yearly' : 'monthly'
  console.log(`ClickBank ${renewalType} renewal processed: ${searchEmail} - ${creditsAllocation} credits renewed - valid for ${periodDays} days`)
}

async function handleClickBankCancelRebill(customer: { email?: string }, receipt: string) {
  const supabase = createAdminClient()
  
  const { email } = customer
  
  // For test transactions, use the generated test email
  const searchEmail = email || `test-${receipt.toLowerCase()}@clickbank-test.com`
  
  // Find user by email
  const user = await findAuthUserByEmail(supabase, searchEmail)

  if (!user) {
    console.error('User not found for ClickBank cancel rebill:', searchEmail)
    return
  }

  if (await isLifetimeOwner(supabase, user.id)) {
    console.log(`♾️ Ignoring ClickBank cancel-rebill for lifetime owner ${searchEmail}`)
    return
  }

  // Owner policy (2026-07): cancellation must NEVER delete the account or its
  // data — suspend access and mark the subscription cancelled, same as the
  // FastSpring path. (This handler used to hard-delete the account.)
  await supabase
    .from('user_subscriptions')
    .update({ status: 'cancelled', cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  await supabase
    .from('profiles')
    .update({ is_suspended: true, suspension_reason: 'Cancelled subscription', updated_at: new Date().toISOString() })
    .eq('id', user.id)

  console.log(`ClickBank cancel-rebill: suspended user ${searchEmail} (account kept, not deleted)`)
}