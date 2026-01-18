import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/app/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { userId, credits } = await request.json()

    // Validate input
    if (!userId || !credits || credits <= 0) {
      return NextResponse.json(
        { error: 'Invalid user ID or credit amount' },
        { status: 400 }
      )
    }

    // Use regular client to get authenticated user
    const supabase = await createClient()

    // Check if the current user is an admin
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify admin permission
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role, username')
      .eq('id', currentUser.id)
      .single()

    const isAdmin = adminProfile?.role === 'admin' || 
                   adminProfile?.username === 'admin' || 
                   currentUser.email === 'contact@bluefx.net'

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }
    
    // Now create admin client for the actual database operations
    const adminClient = createAdminClient()

    // Check if user credits record exists
    const { data: existingCredits } = await adminClient
      .from('user_credits')
      .select('total_credits, used_credits, bonus_credits')
      .eq('user_id', userId)
      .single()

    if (existingCredits) {
      // Update existing credits by increasing bonus_credits (not total_credits)
      // bonus_credits persist across monthly renewals, unlike subscription credits
      // available_credits is a generated column: (total_credits - used_credits) + bonus_credits
      const currentBonus = existingCredits.bonus_credits || 0
      const { error: updateError } = await adminClient
        .from('user_credits')
        .update({
          bonus_credits: currentBonus + credits,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (updateError) {
        console.error('Error updating bonus credits:', updateError)
        return NextResponse.json(
          { error: 'Failed to update credits' },
          { status: 500 }
        )
      }
    } else {
      // Create new credits record with bonus_credits (admin-added credits persist)
      const now = new Date()
      const periodStart = now.toISOString()
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

      const { error: insertError } = await adminClient
        .from('user_credits')
        .insert({
          user_id: userId,
          total_credits: 0,  // No subscription credits
          used_credits: 0,
          bonus_credits: credits,  // Admin-added credits go to bonus
          period_start: periodStart,
          period_end: periodEnd,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        // Note: available_credits is auto-calculated as (total_credits - used_credits) + bonus_credits

      if (insertError) {
        console.error('Error creating credits:', insertError)
        return NextResponse.json(
          { error: 'Failed to create credits record' },
          { status: 500 }
        )
      }
    }

    // Log the admin action (optional but recommended)
    try {
      await adminClient
        .from('admin_logs')
        .insert({
          admin_user_id: currentUser.id,
          action: 'add_credits',
          target_user_id: userId,
          details: { credits_added: credits },
          created_at: new Date().toISOString()
        })
    } catch (error: unknown) {
      // Non-critical error, just log it
      console.warn('Failed to log admin action:', error)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully added ${credits} credits`
    })

  } catch (error) {
    console.error('Error adding credits:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}