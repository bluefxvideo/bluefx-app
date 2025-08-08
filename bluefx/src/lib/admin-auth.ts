import { createClient } from '@/app/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Tables } from '@/types/database'

export interface AdminUser {
  user: User
  profile: Tables<'profiles'>
  isAdmin: boolean
}

export interface AdminAuthResult {
  success: boolean
  user?: AdminUser
  error?: string
}

/**
 * Check if the current user is an admin
 * Returns the user data if admin, null if not admin or not authenticated
 */
export async function checkAdminAuth(): Promise<AdminUser | null> {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return null
    }

    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return null
    }

    // Check if user has admin role (checking both role field and username/email for legacy support)
    const isAdmin = profile.role === 'admin' || 
                   profile.username === 'admin' || 
                   user.email === 'contact@bluefx.net'

    if (!isAdmin) {
      return null
    }

    return {
      user,
      profile,
      isAdmin: true
    }
  } catch (error) {
    console.error('Admin auth check error:', error)
    return null
  }
}

/**
 * Require admin authentication - redirects to login if not admin
 * Use this in admin page components
 */
export async function requireAdminAuth(): Promise<AdminUser> {
  const adminUser = await checkAdminAuth()
  
  if (!adminUser) {
    redirect('/login?message=Admin access required')
  }
  
  return adminUser
}

/**
 * Check if user is admin (for middleware use)
 * Returns boolean instead of redirecting
 */
export async function isUserAdmin(): Promise<boolean> {
  const adminUser = await checkAdminAuth()
  return adminUser !== null
}

/**
 * Require admin authentication for API routes
 * Returns result object with success/error instead of redirecting
 */
export async function requireAdminAuthApi(): Promise<AdminAuthResult> {
  try {
    const adminUser = await checkAdminAuth()
    
    if (!adminUser) {
      return {
        success: false,
        error: 'Admin access required'
      }
    }
    
    return {
      success: true,
      user: adminUser
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication error'
    }
  }
}