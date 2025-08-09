'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
 * State management + orchestrator integration following thumbnail-machine pattern
 */
export function useScriptToVideo() {
  const [credits, setCredits] = useState(100); // Demo credits
  const [result, setResult] = useState<ScriptToVideoResponse | undefined>();

  // Main generation mutation
  const generateMutation = useMutation({
    mutationFn: async (request: ScriptToVideoRequest) => {
      // Pre-validation
      const estimatedCredits = Math.ceil(request.script_text.length / 50) * 5 + 10;
      if (credits < estimatedCredits) {
        throw new Error(`Insufficient credits. Need ${estimatedCredits}, have ${credits}`);
      }
      
      // Call AI orchestrator
      return await generateScriptToVideo({
        ...request,
        user_id: 'demo-user' // Will be replaced with actual user ID
      });
    },
    onSuccess: (response) => {
      if (response.success) {
        // Update credits optimistically
        setCredits(prev => prev - response.credits_used);
        setResult(response);
        
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
    const response = await generateBasicScriptVideo(
      scriptText,
      'demo-user',
      options
    );
    
    if (response.success) {
      setCredits(prev => prev - response.credits_used);
      setResult(response);
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