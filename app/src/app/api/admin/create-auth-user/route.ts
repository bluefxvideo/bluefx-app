import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/supabase/server'
import { createClient } from '@/app/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, user_metadata, app_metadata } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: email and password' },
        { status: 400 }
      )
    }

    // Verify admin access
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const adminClient = createAdminClient()

    // Create user via Admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: user_metadata || {
        email_verified: true,
        phone_verified: false
      },
      app_metadata: app_metadata || {
        provider: 'email',
        providers: ['email']
      }
    })

    if (authError) {
      console.error('Admin createUser error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user - no user data returned' },
        { status: 500 }
      )
    }

    console.log('✅ User created successfully via Admin API:', authData.user.email)

    return NextResponse.json({
      success: true,
      data: {
        id: authData.user.id,
        email: authData.user.email
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
