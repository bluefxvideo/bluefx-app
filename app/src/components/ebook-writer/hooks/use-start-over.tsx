'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useEbookWriterStore } from '../store/ebook-writer-store';

/**
 * Shared hook for "Start Over" functionality
 * Eliminates duplicate implementation across components
 */
export function useStartOver() {
  const router = useRouter();
  const { clearCurrentProject, setActiveTab } = useEbookWriterStore();

  const startOver = useCallback(async () => {
    if (!confirm('Are you sure you want to start over? This will clear all progress and delete your session.')) {
      return;
    }

    try {
      // Get user ID from Supabase
      const { createClient } = await import('@/app/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await clearCurrentProject(user.id);
        setActiveTab('topic');
        router.push('/dashboard/ebook-writer');
      } else {
        console.warn('No user found for clearing session');
      }
    } catch (error) {
      console.error('Error starting over:', error);
    }
  }, [clearCurrentProject, setActiveTab, router]);

  return { startOver };
}