import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { getUserCredits } from '@/actions/database/script-video-database';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated', userError }, { status: 401 });
    }

    console.log('🔍 Testing credits for user:', user.id);

    // Test the getUserCredits function
    const creditResult = await getUserCredits(user.id);
    console.log('🔍 getUserCredits result:', creditResult);

    // Also test the RPC directly
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_user_credit_balance', { user_uuid: user.id });
    
    console.log('🔍 Direct RPC result:', { data: rpcData, error: rpcError });

    return NextResponse.json({
      user_id: user.id,
      getUserCredits_result: creditResult,
      direct_rpc_result: { data: rpcData, error: rpcError },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test credits error:', error);
    return NextResponse.json({ 
      error: 'Server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}