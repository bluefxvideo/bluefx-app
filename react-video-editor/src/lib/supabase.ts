import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized Supabase client for the React Video Editor
// This connects to the SAME database as the main app
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storageKey: 'bluefx-editor-auth', // Different key from main app
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      }
    });
  }
  return _supabase;
}

// Export getter function for supabase client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  }
});

// Helper to get current user
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Not authenticated');
  }
  return user;
}

// Helper to check user credits
export async function checkUserCredits(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_credits')
    .select('available_credits')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('Failed to check credits');
  }

  return data.available_credits;
}

// Helper to deduct credits
export async function deductCredits(userId: string, amount: number, action: string) {
  // First check if user has enough credits
  const credits = await checkUserCredits(userId);
  if (credits < amount) {
    throw new Error('Insufficient credits');
  }

  // Deduct credits
  const { error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_action: action
  });

  if (error) {
    throw new Error('Failed to deduct credits');
  }

  return true;
}