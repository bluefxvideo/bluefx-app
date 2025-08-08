import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Legacy database credentials (from MCP configuration)
const supabaseUrl = 'https://trjkxgkbkyzthrgkbwfe.supabase.co';
const supabaseKey = process.env.SUPABASE_LEGACY_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyamt4Z2tia3l6dGhyZ2tid2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAzOTU5NzAsImV4cCI6MjAzNTk3MTk3MH0.SqhFKQ43TKOgZoHJLuTj3DhG5jY9nJJNb6vW2o33-Ds';

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey);
}