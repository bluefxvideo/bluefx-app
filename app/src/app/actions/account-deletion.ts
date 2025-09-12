'use server'

import { createAdminClient } from '@/app/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database'

interface DeleteAccountResult {
  success: boolean
  error?: string
}

/**
 * Complete account deletion server action
 * Deletes user and all associated data across all tables
 */
export async function deleteUserAccount(userId: string): Promise<DeleteAccountResult> {
  const supabase = createAdminClient()
  
  try {
    // 1. Delete user-generated content (files, media, etc.)
    // Note: These tables all have foreign keys to auth.users
    const contentTables: (keyof Database['public']['Tables'])[] = [
      // Media generation tables
      'avatar_videos',
      'generated_voices',
      'generated_images',
      'music_history',
      'cinematographer_videos',
      'script_to_video_history',
      
      // Content creation tables
      'ebook_history',
      'ebook_writer_history',
      'ebook_documents',
      'content_multiplier_history',
      
      // Social and publishing
      'social_platform_connections',
      'publishing_queue',
      
      // Credits and metrics
      'credit_usage',
      'credit_transactions',
      'generation_metrics',
      
      // AI predictions
      'ai_predictions',
      
      // Video render progress
      'video_render_progress',
      
      // Voice collections
      'voice_collections'
    ] as const
    
    for (const table of contentTables) {
      console.log(`Deleting user content from ${table}...`)
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', userId)
      
      if (error) {
        console.error(`Failed to delete from ${table}:`, error)
        // Continue with deletion even if some tables fail
      }
    }
    
    // 1b. Delete admin logs where user is either admin or target
    console.log('Deleting admin logs...')
    await supabase
      .from('admin_logs')
      .delete()
      .or(`admin_user_id.eq.${userId},target_user_id.eq.${userId}`)

    // 2. Delete subscription and billing data
    console.log('Deleting subscription data...')
    await supabase
      .from('user_subscriptions')
      .delete()
      .eq('user_id', userId)

    await supabase
      .from('user_credits')
      .delete()
      .eq('user_id', userId)

    // 3. Delete cancellation feedback (references user_subscriptions)
    console.log('Deleting cancellation feedback...')
    await supabase
      .from('cancellation_feedback')
      .delete()
      .eq('user_id', userId)

    // 4. Delete from Supabase Storage (user files)
    console.log('Deleting storage files...')
    try {
      // List all buckets that might contain user files
      const buckets = ['avatars', 'uploads', 'generated-content', 'user-files']
      
      for (const bucketName of buckets) {
        const { data: files } = await supabase
          .storage
          .from(bucketName)
          .list(userId) // Assuming files are organized by user_id folders
        
        if (files && files.length > 0) {
          const filePaths = files.map(file => `${userId}/${file.name}`)
          await supabase.storage.from(bucketName).remove(filePaths)
        }
      }
    } catch (storageError) {
      console.error('Storage deletion error:', storageError)
      // Don't fail the entire deletion for storage errors
    }

    // 5. Delete profile (must be done before auth.users but after all other tables)
    console.log('Deleting profile...')
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)
    
    if (profileError) {
      console.error('Profile deletion error:', profileError)
      throw new Error(`Failed to delete profile: ${profileError.message}`)
    }

    // 6. Finally, delete the user from auth.users
    console.log('Deleting user from auth.users...')
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    
    if (authError) {
      console.error('Auth user deletion failed:', authError)
      throw new Error(`Failed to delete user: ${authError.message}`)
    }

    console.log(`User ${userId} and all associated data deleted successfully`)
    
    // Clear any cached data
    revalidatePath('/')
    
    return { success: true }

  } catch (error) {
    console.error('Account deletion failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Helper function to check if a receipt belongs to a specific user
 */
async function _isReceiptForUser(receipt: string, userId: string): Promise<boolean> {
  const supabase = createAdminClient()
  
  // Check if there's a user with this receipt in their metadata
  const { data: users } = await supabase.auth.admin.listUsers()
  
  return users.users.some(user => 
    user.id === userId && 
    user.user_metadata?.receipt === receipt
  )
}

/**
 * Trigger account deletion from cancellation webhook
 * Called when user cancels their subscription
 */
export async function handleAccountCancellation(email: string): Promise<void> {
  const supabase = createAdminClient()
  
  try {
    // Find user by email
    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users.users.find(u => u.email === email)
    
    if (!user) {
      console.error('User not found for cancellation:', email)
      return
    }

    // Delete the account completely
    const result = await deleteUserAccount(user.id)
    
    if (result.success) {
      console.log(`Account deleted successfully for cancelled user: ${email}`)
    } else {
      console.error(`Failed to delete cancelled account: ${result.error}`)
    }
  } catch (error) {
    console.error('Account cancellation handling failed:', error)
  }
}