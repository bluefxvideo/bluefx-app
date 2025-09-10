import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/supabase/server'
import type { Json } from '@/types/database'

// FastSpring webhook payload interfaces
interface FastSpringContact {
  email?: string
  first?: string
  last?: string
}

interface FastSpringAccount {
  contact?: FastSpringContact
}

interface FastSpringProduct {
  product?: string
}

interface FastSpringEventData {
  id?: string
  reference?: string
  account?: FastSpringAccount | string  // Can be object or string
  product?: FastSpringProduct | string  // Can be object or string
  state?: string  // For trial state detection
  type?: string   // For event type
  intervalUnit?: string  // For yearly detection
  subscription?: string  // Subscription ID
  customer?: {
    email?: string
  }
  items?: Array<{
    product?: string
  }>
}

interface FastSpringPayload {
  events?: Array<{
    type?: string
    data?: FastSpringEventData
  }>
}

export async function POST(request: NextRequest) {
  let payload: FastSpringPayload
  
  try {
    // FastSpring always sends JSON
    const contentType = request.headers.get('content-type')
    
    if (!contentType?.includes('application/json')) {
      console.error('Invalid content type:', contentType)
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
    }
    
    payload = await request.json()
    
  } catch (error) {
    console.error('Failed to parse FastSpring webhook payload:', error)
    return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 })
  }
  
  // Optional: FastSpring signature verification
  const signature = request.headers.get('x-fs-signature')
  if (process.env.FASTSPRING_WEBHOOK_SECRET && signature) {
    // TODO: Implement FastSpring signature verification if needed
    console.log('FastSpring signature verification skipped (implement if needed)')
  }

  // FastSpring sends events array
  if (!payload.events || !Array.isArray(payload.events) || payload.events.length === 0) {
    console.log('FastSpring webhook received without events array')
    return NextResponse.json({ message: 'No events to process' }, { status: 200 })
  }

  console.log(`Processing ${payload.events.length} FastSpring event(s)...`)
  
  try {
    // Process the first event (most webhooks contain single events)
    const event = payload.events[0]
    const eventType = event?.type
    const eventData = event?.data

    if (!eventType || !eventData) {
      console.error('Missing event type or data:', { eventType, hasData: !!eventData })
      return NextResponse.json({ error: 'Invalid event format' }, { status: 400 })
    }

    console.log('FastSpring webhook payload received:', {
      eventType,
      subscriptionId: eventData.id,
      customerEmail: eventData.account?.contact?.email,
      rawPayload: payload
    })

    // Route to appropriate handler based on event type
    switch (eventType) {
      case 'subscription.activated':
      case 'subscription.charge.completed':
        await handleFastSpringSubscription(eventData)
        break
      
      case 'subscription.updated':
        await handleFastSpringRenewal(eventData)
        break
      
      case 'order.completed':
        // Handle one-time credit pack purchases
        await handleFastSpringCreditPack(eventData)
        break
      
      case 'subscription.canceled':
      case 'subscription.deactivated':
        await handleFastSpringCancellation(eventData)
        break
      
      default:
        console.log('Unhandled FastSpring event type:', eventType)
        // Don't throw error for unknown event types, just acknowledge
    }

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('FastSpring webhook processing error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

async function handleFastSpringSubscription(data: FastSpringEventData) {
  const supabase = createAdminClient()
  
  // Extract customer information from FastSpring format - handle both payload types
  let customerEmail = ''
  let customerFirstName = ''
  let customerLastName = ''
  let accountId = ''
  const subscriptionId = data.id || data.reference || 'unknown'

  // Handle different payload formats
  if (typeof data.account === 'object' && data.account?.contact?.email) {
    // Format 1: account is object with contact info (typical for new subscriptions)
    customerEmail = data.account.contact.email
    customerFirstName = data.account.contact.first || ''
    customerLastName = data.account.contact.last || ''
    accountId = data.account.id || ''
  } else if (typeof data.account === 'string') {
    // Format 2: account is just ID string (trial activations, renewals, etc.)
    accountId = data.account
    console.log('Trial/Renewal subscription - account ID only, no email provided:', accountId)
    
    // Don't skip trials anymore - we'll try to get email from API
    
    // For renewals or other events, try to find existing user
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const existingUser = authUsers.users.find(u => 
      u.user_metadata?.payment_processor === 'fastspring' && 
      u.user_metadata?.fastspring_account_id === accountId
    )
    
    if (existingUser) {
      customerEmail = existingUser.email || ''
      customerFirstName = existingUser.user_metadata?.firstName || ''
      customerLastName = existingUser.user_metadata?.lastName || ''
      console.log(`Found existing user for account ${accountId}: ${customerEmail}`)
    } else {
      // Check if this is linked to a previous subscription
      const { data: previousEvent } = await supabase
        .from('webhook_events')
        .select('payload')
        .eq('processor', 'fastspring')
        .or(`payload->accountId.eq.${accountId},payload->data->account.eq.${accountId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (previousEvent?.payload?.customerEmail) {
        customerEmail = previousEvent.payload.customerEmail
        console.log(`Found email from previous event for account ${accountId}: ${customerEmail}`)
      }
    }
  }

  if (!customerEmail && accountId) {
    console.log('Email not in webhook payload, fetching from FastSpring API for account:', accountId)
    
    // Try to fetch customer details from FastSpring API
    const fastSpringUsername = process.env.FASTSPRING_USERNAME
    const fastSpringApiKey = process.env.FASTSPRING_API_KEY
    
    if (fastSpringUsername && fastSpringApiKey) {
      try {
        const auth = Buffer.from(`${fastSpringUsername}:${fastSpringApiKey}`).toString('base64')
        const accountResponse = await fetch(`https://api.fastspring.com/accounts/${accountId}`, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        })
        
        if (accountResponse.ok) {
          const accountData = await accountResponse.json()
          console.log('FastSpring account data retrieved:', accountData)
          
          // Extract email from account data
          customerEmail = accountData.contact?.email || accountData.email || ''
          customerFirstName = accountData.contact?.first || accountData.firstName || ''
          customerLastName = accountData.contact?.last || accountData.lastName || ''
          
          if (customerEmail) {
            console.log(`Successfully retrieved email from FastSpring API: ${customerEmail}`)
          }
        } else {
          console.error(`FastSpring API error fetching account: ${accountResponse.status}`)
        }
      } catch (apiError) {
        console.error('Failed to fetch account from FastSpring API:', apiError)
      }
    } else {
      console.error('FastSpring API credentials not configured')
    }
  }
  
  if (!customerEmail) {
    console.error('Customer email not found after all attempts:', data)
    console.error('Account ID:', accountId)
    
    // For trial subscriptions, we still need to handle them but can't create user without email
    if (data.state === 'trial') {
      console.log('Trial subscription without email - cannot create user')
      // Log the event for manual review
      await supabase
        .from('webhook_events')
        .insert({
          event_id: `${subscriptionId}_missing_email`,
          event_type: 'ERROR_MISSING_EMAIL',
          processor: 'fastspring',
          payload: { data, accountId, subscriptionId, error: 'Could not retrieve customer email' } as unknown as Json
        })
      return
    }
    
    throw new Error('Customer email not found and could not be retrieved from API')
  }

  // Check for duplicate processing
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', subscriptionId)
    .eq('processor', 'fastspring')
    .single()

  if (existingEvent) {
    console.log('Duplicate FastSpring event, skipping:', subscriptionId)
    return
  }

  // Log webhook event
  await supabase
    .from('webhook_events')
    .insert({
      event_id: subscriptionId,
      event_type: 'SUBSCRIPTION',
      processor: 'fastspring',
      payload: { data, customerEmail, subscriptionId } as unknown as Json
    })

  // Determine plan type and credits based on product - handle both formats
  const productId = data.product?.product || data.product || ''
  const intervalUnit = data.intervalUnit || ''
  const isYearlyPlan = productId.includes('yearly') || intervalUnit === 'year'
  
  // Always create as PRO even for trials (they're just PRO with 30-day free trial)
  let planType = 'pro'
  let creditsAllocation = 600  // Same for both monthly and yearly
  
  // Only use starter if explicitly a starter product (not for trials)
  if (productId.includes('starter') && !data.state?.includes('trial')) {
    planType = 'starter'
    creditsAllocation = 100
  }
  
  console.log(`Creating ${data.state === 'trial' ? 'TRIAL (as PRO)' : planType.toUpperCase()} subscription with ${creditsAllocation} credits`)

  console.log(`FastSpring subscription: ${customerEmail} -> ${planType} (${creditsAllocation} credits) - ${isYearlyPlan ? 'YEARLY' : 'MONTHLY'}`)

  // Find existing user or create new one (matches legacy logic)
  let userId: string

  // First check if user exists in auth
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const existingUser = authUsers.users.find(u => u.email === customerEmail)

  if (existingUser) {
    userId = existingUser.id
    console.log(`Found existing FastSpring user: ${userId}`)
    
    // Check if profile exists, create if missing (legacy pattern)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (!profileData) {
      console.log(`Creating missing profile for existing user ${userId}`)
      const cleanUsername = customerEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      await supabase.from('profiles').insert({
        id: userId,
        email: customerEmail,  // Add email field to profiles
        username: cleanUsername,
        full_name: `${customerFirstName} ${customerLastName}`.trim(),
        bio: null,
        avatar_url: null
      })
    }

    // Check for existing subscription to decide upgrade vs new subscription
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('id, plan_type, fastspring_subscription_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (existingSubscription && isYearlyPlan) {
      console.log(`Upgrading existing subscription to yearly for user ${userId}`)
      
      // Update existing subscription to yearly terms
      const currentPeriodStart = new Date()
      const currentPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      
      const { error: subscriptionUpdateError } = await supabase
        .from('user_subscriptions')
        .update({
          fastspring_subscription_id: subscriptionId,
          current_period_start: currentPeriodStart.toISOString(),
          current_period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id)

      if (subscriptionUpdateError) {
        console.error('FastSpring subscription update error:', subscriptionUpdateError)
        throw new Error(`Failed to update subscription: ${subscriptionUpdateError.message}`)
      }

      // Update existing credits with new yearly period
      const { error: creditsUpdateError } = await supabase
        .from('user_credits')
        .update({
          period_start: currentPeriodStart.toISOString(),
          period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (creditsUpdateError) {
        console.error('FastSpring credits update error:', creditsUpdateError)
        throw new Error(`Failed to update credits: ${creditsUpdateError.message}`)
      }

      console.log(`✅ Upgraded subscription to yearly for user ${customerEmail} - valid until ${currentPeriodEnd.toISOString().split('T')[0]}`)
      console.log(`FastSpring subscription processed successfully for ${customerEmail}`)
      return // Exit early - upgrade complete
    }
  } else {
    // Create new user account (matches legacy logic)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: customerEmail,
      email_confirm: true,
      user_metadata: {
        firstName: customerFirstName,
        lastName: customerLastName,
        payment_processor: 'fastspring',
        fastspring_account_id: accountId,  // Store account ID for future lookups
        subscription_id: subscriptionId,
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
      console.error('Failed to create FastSpring user:', authError)
      throw new Error('User creation failed')
    }

    userId = authUser.user.id
    console.log(`Created new FastSpring user: ${userId}`)

    // Create profile with clean username
    const cleanUsername = customerEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    await supabase.from('profiles').insert({
      id: userId,
      email: customerEmail,  // Add email field to profiles
      username: cleanUsername,
      full_name: `${customerFirstName} ${customerLastName}`.trim(),
      bio: null,
      avatar_url: null
    })

    // Send password setup email (matches legacy logic)
    await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: customerEmail,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/setup-password`
      }
    })
  }

  // Check if user already has an active subscription
  const { data: existingSubscriptions } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')

  // Create subscription (following admin pattern) - set correct period based on plan type
  const currentPeriodStart = new Date()
  const periodDays = isYearlyPlan ? 365 : 30 // 1 year for yearly, 30 days for monthly
  const currentPeriodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000)

  const subscriptionData = {
    user_id: userId,
    plan_type: planType,
    status: 'active',
    current_period_start: currentPeriodStart.toISOString(),
    current_period_end: currentPeriodEnd.toISOString(),
    credits_per_month: creditsAllocation,
    max_concurrent_jobs: planType === 'starter' ? 1 : 5, // Pro gets 5 like admin
    fastspring_subscription_id: subscriptionId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  if (existingSubscriptions && existingSubscriptions.length > 0) {
    // Update existing subscription instead of creating a new one
    console.log(`User ${customerEmail} already has ${existingSubscriptions.length} active subscription(s). Updating the first one.`)
    
    const { error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .update({
        plan_type: planType,
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        credits_per_month: creditsAllocation,
        fastspring_subscription_id: subscriptionId,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingSubscriptions[0].id)

    if (subscriptionError) {
      console.error('FastSpring subscription update error:', subscriptionError)
      throw new Error(`Failed to update subscription: ${subscriptionError.message}`)
    } else {
      console.log(`✅ Updated FastSpring subscription for user ${customerEmail}`)
    }
  } else {
    // No existing subscription, create a new one
    const { error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .insert(subscriptionData)

    if (subscriptionError) {
      console.error('FastSpring subscription creation error:', subscriptionError)
      throw new Error(`Failed to create subscription: ${subscriptionError.message}`)
    } else {
      console.log(`✅ Created FastSpring subscription for user ${customerEmail}`)
    }
  }

  // Check if user already has credits
  const { data: existingCredits } = await supabase
    .from('user_credits')
    .select('id')
    .eq('user_id', userId)

  if (existingCredits && existingCredits.length > 0) {
    // Update existing credits instead of creating new ones
    console.log(`User ${customerEmail} already has ${existingCredits.length} credit record(s). Updating the first one.`)
    
    const { error: creditsError } = await supabase
      .from('user_credits')
      .update({
        total_credits: creditsAllocation,
        used_credits: 0,
        period_start: currentPeriodStart.toISOString(),
        period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existingCredits[0].id)

    if (creditsError) {
      console.error('FastSpring credits update error:', creditsError)
      throw new Error(`Failed to update credits: ${creditsError.message}`)
    } else {
      console.log(`✅ Updated ${creditsAllocation} credits for user ${customerEmail}`)
    }
  } else {
    // No existing credits, create new ones
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
      console.error('FastSpring credits creation error:', creditsError)
      throw new Error(`Failed to create credits: ${creditsError.message}`)
    } else {
      console.log(`✅ Created ${creditsAllocation} credits for user ${customerEmail}`)
    }
  }

  console.log(`FastSpring subscription processed successfully for ${customerEmail}`)
}

async function handleFastSpringRenewal(data: FastSpringEventData) {
  const supabase = createAdminClient()
  
  const customerEmail = data.account?.contact?.email || ''
  const subscriptionId = data.id || data.reference || 'unknown'

  if (!customerEmail) {
    console.error('Customer email not found in FastSpring renewal:', data)
    return
  }

  // Check for duplicate processing
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', `${subscriptionId}_renewal`)
    .eq('processor', 'fastspring')
    .single()

  if (existingEvent) {
    console.log('Duplicate FastSpring renewal event, skipping:', subscriptionId)
    return
  }

  // Log webhook event
  await supabase
    .from('webhook_events')
    .insert({
      event_id: `${subscriptionId}_renewal`,
      event_type: 'RENEWAL',
      processor: 'fastspring',
      payload: { data, customerEmail, subscriptionId } as unknown as Json
    })

  // Find user by email
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const user = authUsers.users.find(u => u.email === customerEmail)

  if (!user) {
    console.error('User not found for FastSpring renewal:', customerEmail)
    return
  }

  // Renew subscription and credits (consistent 600 credits like ClickBank)
  const currentPeriodStart = new Date()
  const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id)

  // Reset credits for new period (600 like ClickBank)
  await supabase
    .from('user_credits')
    .update({
      total_credits: 600,
      used_credits: 0,
      period_start: currentPeriodStart.toISOString(),
      period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id)

  console.log(`FastSpring renewal processed: ${customerEmail} - 600 credits renewed`)
}

async function handleFastSpringCreditPack(data: FastSpringEventData) {
  const supabase = createAdminClient()
  
  const customerEmail = data.customer?.email

  if (!customerEmail) {
    console.error('Customer email not found in FastSpring credit pack order:', data)
    return
  }

  // Find user by email
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const user = authUsers.users.find(u => u.email === customerEmail)

  if (!user) {
    console.error('User not found for FastSpring credit pack purchase:', customerEmail)
    return
  }

  // Process credit pack items (from legacy code mapping)
  const items = (data.items as Array<{ product?: string }>) || []
  let totalCreditsToAdd = 0
  
  // Map FastSpring product IDs to credit amounts (from legacy code)
  const creditPackMapping: Record<string, number> = {
    '100-ai-credit-pack': 100,
    '300-ai-credit-pack': 300,
    '600-ai-credit-pack': 600,
    '1000-ai-credit-pack': 1000,
  }
  
  for (const item of items) {
    const productId = item.product
    if (!productId) continue
    const creditsToAdd = creditPackMapping[productId]
    
    if (creditsToAdd) {
      totalCreditsToAdd += creditsToAdd
      console.log(`User ${user.email} purchased ${creditsToAdd} credits via product ${productId}`)
    }
  }

  if (totalCreditsToAdd === 0) {
    console.log('No recognized credit packs found in FastSpring order')
    return
  }

  // Get current credits and add new ones (matches legacy logic)
  const { data: userCredits } = await supabase
    .from('user_credits')
    .select('total_credits')
    .eq('user_id', user.id)
    .single()

  const currentCredits = userCredits?.total_credits || 0
  const newTotalCredits = currentCredits + totalCreditsToAdd

  await supabase
    .from('user_credits')
    .update({
      total_credits: newTotalCredits,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id)

  console.log(`FastSpring credit pack processed: ${customerEmail} +${totalCreditsToAdd} credits (total: ${newTotalCredits})`)
}

async function handleFastSpringCancellation(data: FastSpringEventData) {
  const supabase = createAdminClient()
  
  const customerEmail = data.account?.contact?.email || ''

  if (!customerEmail) {
    console.error('Customer email not found in FastSpring cancellation:', data)
    return
  }

  // Find user by email
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const user = authUsers.users.find(u => u.email === customerEmail)

  if (!user) {
    console.error('User not found for FastSpring cancellation:', customerEmail)
    return
  }

  // Import and call the account deletion action (same as ClickBank)
  const { handleAccountCancellation } = await import('@/app/actions/account-deletion')
  await handleAccountCancellation(customerEmail)
  
  console.log(`FastSpring account deletion initiated for cancelled user: ${customerEmail}`)
}