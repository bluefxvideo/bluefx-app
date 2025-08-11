'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/supabase/client';
import { getUserCredits } from '@/actions/database/script-video-database';
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
 * State management + orchestrator integration with real user authentication
 */
export function useScriptToVideo() {
  const [credits, setCredits] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [result, setResult] = useState<ScriptToVideoResponse | undefined>();
  const router = useRouter();
  const supabase = createClient();

  // Load user and credits on mount
  useEffect(() => {
    const loadUserAndCredits = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
          const creditResult = await getUserCredits(user.id);
          if (creditResult.success) {
            setCredits(creditResult.credits || 0);
          }
        }
      } catch (error) {
        console.error('Error loading user and credits:', error);
      }
    };

    loadUserAndCredits();
  }, []);

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
    onSuccess: (response) => {
      if (response.success) {
        // Update credits optimistically
        setCredits(prev => prev - response.credits_used);
        setResult(response);
        
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
  }) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    console.log('🎬 Starting basic script video generation for user:', user.id);
    
    const response = await generateBasicScriptVideo(
      scriptText,
      user.id,
      options
    );
    
    if (response.success) {
      setCredits(prev => prev - response.credits_used);
      setResult(response);
      
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
  };

  return {
    // Generation
    generate: generateMutation.mutate,
    generateBasic,
    isGenerating: generateMutation.isPending,
    
    // Editing
    edit: editMutation.mutate,
    isEditing: editMutation.isPending,
    
    // State
    result,
    error: generateMutation.error?.message || editMutation.error?.message,
    credits,
    
    // Actions
    clearResults: () => setResult(undefined),
    
    // Utilities
    calculateEstimatedCredits: (scriptText: string) => {
      return Math.ceil(scriptText.length / 50) * 5 + 10;
    }
  };
}