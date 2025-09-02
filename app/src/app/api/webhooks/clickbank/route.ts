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
  
  // Filter by product ID - only process webhooks for our specific product
  const targetProductId = process.env.CLICKBANK_PRODUCT_ID || '53'
  
  // Parse lineItemData to check product numbers
  let hasTargetProduct = false
  if (payload.lineItemData) {
    try {
      const lineItemData = JSON.parse((payload.lineItemData as string).replace(/'/g, '"'))
      hasTargetProduct = lineItemData.some((item: { itemNo?: string }) => item.itemNo === targetProductId)
    } catch {
      // Fallback: check if product ID appears anywhere in the raw string
      hasTargetProduct = (payload.lineItemData as string).includes(`'itemNo': '${targetProductId}'`)
    }
  }
  
  // If this webhook is not for our target product, acknowledge but don't process
  if (!hasTargetProduct) {
    console.log(`ClickBank webhook for different product (not ${targetProductId}), skipping processing`)
    return NextResponse.json({ message: 'Product not targeted for processing' }, { status: 200 })
  }
  
  // Log the incoming data for debugging
  console.log('Webhook payload received:', {
    transactionType,
    customer,
    receipt,
    targetProductId,
    rawPayload: payload
  })

  try {
    switch (transactionType) {
      case 'SALE':
      case 'TEST_SALE':  // Handle test transactions
        await handleClickBankSale(customer, lineItems, receipt)
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

async function handleClickBankSale(customer: { email?: string; firstName?: string; lastName?: string }, lineItems: { amount?: string }[], receipt: string) {
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

  // Calculate total amount from line items
  const totalAmount = lineItems.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0)
  const isTrial = totalAmount <= 1.00
  const planType = isTrial ? 'starter' : 'pro'

  // Create user account using admin client
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

  // Create profile with a clean username (remove hyphens/special chars)
  const cleanUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  await supabase.from('profiles').insert({
    id: authUser.user.id,
    email: email,  // Add email field to profiles
    username: cleanUsername,
    full_name: `${firstName} ${lastName}`,
    bio: null,
    avatar_url: null
  })

  // Create subscription
  const currentPeriodStart = new Date()
  const currentPeriodEnd = new Date()
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)

  await supabase.from('user_subscriptions').insert({
    user_id: authUser.user.id,
    plan_type: planType,
    status: 'active',
    current_period_start: currentPeriodStart.toISOString(),
    current_period_end: currentPeriodEnd.toISOString(),
    credits_per_month: isTrial ? 100 : 1000,
    max_concurrent_jobs: isTrial ? 1 : 3
  })

  // Allocate credits
  await supabase.from('user_credits').insert({
    user_id: authUser.user.id,
    total_credits: 600,
    used_credits: 0,
    period_start: currentPeriodStart.toISOString(),
    period_end: currentPeriodEnd.toISOString()
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
  const planType = totalAmount <= 1.00 ? 'starter' : 'pro'
  const creditsAllocation = planType === 'starter' ? 100 : 600  // Keep consistent with initial allocation

  // Update subscription period
  const currentPeriodStart = new Date()
  const currentPeriodEnd = new Date()
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)

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