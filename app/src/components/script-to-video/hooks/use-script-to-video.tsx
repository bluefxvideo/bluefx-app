'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/supabase/client';
import { useCredits } from '@/hooks/useCredits';
import type { 
  ScriptToVideoRequest, 
  ScriptToVideoResponse 
} from '@/actions/tools/script-to-video-orchestrator';
import { 
  generateScriptToVideo,
  generateBasicScriptVideo 
} from '@/actions/tools/script-to-video-orchestrator';

/**
 * Script-to-Video Hook
 * State management + orchestrator integration with standardized credit system
 */
export function useScriptToVideo() {
  const { credits, refreshCredits } = useCredits(); // Use standardized hook
  const [user, setUser] = useState<any>(null);
  const [result, setResult] = useState<ScriptToVideoResponse | undefined>();
  const router = useRouter();
  const supabase = createClient();
  
  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('script-to-video-result');
      if (saved) {
        const { result: savedResult, timestamp } = JSON.parse(saved);
        // Only restore if saved within last hour
        if (Date.now() - timestamp < 3600000) {
          setResult(savedResult);
          console.log('🔄 Restored previous generation from localStorage');
          console.log('📊 localStorage timeline_data:', savedResult?.timeline_data);
          
          // CRITICAL: Also load into editor store when restoring from localStorage
          const { useVideoEditorStore } = require('../store/video-editor-store');
          useVideoEditorStore.getState().loadGenerationResults(savedResult);
        }
      }
    } catch (e) {
      console.error('Failed to restore from localStorage:', e);
    }
  }, []);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        console.log('🔄 Loading user...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('❌ Auth error:', userError);
          return;
        }
        
        if (user) {
          console.log('✅ User loaded in useEffect:', user.id);
          setUser(user);
        } else {
          console.log('❌ No user found in useEffect');
        }
      } catch (error) {
        console.error('❌ Error loading user:', error);
      }
    };

    loadUser();
  }, [supabase]);

  // Main generation mutation
  const generateMutation = useMutation({
    mutationFn: async (request: ScriptToVideoRequest) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Pre-validation
      const estimatedCredits = Math.ceil(request.script_text.length / 50) * 5 + 10;
      if (credits < estimatedCredits) {
        throw new Error(`Insufficient credits. Need ${estimatedCredits}, have ${credits}`);
      }
      
      // Call AI orchestrator with real user ID
      return await generateScriptToVideo({
        ...request,
        user_id: user.id
      });
    },
    onSuccess: async (response) => {
      if (response.success) {
        // Refresh credits from server to get accurate count
        await refreshCredits();
        setResult(response);
        
        // Save to localStorage immediately to prevent data loss
        try {
          localStorage.setItem('script-to-video-result', JSON.stringify({
            result: response,
            timestamp: Date.now(),
            script: scriptText
          }));
          console.log('💾 Saved generation result to localStorage');
        } catch (e) {
          console.error('Failed to save to localStorage:', e);
        }
        
        // Load results into editor store
        const { useVideoEditorStore } = require('../store/video-editor-store');
        useVideoEditorStore.getState().loadGenerationResults(response);
        
        // Auto-switch to Editor tab after successful generation
        router.push('/dashboard/script-to-video/editor');
        
        // TODO: Invalidate queries for real-time updates
        // queryClient.invalidateQueries({ queryKey: ['script-video-results'] });
      }
    }
  });

  // Edit mutation for editor functionality
  const editMutation = useMutation({
    mutationFn: async (editData: {
      type: string;
      data: unknown;
    }) => {
      // TODO: Implement edit orchestrator integration
      console.log('Edit operation:', editData);
      return { success: true };
    },
    onSuccess: (response) => {
      if (response.success) {
        console.log('Edit completed successfully');
      }
    }
  });

  // Basic generation function
  const generateBasic = async (scriptText: string, options?: {
    quality?: 'draft' | 'standard' | 'premium';
    aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3';
    video_style?: {
      tone?: 'professional' | 'casual' | 'educational' | 'dramatic' | 'energetic';
      pacing?: 'slow' | 'medium' | 'fast';
      visual_style?: 'realistic' | 'artistic' | 'minimal' | 'dynamic';
    };
    voice_settings?: {
      voice_id?: 'anna' | 'eric' | 'felix' | 'oscar' | 'nina' | 'sarah';
      speed?: 'slower' | 'normal' | 'faster';
      emotion?: 'neutral' | 'excited' | 'calm' | 'confident' | 'authoritative';
    };
    was_script_generated?: boolean;
    original_idea?: string;
  }) => {
    // Get the current user, either from state or fetch fresh
    let currentUserId = user?.id;
    console.log('🔍 generateBasic - Current user state:', { user: user?.id, userObject: !!user });
    
    if (!currentUserId) {
      console.log('🔄 User not loaded, trying alternative approach...');
      
      // Try getting session instead of user - sometimes more reliable
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('🔍 Session response:', { session: session?.user?.id, error });
        
        if (error) {
          console.error('❌ Session error:', error);
          throw new Error(`Authentication failed: ${error.message}`);
        }
        
        if (!session?.user?.id) {
          console.error('❌ No session found');
          throw new Error('User not authenticated - please log in again');
        }
        
        currentUserId = session.user.id;
        setUser(session.user);
        console.log('✅ User loaded from session:', currentUserId);
      } catch (error) {
        console.error('🚨 Failed to get session:', error);
        throw error;
      }
    }

    console.log('🎬 Starting basic script video generation for user:', currentUserId);
    console.log('🎬 Generation options:', options);
    console.log('🎬 Script length:', scriptText.length);
    
    try {
      const response = await generateBasicScriptVideo(
        scriptText,
        currentUserId,
        options
      );
      console.log('🎬 Raw response from orchestrator:', response);
      
      if (response.success) {
        console.log('🎉 Generation successful!', {
          segments_count: response.segments?.length || 0,
          images_count: response.generated_images?.length || 0,
          has_audio: !!response.audio_url,
          video_id: response.video_id
        });
        
        // Refresh credits from server
        await refreshCredits();
        setResult(response);
        
        // Save to localStorage immediately
        try {
          localStorage.setItem('script-to-video-result', JSON.stringify({
            result: response,
            timestamp: Date.now(),
            script: scriptText
          }));
          console.log('💾 Saved generation result to localStorage');
        } catch (e) {
          console.error('Failed to save to localStorage:', e);
        }
        
        // Load results into editor store
        const { useVideoEditorStore } = require('../store/video-editor-store');
        useVideoEditorStore.getState().loadGenerationResults(response);
        
        // Auto-redirect to editor tab 
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/dashboard/script-to-video/editor';
          }
        }, 1000);
      } else {
        throw new Error(response.error || 'Generation failed');
      }
      
      return response;
    } catch (error) {
      console.error('🚨 Error in generateBasicScriptVideo:', error);
      throw error;
    }
  };

  // Use refreshCredits from the hook directly

  return {
    // Generation
    generate: generateMutation.mutate,
    generateBasic,
    isGenerating: generateMutation.isPending,
    
    // User state
    isUserLoaded: !!user?.id,
    user,
    
    // Editing
    edit: editMutation.mutate,
    isEditing: editMutation.isPending,
    
    // State
    result,
    error: generateMutation.error?.message || editMutation.error?.message,
    credits,
    
    // Actions
    clearResults: () => setResult(undefined),
    reloadCredits: refreshCredits, // Use standardized refresh
    
    // Utilities
    calculateEstimatedCredits: (scriptText: string) => {
      return Math.ceil(scriptText.length / 50) * 5 + 10;
    }
  };
}