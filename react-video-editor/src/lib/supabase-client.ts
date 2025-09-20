import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and key from environment or main app
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create client only if we have credentials
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Simple helper to get auth token
export function getAuthToken(): string | null {
  // Try to get from URL params first
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');

  if (tokenFromUrl) {
    // Store it for future use
    localStorage.setItem('editor-auth-token', tokenFromUrl);
    return tokenFromUrl;
  }

  // Otherwise get from localStorage
  return localStorage.getItem('editor-auth-token');
}

// Simple helper to check credits
export async function getUserCredits(userId: string): Promise<number> {
  if (!supabase) return 0;

  const { data } = await supabase
    .from('user_credits')
    .select('available_credits')
    .eq('user_id', userId)
    .single();

  return data?.available_credits || 0;
}