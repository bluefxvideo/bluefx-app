'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateLogo, LogoMachineRequest, LogoMachineResponse } from '@/actions/tools/logo-machine';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';

/**
 * Custom hook for logo machine functionality
 * Integrates AI orchestrator with React Query and real-time updates
 */
export function useLogoMachine() {
  const [credits, setCredits] = useState(100); // Mock credits - replace with real credit hook
  const [result, setResult] = useState<LogoMachineResponse | undefined>();
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
    mutationFn: async (request: LogoMachineRequest) => {
      // Authentication check
      if (!user?.id) {
        throw new Error('User must be authenticated to generate logos');
      }

      // Pre-validation
      const estimatedCredits = calculateEstimatedCredits(request);
      if (credits < estimatedCredits) {
        throw new Error(`Insufficient credits. Need ${estimatedCredits}, have ${credits}`);
      }
      
      console.log('🎨 Calling Logo AI Orchestrator with request:', request);
      
      // Call AI orchestrator
      const response = await generateLogo({
        ...request,
        user_id: user.id
      });
      
      console.log('✅ Logo AI Orchestrator response:', response);
      return response;
    },
    onMutate: async (request) => {
      // Optimistic UI - show immediate loading state
      const optimisticResult: LogoMachineResponse = {
        success: true,
        prediction_id: 'pending',
        batch_id: `opt_${Date.now()}`,
        credits_used: calculateEstimatedCredits(request),
        generation_time_ms: 0
      };
      
      setResult(optimisticResult);
      console.log('🚀 Optimistic UI: Starting logo generation with batch_id:', optimisticResult.batch_id);
      
      return { optimisticResult };
    },
    onSuccess: (response, _variables, _context) => {
      if (response.success) {
        // Update credits optimistically
        setCredits(prev => prev - response.credits_used);
        
        // Update result with actual prediction details
        setResult(prev => ({
          ...response,
          batch_id: prev?.batch_id || response.batch_id // Keep optimistic batch_id
        }));
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['user-logos'] });
        queryClient.invalidateQueries({ queryKey: ['user-credits'] });
        
        console.log('🎉 Logo generation successful:', {
          prediction_id: response.prediction_id,
          batch_id: response.batch_id,
          credits_used: response.credits_used,
          company_name: response.logo?.company_name,
          generation_time: response.generation_time_ms
        });
      }
    },
    onError: (error) => {
      console.error('❌ Logo generation failed:', error);
    }
  });

  // Real-time updates (STANDARD pattern)
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    
    console.log('📡 Setting up real-time updates for logo user:', userId);
    
    const channel = supabase
      .channel(`user_${userId}_logos`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'logo_history',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('📨 Real-time logo update received:', payload);
        
        // Direct result update for immediate UI feedback
        if (payload.new && payload.new.batch_id) {
          // Check if this result belongs to current generation
          if (result?.batch_id === payload.new.batch_id) {
            console.log('🎯 Updating current result with new logo');
            setResult(prev => {
              if (!prev) return prev;
              
              const newLogo = {
                id: payload.new.id,
                url: payload.new.logo_url,
                company_name: payload.new.company_name,
                style: payload.new.settings?.style || 'modern',
                batch_id: payload.new.batch_id,
              };
              
              return {
                ...prev,
                logo: newLogo
              };
            });
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ['logo-results'] });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_credits',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('💳 Credit update received:', payload);
        if (payload.new && typeof payload.new.credits === 'number') {
          setCredits(payload.new.credits);
        }
      })
      .subscribe();
      
    return () => {
      console.log('🔌 Cleaning up logo real-time subscriptions');
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
 * Calculate estimated credits for a logo request
 * Matches the logic in the AI orchestrator
 */
function calculateEstimatedCredits(request: LogoMachineRequest): number {
  // Logo generation: 3 credits, Logo recreation: 4 credits
  return request.workflow_intent === 'recreate' ? 4 : 3;
}