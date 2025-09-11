'use server'

import { createClient, createAdminClient } from '@/app/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { 
  UserRegistrationSchema, 
  UserLoginSchema, 
  PasswordResetSchema, 
  PasswordUpdateSchema,
  ProfileUpdateSchema,
  createApiSuccess,
  createApiError,
  type ApiResponse
} from '@/types/validation'
import { type Tables, type InsertTables } from '@/types/database'
import type { User } from '@supabase/supabase-js'

// User creation data interface
interface CreateUserData {
  email: string
  password: string
  user_metadata?: Record<string, any>
  app_metadata?: Record<string, any>
  email_confirm?: boolean
}

// === Authentication Actions ===

export async function signUp(formData: FormData): Promise<ApiResponse<{ user: User; profile: Tables<'profiles'> }>> {
  try {
    const supabase = await createClient()
    
    // Parse form data
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const username = formData.get('username') as string
    const full_name = formData.get('full_name') as string
    const plan_type = formData.get('plan_type') as string || 'pro'  // Default to pro, not trial

    // Validate data
    const validation = UserRegistrationSchema.safeParse({
      email, password, username, full_name, plan_type
    })
    
    if (!validation.success) {
      return createApiError(validation.error.issues.map(i => i.message).join(', '))
    }

    // Check if username is already taken
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single()

    if (existingUser) {
      return createApiError('Username is already taken')
    }

    // No need to check for migration data anymore (all users migrated)

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name,
          plan_type
        }
      }
    })

    if (authError || !authData.user) {
      // Provide clearer error messages for signup failures
      let errorMessage = 'Failed to create user'
      
      if (authError?.message) {
        const errorMsg = authError.message.toLowerCase()
        
        if (errorMsg.includes('user already registered') || errorMsg.includes('already registered')) {
          errorMessage = 'An account with this email address already exists. Please try logging in instead.'
        } else if (errorMsg.includes('invalid email')) {
          errorMessage = 'Please enter a valid email address.'
        } else if (errorMsg.includes('password')) {
          errorMessage = 'Password must be at least 8 characters long.'
        } else {
          errorMessage = authError.message
        }
      }
      
      return createApiError(errorMessage)
    }

    // Create fresh account for all new users
    const profileData: InsertTables<'profiles'> = {
      id: authData.user.id,
      username,
      full_name
    }
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single()

    if (profileError) {
      return createApiError('Failed to create user profile')
    }

    // Create initial subscription for new users (everyone is Pro)
    const subscriptionData: InsertTables<'user_subscriptions'> = {
      user_id: authData.user.id,
      plan_type: 'pro',  // Everyone is pro
      status: 'active',
      credits_per_month: 600,  // Pro users get 600 credits
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
    
    await supabase
      .from('user_subscriptions')
      .insert(subscriptionData)

    // Create initial credits for new users (everyone gets Pro credits)
    const creditsData: InsertTables<'user_credits'> = {
      user_id: authData.user.id,
      total_credits: 600,  // Pro users get 600 credits
      used_credits: 0,
      period_start: new Date().toISOString(),
      period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
    
    await supabase
      .from('user_credits')
      .insert(creditsData)

    revalidatePath('/', 'layout')
    
    return createApiSuccess(
      { user: authData.user, profile },
      'Account created successfully!'
    )

  } catch (error) {
    console.error('Sign up error:', error)
    return createApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    )
  }
}

