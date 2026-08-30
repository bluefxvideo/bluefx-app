import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/app/supabase/server'
import { findAuthUserByEmail } from '@/lib/auth-user-lookup'

// JVZoo IPN handler for the AI Media Machine funnel on aimediamachine.com.
// JVZoo posts one form-encoded IPN per product transaction; cverify is the
// first 8 chars of an uppercased SHA-1 over the sorted field values joined
// with "|" plus the JVZIPN secret key (set in JVZoo > My Account).
//
// Funnel products (vendor account 131293):
//   451075  FE  AI Media Machine lifetime $297  -> full lifetime provisioning
//   451105  Order bump: Video Templates $67     -> recorded only
//   451107  Order bump: Royalty Free Music $37  -> recorded only
//   451097  OTO1 Resale Bundle $69              -> recorded only
//   451099  DS1  Resale Bundle downsell $29     -> recorded only
//   451101  OTO2 Creators Club $37/mo (7d free) -> recorded only (no in-app entitlement yet)
//   451103  OTO3 Fast Track Call $97            -> recorded only

const FULL_CREDITS = 600
const LIFETIME_PRODUCT = '451075'
const KNOWN_PRODUCTS = new Set([
  '451075', '451105', '451107', '451097', '451099', '451101', '451103',
])

function verifyIpn(fields: Record<string, string>, secret: string): boolean {
  const keys = Object.keys(fields).filter((k) => k !== 'cverify').sort()
  const pop = keys.map((k) => fields[k]).join('|') + '|' + secret
  const digest = createHash('sha1').update(pop, 'utf8').digest('hex').toUpperCase().slice(0, 8)
  return digest === (fields.cverify || '').toUpperCase()
}

// ctransamount arrives in pennies ("29700"); tolerate a dollar string too.
function parseAmount(raw: string | undefined): number {
  if (!raw) return 0
  return raw.includes('.') ? parseFloat(raw) : parseInt(raw, 10) / 100
}

