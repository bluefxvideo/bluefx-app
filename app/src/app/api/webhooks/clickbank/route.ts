import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/supabase/server'

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
  
  // Filter by product ID - accept both monthly (53) and lifetime (55) products
  const monthlyProductId = process.env.CLICKBANK_PRODUCT_ID || '53'
  const lifetimeProductId = '55'
  const targetProductIds = [monthlyProductId, lifetimeProductId]
  
  // Parse lineItemData to check product numbers and detect lifetime
  let hasTargetProduct = false
  let isLifetimeProduct = false
  if (payload.lineItemData) {
    try {
      const lineItemData = JSON.parse((payload.lineItemData as string).replace(/'/g, '"'))
      hasTargetProduct = lineItemData.some((item: { itemNo?: string }) => targetProductIds.includes(item.itemNo || ''))
      isLifetimeProduct = lineItemData.some((item: { itemNo?: string }) => item.itemNo === lifetimeProductId)
    } catch {
      // Fallback: check if product ID appears anywhere in the raw string
      hasTargetProduct = targetProductIds.some(id => 
        (payload.lineItemData as string).includes(`'itemNo': '${id}'`)
      )
      isLifetimeProduct = (payload.lineItemData as string).includes(`'itemNo': '${lifetimeProductId}'`)
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
    rawPayload: payload
  })

  try {
    switch (transactionType) {
      case 'SALE':
      case 'TEST_SALE':  // Handle test transactions
        await handleClickBankSale(customer, lineItems, receipt, isLifetimeProduct)
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
        await handleClickBankRenewal(customer, lineItems, receipt)
        break
      default:
        console.log('Unhandled ClickBank transaction:', transactionType)
        // Don't throw error for unknown transaction types, just log them
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ClickBank webhook processing error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

async function handleClickBankSale(customer: { email?: string; firstName?: string; lastName?: string }, lineItems: { amount?: string }[], receipt: string, isLifetimeProduct: boolean = false) {
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
      payload: { customer, lineItems, receipt }
    })

  // Calculate total amount and determine plan type based on product ID
  const totalAmount = lineItems.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0)
  const isLifetime = isLifetimeProduct // Use product ID detection (product 55)
  const planType = 'pro' // Everyone gets pro plan like FastSpring
  const creditsAllocation = 600 // Everyone gets 600 credits like FastSpring

  console.log(`ClickBank sale: ${email} -> ${planType} (${creditsAllocation} credits) - ${isLifetime ? 'LIFETIME' : 'MONTHLY'} - Amount: $${totalAmount} - Product: ${isLifetimeProduct ? '55 (Lifetime)' : '53 (Monthly)'}`)

  // Check for existing user to decide upgrade vs new user
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const existingUser = authUsers.users.find(u => u.email === email)
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

    // Check for existing subscription to decide upgrade vs new subscription
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('id, plan_type')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (existingSubscription && isLifetime) {
      console.log(`Upgrading existing subscription to lifetime for user ${userId}`)
      
      // Update existing subscription to lifetime terms (50 years)
      const currentPeriodStart = new Date()
      const currentPeriodEnd = new Date(Date.now() + 50 * 365 * 24 * 60 * 60 * 1000) // 50 years
      
      const { error: subscriptionUpdateError } = await supabase
        .from('user_subscriptions')
        .update({
          current_period_start: currentPeriodStart.toISOString(),
          current_period_end: currentPeriodEnd.toISOString(),
          credits_per_month: creditsAllocation,
          max_concurrent_jobs: 5, // Pro plan gets 5 jobs
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id)

      if (subscriptionUpdateError) {
        console.error('ClickBank subscription update error:', subscriptionUpdateError)
        throw new Error(`Failed to update subscription: ${subscriptionUpdateError.message}`)
      }

      // Update existing credits with new lifetime period
      const { error: creditsUpdateError } = await supabase
        .from('user_credits')
        .update({
          total_credits: creditsAllocation,
          period_start: currentPeriodStart.toISOString(),
          period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (creditsUpdateError) {
        console.error('ClickBank credits update error:', creditsUpdateError)
        throw new Error(`Failed to update credits: ${creditsUpdateError.message}`)
      }

      console.log(`✅ Upgraded subscription to lifetime for user ${email} - valid until ${currentPeriodEnd.toISOString().split('T')[0]}`)
      return // Exit early - upgrade complete
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

    // Send password setup email
    await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/setup-password`
      }
    })
  }

  // Create subscription (following admin pattern) - set correct period based on plan type
  const currentPeriodStart = new Date()
  const periodDays = isLifetime ? 50 * 365 : 30 // 50 years for lifetime, 30 days for monthly
  const currentPeriodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000)

  const subscriptionData = {
    user_id: userId,
    plan_type: planType,
    status: 'active',
    current_period_start: currentPeriodStart.toISOString(),
    current_period_end: currentPeriodEnd.toISOString(),
    credits_per_month: creditsAllocation,
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

  // Create credits (following admin pattern)
  const { error: creditsError } = await supabase
    .from('user_credits')
    .insert({
      user_id: userId,
      total_credits: creditsAllocation,
      used_credits: 0,
      period_start: currentPeriodStart.toISOString(),
      period_end: currentPeriodEnd.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (creditsError) {
    console.error('ClickBank credits creation error:', creditsError)
    throw new Error(`Failed to create credits: ${creditsError.message}`)
  } else {
    console.log(`✅ Created ${creditsAllocation} credits for user ${email}`)
  }

  console.log(`ClickBank subscription processed successfully for ${email}`)
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

async function handleClickBankRenewal(customer: { email?: string }, lineItems: { amount?: string }[], receipt: string) {
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
  const { data: authUser } = await supabase.auth.admin.listUsers()
  const user = authUser.users.find(u => u.email === searchEmail)

  if (!user) {
    console.error('User not found for ClickBank renewal:', searchEmail)
    return
  }

  // Calculate renewal amount and plan
  const totalAmount = lineItems.reduce((sum, item) => sum + parseFloat(item.amount || '37.00'), 0)
  const planType = 'pro' // Everyone gets pro plan like FastSpring
  const creditsAllocation = 600 // Everyone gets 600 credits like FastSpring

  // Update subscription period - using proper date calculation
  const currentPeriodStart = new Date()
  const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

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

  console.log(`ClickBank renewal processed: ${searchEmail} - ${creditsAllocation} credits renewed`)
}

async function handleClickBankCancelRebill(customer: { email?: string }, receipt: string) {
  const supabase = createAdminClient()
  
  const { email } = customer
  
  // For test transactions, use the generated test email
  const searchEmail = email || `test-${receipt.toLowerCase()}@clickbank-test.com`
  
  // Find user by email
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find(u => u.email === searchEmail)

  if (!user) {
    console.error('User not found for ClickBank cancel rebill:', searchEmail)
    return
  }

  // Import and call the account deletion action
  const { handleAccountCancellation } = await import('@/app/actions/account-deletion')
  await handleAccountCancellation(searchEmail)
  
  console.log(`Account deletion initiated for cancelled user: ${searchEmail}`)
}