'use server';

/**
 * Server action wrapper for fal.ai LTX polling
 * This allows the client-side hook to poll for video completion
 */

import { pollLTXGeneration, PollLTXResult } from './fal-ltx-audio-video';

/**
 * Poll for LTX video generation result
 * Server action that can be called from client components
 */
export async function pollLTXVideoGeneration(requestId: string): Promise<PollLTXResult> {
  return pollLTXGeneration(requestId);
}
