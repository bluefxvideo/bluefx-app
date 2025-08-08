import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/supabase/server'
import { deleteUserAccount } from '@/app/actions/account-deletion'

export async function DELETE(request: NextRequest) {
  try {
    // Get the authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse confirmation from request body
    const body = await request.json()
    const { confirm } = body
    
    if (confirm !== 'DELETE MY ACCOUNT') {
      return NextResponse.json({ 
        error: 'Account deletion requires exact confirmation text' 
      }, { status: 400 })
    }

    // Delete the user account and all associated data
    const result = await deleteUserAccount(user.id)
    
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to delete account' 
      }, { status: 500 })
    }

    // Account deleted successfully
    // Note: User will be automatically signed out since their auth record is gone
    return NextResponse.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    })

  } catch (error) {
    console.error('Account deletion API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}