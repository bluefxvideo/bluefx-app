import { NextRequest, NextResponse } from 'next/server';
import { pollHedraGenerations } from '@/actions/models/hedra-polling';

/**
 * Hedra Polling Cron Job Endpoint
 * 
 * This endpoint should be called periodically (e.g., every 30 seconds) to check
 * the status of pending Hedra video generations and process completions.
 * 
 * Can be triggered by:
 * - Vercel Cron Jobs
 * - External cron services
 * - Manual calls for testing
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    console.log('⏰ Starting Hedra polling cron job...');
    
    // Optional: Add authentication for cron jobs
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.warn('🚨 Unauthorized cron job request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Execute polling
    const result = await pollHedraGenerations();
    
    const processingTime = Date.now() - startTime;
    console.log(`⏰ Hedra polling cron completed in ${processingTime}ms`);

    return NextResponse.json({
      success: result.success,
      message: 'Hedra polling completed',
      stats: {
        jobs_checked: result.jobs_checked,
        completions_processed: result.completions_processed,
        errors_count: result.errors.length,
        processing_time_ms: processingTime,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('🚨 Hedra polling cron failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Polling cron job failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * POST endpoint for manual polling triggers
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    if (body.action === 'poll_now') {
      return GET(request);
    } else if (body.action === 'check_specific' && body.generation_id) {
      // Check specific generation
      const { checkSpecificGeneration } = await import('@/actions/models/hedra-polling');
      const result = await checkSpecificGeneration(body.generation_id);
      
      return NextResponse.json({
        success: result.success,
        generation_id: body.generation_id,
        status: result.status,
        video_url: result.videoUrl,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Request failed',
    }, { status: 500 });
  }
}