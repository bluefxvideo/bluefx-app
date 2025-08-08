'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateThumbnails, ThumbnailMachineRequest, ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { useCredits } from '@/hooks/useCredits';

/**
 * Custom hook for thumbnail machine functionality
 * Integrates AI orchestrator with React Query and real-time updates
 */
export function useThumbnailMachine() {
  const { credits } = useCredits(); // Use real credits hook
  const [result, setResult] = useState<ThumbnailMachineResponse | undefined>();
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription?.unsubscribe();
  }, [supabase.auth]);

  // AI Orchestrator integration
  const generateMutation = useMutation({
    mutationFn: async (request: ThumbnailMachineRequest) => {
      // Authentication check
      if (!user?.id) {
        throw new Error('User must be authenticated to generate thumbnails');
      }

      // Pre-validation
      const estimatedCredits = calculateEstimatedCredits(request);
      const availableCredits = credits?.available_credits || 0;
      if (availableCredits < estimatedCredits) {
        throw new Error(`Insufficient credits. Need ${estimatedCredits}, have ${availableCredits}`);
      }
      
      console.log('🤖 Calling AI Orchestrator with request:', request);
      
      // Call AI orchestrator
      const response = await generateThumbnails({
        ...request,
        user_id: user.id
      });
      
      console.log('✅ AI Orchestrator response:', response);
      return response;
    },
    onMutate: async (request) => {
      // Optimistic UI - show immediate loading state
      const optimisticResult: ThumbnailMachineResponse = {
        success: true,
        prediction_id: 'pending',
        batch_id: `opt_${Date.now()}`,
        credits_used: calculateEstimatedCredits(request),
        generation_time_ms: 0,
        thumbnails: [] // Empty initially, will be populated via real-time
      };
      
      setResult(optimisticResult);
      console.log('🚀 Optimistic UI: Starting generation with batch_id:', optimisticResult.batch_id);
      
      return { optimisticResult };
    },
    onSuccess: (response, variables, context) => {
      if (response.success) {
        // Credits are now managed by useCredits hook
        
        // Update result with actual prediction details
        setResult(prev => ({
          ...response,
          batch_id: prev?.batch_id || response.batch_id // Keep optimistic batch_id
        }));
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['user-thumbnails'] });
        queryClient.invalidateQueries({ queryKey: ['user-credits'] });
        
        console.log('🎉 Generation successful:', {
          prediction_id: response.prediction_id,
          batch_id: response.batch_id,
          credits_used: response.credits_used,
          generation_time: response.generation_time_ms
        });
      }
    },
    onError: (error) => {
      console.error('❌ Generation failed:', error);
    }
  });

  // Real-time updates (STANDARD pattern)
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    
    console.log('📡 Setting up real-time updates for user:', userId);
    
    const channel = supabase
      .channel(`user_${userId}_thumbnails`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'thumbnail_results',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('📨 Real-time update received:', payload);
        
        // Direct result update for immediate UI feedback
        if (payload.new && payload.new.batch_id) {
          // Check if this result belongs to current generation
          if (result?.batch_id === payload.new.batch_id) {
            console.log('🎯 Updating current result with new thumbnail');
            setResult(prev => {
              if (!prev) return prev;
              
              const newThumbnail = {
                id: payload.new.id,
                url: payload.new.image_url,
                variation_index: payload.new.variation_index,
                batch_id: payload.new.batch_id,
              };
              
              return {
                ...prev,
                thumbnails: [...(prev.thumbnails || []), newThumbnail]
              };
            });
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ['thumbnail-results'] });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_credits',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('💳 Credit update received:', payload);
        // Credits are now managed by useCredits hook
      })
      .subscribe();
      
    return () => {
      console.log('🔌 Cleaning up real-time subscriptions');
      supabase.removeChannel(channel);
    };
  }, [queryClient, supabase, result?.batch_id, user?.id]);

  // Clear results function
  const clearResults = () => {
    setResult(undefined);
  };

  return {
    // Main function
    generate: generateMutation.mutate,
    
    // States
    isGenerating: generateMutation.isPending,
    result,
    error: generateMutation.error?.message,
    credits,
    
    // Utilities
    clearResults,
    
    // Metadata
    isSuccess: generateMutation.isSuccess,
    isError: generateMutation.isError,
  };
}

/**
 * Calculate estimated credits for a request
 * Matches the logic in the AI orchestrator
 */
function calculateEstimatedCredits(request: ThumbnailMachineRequest): number {
  let credits = 0;
  
  // Core thumbnail generation (2 credits per thumbnail)
  credits += (request.num_outputs || 4) * 2;
  
  // Face swap (3 credits per target)
  if (request.face_swap) {
    const targetsCount = request.face_swap.apply_to_all ? (request.num_outputs || 4) : 1;
    credits += targetsCount * 3;
  }
  
  // Title generation (1 credit)
  if (request.generate_titles) {
    credits += 1;
  }
  
  return credits;
}