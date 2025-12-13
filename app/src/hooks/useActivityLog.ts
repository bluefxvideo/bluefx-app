'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook to automatically log tool visits
 * Call this at the top of any tool page to log when users visit
 *
 * @param toolName - The tool identifier (e.g., 'voice-over', 'viral-trends')
 * @param options - Optional configuration
 *
 * @example
 * // In a tool page component:
 * useActivityLog('voice-over');
 *
 * // With metadata:
 * useActivityLog('voice-over', { metadata: { source: 'sidebar' } });
 */
export function useActivityLog(
  toolName: string,
  options?: {
    action?: string;
    metadata?: Record<string, unknown>;
    enabled?: boolean;
  }
) {
  const hasLogged = useRef(false);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled || hasLogged.current) return;

    // Mark as logged immediately to prevent duplicate calls
    hasLogged.current = true;

    // Fire-and-forget: dynamically import and call the action
    // This ensures the app never crashes even if the action fails
    (async () => {
      try {
        const { logActivity } = await import('@/actions/activity-log');
        await logActivity(toolName, options?.action || 'visit', options?.metadata);
      } catch (err) {
        // Silently fail - activity logging should never break the app
        console.warn('Activity logging failed:', err);
      }
    })();
  }, [toolName, options?.action, options?.metadata, enabled]);
}

/**
 * Function to manually log an activity action
 * Use this for specific actions like 'generate', 'export', etc.
 *
 * @example
 * // Log when user generates content
 * await logToolAction('voice-over', 'generate', { voiceId: 'xyz' });
 */
export async function logToolAction(
  toolName: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await logActivity(toolName, action, metadata);
  } catch (err) {
    console.error('Failed to log tool action:', err);
  }
}
