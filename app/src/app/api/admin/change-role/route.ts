import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/supabase/server'
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

    const supabase = createAdminClient()
    const { userId, newRole } = await request.json()

    if (!userId || !newRole) {
      return NextResponse.json(
        { error: 'User ID and new role are required' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['user', 'admin', 'support', 'tester']
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { error: 'Invalid role specified' },
        { status: 400 }
      )
    }

    // Update user role
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user role:', error)
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
      )
    }

    // Log admin action
    await supabase
      .from('admin_logs')
      .insert({
        admin_user_id: adminCheck.user!.profile.id,
        action: 'change_user_role',
        target_user_id: userId,
        details: {
          old_role: data.role,
          new_role: newRole,
          changed_by: adminCheck.user!.profile.username
        }
      })

    return NextResponse.json({
      success: true,
      message: `User role changed to ${newRole}`,
      user: data
    })

  } catch (error) {
    console.error('Error in change-role API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}