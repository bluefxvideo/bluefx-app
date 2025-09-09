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

// Type definitions for RPC function returns
interface MigrationCheckResult {
  has_migration_data: boolean
}

interface MigrationRestoreResult {
  success: boolean
  message?: string
  credits_restored?: number
}

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
    const plan_type = formData.get('plan_type') as string || 'trial'

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

    // Check for migration data before creating new account
    const { data: migrationCheck } = await supabase
      .rpc('check_user_migration_data', { p_email: email })

    const hasMigrationData = (migrationCheck as unknown as MigrationCheckResult)?.has_migration_data || false

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

    let profile: Tables<'profiles'>
    let migrationResult: { success: boolean; message?: string; credits_restored?: number } | null = null

    if (hasMigrationData) {
      // User has migration data - restore their legacy account
      const { data: restorationResult } = await supabase
        .rpc('restore_user_data_on_registration', {
          p_auth_user_id: authData.user.id,
          p_email: email
        })

      migrationResult = restorationResult as unknown as MigrationRestoreResult

      if ((restorationResult as unknown as MigrationRestoreResult)?.success) {
        // Get the restored profile
        const { data: restoredProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single()

        profile = restoredProfile!
      } else {
        return createApiError('Failed to restore user data: ' + (restorationResult as unknown as MigrationRestoreResult)?.message)
      }
    } else {
      // New user - create fresh account
      const profileData: InsertTables<'profiles'> = {
        id: authData.user.id,
        username,
        full_name
      }
      
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single()

      if (profileError) {
        return createApiError('Failed to create user profile')
      }

      profile = newProfile

      // Create initial subscription for new users
      const subscriptionData: InsertTables<'user_subscriptions'> = {
        user_id: authData.user.id,
        plan_type: plan_type as 'free' | 'starter' | 'pro' | 'enterprise',
        status: 'active',
        credits_per_month: plan_type === 'trial' ? 100 : plan_type === 'pro' ? 1000 : 5000,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
      
      await supabase
        .from('user_subscriptions')
        .insert(subscriptionData)

      // Create initial credits for new users
      const creditsData: InsertTables<'user_credits'> = {
        user_id: authData.user.id,
        total_credits: plan_type === 'trial' ? 100 : plan_type === 'pro' ? 1000 : 5000,
        used_credits: 0,
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
      
      await supabase
        .from('user_credits')
        .insert(creditsData)
    }

    revalidatePath('/', 'layout')
    
    const successMessage = hasMigrationData 
      ? `Welcome back! Your account has been restored with ${migrationResult?.credits_restored || 0} credits.`
      : 'Account created successfully!'
    
    return createApiSuccess(
      { user: authData.user, profile, migrated: hasMigrationData, migrationResult },
      successMessage
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

    // If sign in failed, check if this is a legacy user
    if (error?.message?.includes('Invalid login credentials')) {
      const { data: migrationCheck } = await supabase
        .rpc('check_user_migration_data', { p_email: email })

      if ((migrationCheck as unknown as MigrationCheckResult)?.has_migration_data) {
        // This is a legacy user - show standard invalid password message
        return createApiError('Invalid email or password. Please check your credentials and try again.')
      }
    }

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

export async function setupLegacyUserPassword(formData: FormData): Promise<ApiResponse<object>> {
  try {
    const supabase = await createClient()
    
    // Parse form data
    const email = formData.get('email') as string

    // Validate data
    const validation = PasswordResetSchema.safeParse({ email })
    
    if (!validation.success) {
      return createApiError(validation.error.issues.map(i => i.message).join(', '))
    }

    // Check if this email exists in migration data
    const { data: migrationCheck } = await supabase
      .rpc('check_user_migration_data', { p_email: email })

    if (!(migrationCheck as unknown as MigrationCheckResult)?.has_migration_data) {
      return createApiError('No legacy account found for this email address.')
    }

    // Get migration data
    const { data: migrationData } = await supabase
      .from('user_migration_reference')
      .select('*')
      .eq('email', email)
      .single()

    if (!migrationData) {
      return createApiError('Legacy account data not found.')
    }

    // Check if this legacy user has already been migrated (account already created)
    if (migrationData.migration_status === 'completed' && migrationData.new_user_id) {
      // User already has an account - send regular password reset instead of creating new account
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth-callback`,
      })

      if (resetError) {
        return createApiError('Failed to send password reset email: ' + resetError.message)
      }

      return createApiSuccess({}, 'Password reset email sent! Check your inbox to reset your password and access your migrated account.')
    }

    // User hasn't been migrated yet - create a temporary auth user for password setup
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: Math.random().toString(36).slice(-8), // Temporary password
      options: {
        data: {
          username: migrationData.full_name?.toLowerCase().replace(/\s+/g, '') || 'user',
          full_name: migrationData.full_name || 'User',
          is_legacy_setup: true
        }
      }
    })

    if (authError || !authData.user) {
      // Handle the "user already registered" error more gracefully
      if (authError?.message?.toLowerCase().includes('user already registered') || 
          authError?.message?.toLowerCase().includes('already registered')) {
        // Even though migration status says pending, an account might already exist
        // Fall back to password reset
        
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth-callback`,
        })

        if (resetError) {
          return createApiError('Failed to send password reset email: ' + resetError.message)
        }

        return createApiSuccess({}, 'Password reset email sent! Check your inbox to reset your password.')
      }
      
      return createApiError(authError?.message || 'Failed to create setup account')
    }

    // Send password setup email
    
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth-callback`,
    })

    if (resetError) {
      return createApiError('Failed to send setup email: ' + resetError.message)
    }

    return createApiSuccess({}, 'Password setup email sent! Check your inbox to complete your account setup.')

  } catch (error) {
    console.error('Legacy user setup error:', error)
    return createApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    )
  }
}

interface PasswordUpdateResult {
  migrated?: boolean;
  creditsRestored?: number;
}

export async function updatePassword(formData: FormData): Promise<ApiResponse<PasswordUpdateResult>> {
  try {
    const supabase = await createClient()
    
    // Parse form data
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const isLegacySetup = formData.get('isLegacySetup') === 'true'

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

    // If this is a legacy user setup, trigger migration restoration
    if (isLegacySetup) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: migrationResult } = await supabase
          .rpc('restore_user_data_on_registration', {
            p_auth_user_id: user.id,
            p_email: user.email || ''
          })

        if ((migrationResult as unknown as MigrationRestoreResult)?.success) {
          revalidatePath('/', 'layout')
          return createApiSuccess(
            { migrated: true, creditsRestored: (migrationResult as unknown as MigrationRestoreResult).credits_restored },
            `Welcome back! Your account has been restored with ${(migrationResult as unknown as MigrationRestoreResult).credits_restored || 0} credits.`
          )
        } else {
          return createApiError('Failed to restore legacy account data: ' + (migrationResult as unknown as MigrationRestoreResult)?.message)
        }
      }
    }

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