'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/app/supabase/client';
import { useEbookWriterStore } from '../store/ebook-writer-store';

export function useAutoSave() {
  const { 
    current_ebook, 
    title_options,
    uploaded_documents,
    active_tab,
    generation_progress,
    saveSession 
  } = useEbookWriterStore();
  
  const userIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get user ID on mount
  useEffect(() => {
    const getUserId = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userIdRef.current = user.id;
      }
    };
    getUserId();
  }, []);

  // Auto-save function with debouncing
  const triggerAutoSave = () => {
    if (!userIdRef.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save (1 second delay)
    saveTimeoutRef.current = setTimeout(async () => {
      if (userIdRef.current) {
        console.log('🔄 Auto-saving ebook session...');
        await saveSession(userIdRef.current);
      }
    }, 1000);
  };

  // Watch for changes and trigger auto-save
  useEffect(() => {
    // Only auto-save if we have a topic
    if (current_ebook?.topic) {
      triggerAutoSave();
    }
  }, [
    current_ebook?.topic,
    current_ebook?.title,
    current_ebook?.outline,
    current_ebook?.content,
    current_ebook?.cover,
    title_options,
    uploaded_documents,
    active_tab,
    generation_progress
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return { triggerAutoSave };
}