export async function signIn(formData: FormData): Promise<ApiResponse<{ user: User; isLegacyUser?: boolean }>> {
  try {
    const supabase = await createClient()
    
    // Parse form data
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    // Validate data
    const validation = UserLoginSchema.safeParse({ email, password })
    
    if (!validation.success) {
      return createApiError(validation.error.issues.map(i => i.message).join(', '))
    }

    // First try normal sign in
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!error && data.user) {
      // Successful sign in
      revalidatePath('/', 'layout')
      return createApiSuccess({ user: data.user }, 'Signed in successfully!')
    }

    // Sign in failed - no need to check for legacy users anymore (all migrated)

    // Provide clearer error messages for common authentication failures
    let errorMessage = 'Invalid login credentials'
    
    if (error?.message) {
      const errorMsg = error.message.toLowerCase()
      
      if (errorMsg.includes('invalid login credentials') || errorMsg.includes('invalid email or password')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.'
      } else if (errorMsg.includes('email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before signing in.'
      } else if (errorMsg.includes('too many requests')) {
        errorMessage = 'Too many login attempts. Please wait a few minutes before trying again.'
      } else if (errorMsg.includes('user not found')) {
        errorMessage = 'No account found with this email address.'
      } else if (errorMsg.includes('user already registered')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.'
      } else {
        errorMessage = error.message
      }
    }

    return createApiError(errorMessage)

  } catch (error) {
    console.error('Sign in error:', error)
    return createApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    )
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function resetPassword(data: FormData | { email: string }): Promise<ApiResponse<object>> {
  try {
    const supabase = await createClient()
    
    // Parse data - handle both FormData and direct object
    const email = data instanceof FormData ? data.get('email') as string : data.email

    // Validate data
    const validation = PasswordResetSchema.safeParse({ email })
    
    if (!validation.success) {
      return createApiError(validation.error.issues.map(i => i.message).join(', '))
    }

    console.log('📧 Sending password reset email to:', email)
    
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth-callback`
    console.log('🔗 Reset redirect URL:', redirectUrl)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })

    if (error) {
      console.error('❌ Password reset error:', error.message)
      
      // Handle specific error cases
      if (error.message?.includes('rate limit')) {
        return createApiError('Too many password reset attempts. Please wait before trying again.')
      }
      
      // Don't expose whether user exists or not for security
      // Always show success message
      console.log('⚠️ Showing success despite error to prevent user enumeration')
    }

    // Always return success to prevent user enumeration attacks
    console.log('✅ Password reset process completed')
    return createApiSuccess({}, 'If an account exists with this email, you will receive password reset instructions.')

  } catch (error) {
    console.error('💥 Password reset unexpected error:', error)
    return createApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    )
  }
}

// Legacy user setup function removed - all users have been migrated

export async function updatePassword(formData: FormData): Promise<ApiResponse<object>> {
  try {
    const supabase = await createClient()
    
    // Parse form data
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    // Validate data
    const validation = PasswordUpdateSchema.safeParse({ password, confirmPassword })
    
    if (!validation.success) {
      return createApiError(validation.error.issues.map(i => i.message).join(', '))
    }

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      return createApiError(error.message)
    }

    // No migration checks needed anymore

    revalidatePath('/', 'layout')
    
    return createApiSuccess({}, 'Password updated successfully!')

  } catch (error) {
    console.error('Password update error:', error)
    return createApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    )
  }
}

export async function updateProfile(formData: FormData): Promise<ApiResponse<Tables<'profiles'>>> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return createApiError('User not authenticated')
    }

    // Parse form data
    const username = formData.get('username') as string
    const full_name = formData.get('full_name') as string
    const bio = formData.get('bio') as string

    // Validate data
    const validation = ProfileUpdateSchema.safeParse({ username, full_name, bio })
    
    if (!validation.success) {
      return createApiError(validation.error.issues.map(i => i.message).join(', '))
    }

    // Update profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update({
        username,
        full_name,
        bio,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    if (profileError) {
      return createApiError(profileError.message)
    }

    revalidatePath('/', 'layout')
    
    return createApiSuccess(profile, 'Profile updated successfully!')

  } catch (error) {
    console.error('Profile update error:', error)
    return createApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    )
  }
}

// === Admin User Management ===

/**
 * Properly create a user using Supabase Admin API
 * This is the correct way to create users programmatically
 */
export async function createUserWithAdminAPI(userData: CreateUserData): Promise<ApiResponse<User>> {
  try {
    const adminClient = createAdminClient()
    
    // Use proper Admin API to create user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: userData.email_confirm ?? true,
      user_metadata: userData.user_metadata || {
        email_verified: true,
        phone_verified: false
      },
      app_metadata: userData.app_metadata || {
        provider: 'email',
        providers: ['email']
      }
    })

    if (authError) {
      console.error('Admin createUser error:', authError)
      return createApiError(authError.message)
    }

    if (!authData.user) {
      return createApiError('Failed to create user - no user data returned')
    }

    console.log('✅ User created successfully via Admin API:', authData.user.email)
    return createApiSuccess(authData.user, 'User created successfully')

  } catch (error) {
    console.error('💥 Admin user creation unexpected error:', error)
    return createApiError(error instanceof Error ? error.message : 'An unexpected error occurred')
  }
}