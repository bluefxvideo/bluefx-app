import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/supabase/server';

/**
 * Credit Renewal Cron Job
 *
 * Runs daily to renew credits for users whose period_end has passed.
 * Only renews for users with active subscriptions.
 *
 * This ensures users get their monthly 600 credits even if they
 * haven't used a tool (which would trigger on-demand renewal).
 *
 * Triggered by Vercel Cron (daily at midnight UTC).
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('Starting credit renewal cron job...');

    // Auth check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.warn('Unauthorized credit renewal cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Find all users with expired credit periods who have active subscriptions
    const { data: expiredUsers, error: queryError } = await supabase
      .from('user_credits')
      .select(`
        user_id,
        total_credits,
        used_credits,
        bonus_credits,
        available_credits,
        period_end
      `)
      .lt('period_end', new Date().toISOString());

    if (queryError) {
      console.error('Failed to query expired credits:', queryError);
      return NextResponse.json({
        success: false,
        error: queryError.message,
      }, { status: 500 });
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('No users need credit renewal');
      return NextResponse.json({
        success: true,
        message: 'No users need renewal',
        stats: { users_checked: 0, users_renewed: 0, errors: 0 },
        processing_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }

    // Filter to only users with active subscriptions
    const userIds = expiredUsers.map(u => u.user_id);
    const { data: activeSubscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('user_id, credits_per_month, plan_type')
      .in('user_id', userIds)
      .eq('status', 'active');

    if (subError) {
      console.error('Failed to query subscriptions:', subError);
      return NextResponse.json({
        success: false,
        error: subError.message,
      }, { status: 500 });
    }

    const activeUserMap = new Map(
      (activeSubscriptions || []).map(s => [s.user_id, s])
    );

    let renewed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const user of expiredUsers) {
      const subscription = activeUserMap.get(user.user_id);

      if (!subscription) {
        // No active subscription - skip renewal
        skipped++;
        continue;
      }

      const targetCredits = subscription.credits_per_month || 600;

      try {
        // Call the topup RPC which preserves bonus_credits
        const { data: topupResult, error: topupError } = await supabase
          .rpc('topup_user_credits', {
            p_user_id: user.user_id,
            p_target_credits: targetCredits,
          });

        if (topupError) {
          console.error(`Failed to renew credits for ${user.user_id}:`, topupError);
          errors.push(`${user.user_id}: ${topupError.message}`);
          continue;
        }

        if (topupResult?.success) {
          renewed++;
          console.log(
            `Renewed credits for user ${user.user_id}: ` +
            `${targetCredits} credits (bonus: ${topupResult.bonus_credits})`
          );
        } else {
          errors.push(`${user.user_id}: ${topupResult?.error || 'Unknown error'}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${user.user_id}: ${msg}`);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `Credit renewal cron completed in ${processingTime}ms: ` +
      `${renewed} renewed, ${skipped} skipped (no active sub), ${errors.length} errors`
    );

    return NextResponse.json({
      success: true,
      message: 'Credit renewal completed',
      stats: {
        users_checked: expiredUsers.length,
        users_renewed: renewed,
        users_skipped: skipped,
        errors: errors.length,
        processing_time_ms: processingTime,
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Credit renewal cron failed:', error);

    return NextResponse.json({
      success: false,
      error: 'Credit renewal cron failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
