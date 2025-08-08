import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/supabase/server'
import { deleteUserAccount } from '@/app/actions/account-deletion'

interface DeleteUserRequest {
  userId: string
  confirmation: string
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated admin user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { userId, confirmation }: DeleteUserRequest = await request.json()

    if (!userId || !confirmation) {
      return NextResponse.json({ 
        error: 'User ID and confirmation are required' 
      }, { status: 400 })
    }

    // Get the target user info for confirmation validation
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Validate confirmation text
    const expectedConfirmation = `DELETE ${targetUser.username}`
    if (confirmation !== expectedConfirmation) {
      return NextResponse.json({ 
        error: 'Invalid confirmation text' 
      }, { status: 400 })
    }

    // Prevent admin from deleting themselves
    if (userId === user.id) {
      return NextResponse.json({ 
        error: 'Cannot delete your own account' 
      }, { status: 400 })
    }

    // Delete the user account and all associated data
    console.log(`Admin ${user.email} deleting user account: ${userId}`)
    const deletionResult = await deleteUserAccount(userId)

    if (!deletionResult.success) {
      return NextResponse.json({ 
        error: deletionResult.error || 'Failed to delete user account' 
      }, { status: 500 })
    }

    console.log(`User account ${userId} deleted successfully by admin ${user.email}`)

    return NextResponse.json({ 
      success: true, 
      message: 'User account deleted successfully' 
    })

  } catch (error) {
    console.error('Admin delete user error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}