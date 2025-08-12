'use client';

import type { ScriptGenerationResponse } from '@/types/script-generation';

/**
 * Client-side wrapper for script generation service
 * Calls the server action through a proper API route
 */
export async function generateQuickScript(
  idea: string,
  user_id: string,
  options?: {
    tone?: 'professional' | 'casual' | 'educational' | 'dramatic' | 'energetic';
  }
): Promise<ScriptGenerationResponse> {
  try {
    const response = await fetch('/api/generate-script', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idea,
        user_id,
        style: {
          tone: options?.tone || 'professional',
          pacing: 'medium',
          target_duration: 45
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Script generation failed:', error);
    return {
      success: false,
      script: '',
      credits_used: 0,
      error: error instanceof Error ? error.message : 'Failed to generate script'
    };
  }
}