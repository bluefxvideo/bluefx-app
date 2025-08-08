import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/supabase/server'
import { requireAdminAuthApi } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminCheck = await requireAdminAuthApi()
    if (!adminCheck.success) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    const { userId, suspend, reason } = await request.json()

    if (!userId || typeof suspend !== 'boolean') {
      return NextResponse.json(
        { error: 'User ID and suspend status are required' },
        { status: 400 }
      )
    }

    // Update user suspension status
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        is_suspended: suspend,
        suspension_reason: suspend ? reason : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user suspension:', error)
      return NextResponse.json(
        { error: 'Failed to update user suspension status' },
        { status: 500 }
      )
    }

    // Log admin action
    await supabase
      .from('admin_logs')
      .insert({
        admin_user_id: adminCheck.user!.profile.id,
        action: suspend ? 'suspend_user' : 'unsuspend_user',
        target_user_id: userId,
        details: {
          reason: reason || 'No reason provided',
          changed_by: adminCheck.user!.profile.username
        }
      })

    return NextResponse.json({
      success: true,
      message: suspend ? 'User suspended successfully' : 'User unsuspended successfully',
      user: data
    })

  } catch (error) {
    console.error('Error in suspend-user API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}