const { createClient } = require('@supabase/supabase-js');

// Legacy database connection
const legacySupabase = createClient(
  'https://trjkxgkbkyzthrgkbwfe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyamt4Z2tia3l6dGhyZ2tid2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1NDIzNzIsImV4cCI6MjA1ODExODM3Mn0.6IByqyY3tcNUxF509FCfXX0EaI7GDzE3IRFdCbs5z8k'
);

async function checkScoreHistory() {
  console.log('🔍 Checking score_history table for daily data points...');
  
  // Check if score_history has data
  const { data: scoreData, error } = await legacySupabase
    .from('score_history')
    .select('*')
    .eq('product_name', 'MITOLYN')
    .order('recorded_at', { ascending: true });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 Found ${scoreData?.length || 0} data points for MITOLYN`);
  
  if (scoreData && scoreData.length > 0) {
    console.log('📅 Date range:', scoreData[0].recorded_at, 'to', scoreData[scoreData.length - 1].recorded_at);
    console.log('📈 First 5 records:', scoreData.slice(0, 5));
    console.log('📉 Last 5 records:', scoreData.slice(-5));
  }
}

checkScoreHistory();