import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/supabase/server'

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

    // Check if user credits record exists
    const { data: existingCredits } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', userId)
      .single()

    if (existingCredits) {
      // Update existing credits
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          available_credits: existingCredits.available_credits + credits,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (updateError) {
        console.error('Error updating credits:', updateError)
        return NextResponse.json(
          { error: 'Failed to update credits' },
          { status: 500 }
        )
      }
    } else {
      // Create new credits record
      const now = new Date()
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
      
      const { error: insertError } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          available_credits: credits,
          total_credits: credits,
          period_start: periodStart,
          period_end: periodEnd,
          used_credits: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

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
      await supabase
        .from('admin_logs')
        .insert({
          admin_user_id: currentUser.id,
          action: 'add_credits',
          target_user_id: userId,
          details: { credits_added: credits },
          created_at: new Date().toISOString()
        })
    } catch (error: any) {
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