export async function POST(request: NextRequest) {
  const secret = process.env.JVZOO_IPN_SECRET
  if (!secret) {
    console.error('JVZoo IPN received but JVZOO_IPN_SECRET is not configured')
    return NextResponse.json({ error: 'IPN secret not configured' }, { status: 503 })
  }

  let fields: Record<string, string>
  try {
    const formData = await request.formData()
    fields = {}
    for (const [key, value] of formData.entries()) {
      fields[key] = value.toString()
    }
  } catch (error) {
    console.error('Failed to parse JVZoo IPN payload:', error)
    return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 })
  }

  if (!verifyIpn(fields, secret)) {
    console.error('JVZoo IPN verification failed', { receipt: fields.ctransreceipt, product: fields.cproditem })
    return NextResponse.json({ error: 'IPN verification failed' }, { status: 401 })
  }

  const transactionType = (fields.ctransaction || '').toUpperCase()
  const productId = (fields.cproditem || '').trim()
  const receipt = (fields.ctransreceipt || '').trim()
  const email = (fields.ccustemail || '').trim()
  const custName = (fields.ccustname || '').trim()
  const amount = parseAmount(fields.ctransamount)
  const affiliate = (fields.ctransaffiliate || '').trim()

  if (!KNOWN_PRODUCTS.has(productId)) {
    console.log(`JVZoo IPN for unknown product ${productId}, skipping`)
    return NextResponse.json({ message: 'Product not targeted for processing' }, { status: 200 })
  }
  if (!receipt) {
    return NextResponse.json({ error: 'Missing transaction receipt' }, { status: 400 })
  }

  console.log('JVZoo IPN received:', { transactionType, productId, receipt, email, amount, affiliate })

  // One IPN per product transaction; receipt+product keys the duplicate guard.
  const eventId = `${receipt}:${productId}`

  try {
    switch (transactionType) {
      case 'SALE':
      case 'BILL':
        if (productId === LIFETIME_PRODUCT) {
          await provisionLifetime({ email, custName, receipt, eventId, transactionType, amount, affiliate, productId })
        } else {
          await recordEvent({ eventId, transactionType, fields })
        }
        break
      case 'RFND':
      case 'CGBK':
      case 'INSF':
        if (productId === LIFETIME_PRODUCT) {
          await suspendLifetime(email, eventId, transactionType, fields)
        } else {
          await recordEvent({ eventId, transactionType, fields })
        }
        break
      case 'CANCEL-REBILL':
      case 'UNCANCEL-REBILL':
        await recordEvent({ eventId, transactionType, fields })
        break
      default:
        console.log('Unhandled JVZoo transaction:', transactionType)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('JVZoo IPN processing error:', error)
    // The event row is written before provisioning runs; leaving it behind after
    // a failure would make the duplicate guard skip every JVZoo retry. Drop it
    // (scoped to this transaction type) so a retry can do the work.
    try {
      const supabase = createAdminClient()
      await supabase
        .from('webhook_events')
        .delete()
        .eq('event_id', eventId)
        .eq('event_type', transactionType)
        .eq('processor', 'jvzoo')
    } catch (cleanupError) {
      console.error('Failed to clear JVZoo event for retry:', cleanupError)
    }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

async function isDuplicate(supabase: ReturnType<typeof createAdminClient>, eventId: string, eventType: string): Promise<boolean> {
  const { data } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .eq('event_type', eventType)
    .eq('processor', 'jvzoo')
    .maybeSingle()
  return !!data
}

async function recordEvent({ eventId, transactionType, fields }: { eventId: string; transactionType: string; fields: Record<string, string> }) {
  const supabase = createAdminClient()
  if (await isDuplicate(supabase, eventId, transactionType)) {
    console.log('Duplicate JVZoo event, skipping:', eventId, transactionType)
    return
  }
  const { cverify: _cverify, ...payload } = fields
  await supabase.from('webhook_events').insert({
    event_id: eventId,
    event_type: transactionType,
    processor: 'jvzoo',
    payload,
  })
  console.log(`Recorded JVZoo ${transactionType} for product ${fields.cproditem} (${fields.ccustemail})`)
}

async function provisionLifetime(sale: { email: string; custName: string; receipt: string; eventId: string; transactionType: string; amount: number; affiliate: string; productId: string }) {
  const supabase = createAdminClient()
  const { email, custName, receipt, eventId, transactionType, amount, affiliate, productId } = sale

  if (!email) {
    throw new Error('Customer email is required for JVZoo lifetime sale')
  }

  if (await isDuplicate(supabase, eventId, transactionType)) {
    console.log('Duplicate JVZoo lifetime sale, skipping:', eventId)
    return
  }

  await supabase.from('webhook_events').insert({
    event_id: eventId,
    event_type: transactionType,
    processor: 'jvzoo',
    payload: { email, custName, receipt, amount, affiliate, productId },
  })

  const nameParts = custName.split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ')

  const existingUser = await findAuthUserByEmail(supabase, email)
  let userId: string

  if (existingUser) {
    userId = existingUser.id
    console.log(`Found existing user for JVZoo lifetime sale: ${userId}`)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (!profileData) {
      const cleanUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      await supabase.from('profiles').insert({
        id: userId,
        email,
        username: cleanUsername,
        full_name: custName,
        bio: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    const currentPeriodStart = new Date()
    const currentPeriodEnd = new Date(Date.now() + 50 * 365 * 24 * 60 * 60 * 1000)

    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSubscription) {
      // Lifetime is terminal: drop any FastSpring billing anchor so no
      // processor state can ever cancel a paid-in-full plan. A suspended or
      // cancelled prior subscription is reactivated by the purchase (win-back).
      const { error: subscriptionUpdateError } = await supabase
        .from('user_subscriptions')
        .update({
          plan_type: 'lifetime',
          status: 'active',
          current_period_start: currentPeriodStart.toISOString(),
          current_period_end: currentPeriodEnd.toISOString(),
          credits_per_month: FULL_CREDITS,
          max_concurrent_jobs: 5,
          cancel_at_period_end: false,
          fastspring_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSubscription.id)
      if (subscriptionUpdateError) {
        throw new Error(`Failed to update subscription: ${subscriptionUpdateError.message}`)
      }

      const { error: creditsUpdateError } = await supabase
        .from('user_credits')
        .update({
          total_credits: FULL_CREDITS,
          used_credits: 0,
          period_start: currentPeriodStart.toISOString(),
          period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
      if (creditsUpdateError) {
        throw new Error(`Failed to update credits: ${creditsUpdateError.message}`)
      }

      console.log(`✅ Upgraded existing user ${email} to lifetime via JVZoo (receipt ${receipt})`)
      return
    }
    // Existing auth user without a subscription row falls through to the
    // insert path below.
    await insertSubscriptionAndCredits(supabase, userId, email)
    return
  }

  // New customer: create the account and send the password setup email.
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      firstName,
      lastName,
      payment_processor: 'jvzoo',
      receipt,
      plan_type: 'lifetime',
      email_verified: true,
      phone_verified: false,
    },
    app_metadata: {
      provider: 'email',
      providers: ['email'],
    },
  })
  if (authError) {
    console.error('Failed to create JVZoo user:', authError)
    throw new Error('User creation failed')
  }
  userId = authUser.user.id
  console.log(`Created new JVZoo user: ${userId}`)

  const cleanUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  await supabase.from('profiles').insert({
    id: userId,
    email,
    username: cleanUsername,
    full_name: custName,
    bio: null,
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth-callback`,
  })
  if (resetError) {
    console.error('Failed to send password setup email:', resetError)
  } else {
    console.log(`Password setup email sent to ${email}`)
  }

  await insertSubscriptionAndCredits(supabase, userId, email)
}

async function insertSubscriptionAndCredits(supabase: ReturnType<typeof createAdminClient>, userId: string, email: string) {
  const currentPeriodStart = new Date()
  const currentPeriodEnd = new Date(Date.now() + 50 * 365 * 24 * 60 * 60 * 1000)

  const { error: subscriptionError } = await supabase.from('user_subscriptions').insert({
    user_id: userId,
    plan_type: 'lifetime',
    status: 'active',
    current_period_start: currentPeriodStart.toISOString(),
    current_period_end: currentPeriodEnd.toISOString(),
    credits_per_month: FULL_CREDITS,
    max_concurrent_jobs: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (subscriptionError) {
    throw new Error(`Failed to create subscription: ${subscriptionError.message}`)
  }

  const { error: creditsError } = await supabase.from('user_credits').insert({
    user_id: userId,
    total_credits: FULL_CREDITS,
    used_credits: 0,
    period_start: currentPeriodStart.toISOString(),
    period_end: currentPeriodEnd.toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (creditsError) {
    throw new Error(`Failed to create credits: ${creditsError.message}`)
  }

  console.log(`✅ Provisioned JVZoo lifetime for ${email}`)
}

// A refund of the lifetime product itself DOES cut access — unlike stale
// ClickBank events, where lifetime owners are protected. Accounts are
// suspended, never deleted (owner policy).
async function suspendLifetime(email: string, eventId: string, transactionType: string, fields: Record<string, string>) {
  const supabase = createAdminClient()

  if (await isDuplicate(supabase, eventId, transactionType)) {
    console.log('Duplicate JVZoo refund event, skipping:', eventId)
    return
  }
  const { cverify: _cverify, ...payload } = fields
  await supabase.from('webhook_events').insert({
    event_id: eventId,
    event_type: transactionType,
    processor: 'jvzoo',
    payload,
  })

  if (!email) {
    console.error('No email provided for JVZoo refund')
    return
  }

  const user = await findAuthUserByEmail(supabase, email)
  if (!user) {
    console.error('User not found for JVZoo refund:', email)
    return
  }

  await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  await supabase
    .from('user_credits')
    .update({
      total_credits: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  console.log(`JVZoo ${transactionType}: suspended lifetime access for ${email}`)
}
