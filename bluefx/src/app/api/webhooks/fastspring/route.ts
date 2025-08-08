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
  account?: FastSpringAccount
  product?: FastSpringProduct
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
  
  // Extract customer information from FastSpring format (based on legacy code)
  const customerEmail = data.account?.contact?.email || '' || ''
  const customerFirstName = data.account?.contact?.first || ''
  const customerLastName = data.account?.contact?.last || ''
  const subscriptionId = data.id || data.reference || 'unknown'

  if (!customerEmail) {
    console.error('Customer email not found in FastSpring data:', data)
    throw new Error('Customer email not found')
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

  // Determine plan type and credits based on product (from legacy mapping)
  const productId = data.product?.product || ''
  let planType = 'pro'
  let creditsAllocation = 600  // Consistent with ClickBank
  
  // Legacy code used 'ai-media-machine' patterns
  if (productId.includes('starter') || productId.includes('trial')) {
    planType = 'starter'
    creditsAllocation = 100
  }

  console.log(`FastSpring subscription: ${customerEmail} -> ${planType} (${creditsAllocation} credits)`)

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
        username: cleanUsername,
        full_name: `${customerFirstName} ${customerLastName}`.trim(),
        bio: null,
        avatar_url: null
      })
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
        subscription_id: subscriptionId,
        plan_type: planType
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

  // Create or update subscription
  const currentPeriodStart = new Date()
  const currentPeriodEnd = new Date()
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)

  await supabase.from('user_subscriptions').upsert({
    user_id: userId,
    plan_type: planType,
    status: 'active',
    current_period_start: currentPeriodStart.toISOString(),
    current_period_end: currentPeriodEnd.toISOString(),
    credits_per_month: creditsAllocation,
    max_concurrent_jobs: planType === 'starter' ? 1 : 3,
    fastspring_subscription_id: subscriptionId
  }, {
    onConflict: 'user_id'
  })

  // Allocate credits (matches legacy logic)
  await supabase.from('user_credits').upsert({
    user_id: userId,
    total_credits: creditsAllocation,
    used_credits: 0,
    period_start: currentPeriodStart.toISOString(),
    period_end: currentPeriodEnd.toISOString()
  }, {
    onConflict: 'user_id'
  })

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
  const currentPeriodEnd = new Date()
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)

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