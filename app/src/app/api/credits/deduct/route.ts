import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credits, service_type } = body;

    if (!credits || credits <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid credit amount' },
        { status: 400 }
      );
    }

    // Use the RPC function to deduct credits atomically
    const { data, error } = await supabase.rpc('deduct_user_credits', {
      p_user_id: user.id,
      p_amount: credits,
      p_operation: service_type || 'video_analyzer',
      p_metadata: { source: 'api' },
    });

    if (error) {
      console.error('Credit deduction RPC error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Check if deduction was successful
    if (data && !data.success) {
      return NextResponse.json(
        { success: false, error: data.error || 'Insufficient credits' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      remaining_credits: data?.remaining_credits,
    });

  } catch (error) {
    console.error('Credit deduction error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
