'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { executeTalkingAvatar, TalkingAvatarRequest, AvatarTemplate, VoiceOption } from '@/actions/tools/talking-avatar';
import { getAvatarTemplates } from '@/actions/database/talking-avatar-database';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

export interface TalkingAvatarState {
  // Current step in wizard (1: Avatar Selection, 2: Voice Generation, 3: Video Generation)
  currentStep: number;
  totalSteps: number;
  
  // Avatar Selection (Step 1)
  avatarTemplates: AvatarTemplate[];
  selectedAvatarTemplate: AvatarTemplate | null;
  customAvatarImage: File | null;
  customAvatarUrl: string | null;
  
  // Voice Generation (Step 2)
  scriptText: string;
  voiceOptions: VoiceOption[];
  selectedVoiceId: string | null;
  voiceAudioUrl: string | null;
  estimatedDuration: number;
  
  // Video Generation (Step 3)
  isGenerating: boolean;
  generatedVideo: { id: string; video_url: string; thumbnail_url?: string; script_text: string; avatar_image_url: string; created_at: string; } | null;
  
  // General state
  isLoading: boolean;
  error: string | null;
  credits: number;
  estimatedCredits: number;
}

export interface UseTalkingAvatarReturn {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  state: TalkingAvatarState;
  loadAvatarTemplates: () => Promise<void>;
  handleAvatarSelection: (template: AvatarTemplate | null, customFile?: File) => Promise<void>;
  handleVoiceGeneration: (voiceId: string, scriptText: string) => Promise<void>;
  handleVideoGeneration: () => Promise<void>;
  resetWizard: () => void;
  goToStep: (step: number) => void;
  clearVoice: () => void;
}

export function useTalkingAvatar(): UseTalkingAvatarReturn {
  const pathname = usePathname();
  
  const getActiveTabFromPath = useCallback(() => {
    if (pathname.includes('/history')) return 'history';
    return 'generate';
  }, [pathname]);

  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const supabase = createClient();
  
  const [state, setState] = useState<TalkingAvatarState>({
    currentStep: 1,
    totalSteps: 3,
    avatarTemplates: [],
    selectedAvatarTemplate: null,
    customAvatarImage: null,
    customAvatarUrl: null,
    scriptText: '',
    voiceOptions: [],
    selectedVoiceId: null,
    voiceAudioUrl: null,
    estimatedDuration: 0,
    isGenerating: false,
    generatedVideo: null,
    isLoading: false,
    error: null,
    credits: 0,
    estimatedCredits: 6, // Base cost for avatar video
  });

  // Update active tab when pathname changes
  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [pathname, getActiveTabFromPath]);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Load avatar templates on mount
  const loadAvatarTemplates = useCallback(async () => {
    if (state.avatarTemplates.length > 0) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const templates = await getAvatarTemplates();
      setState(prev => ({ 
        ...prev, 
        avatarTemplates: templates.map(template => ({
          id: template.id,
          name: template.name,
          category: template.category,
          description: template.description || undefined,
          thumbnail_url: template.thumbnail_url || undefined,
          gender: template.gender || undefined,
          age_range: template.age_range || undefined,
          ethnicity: template.ethnicity || undefined,
          voice_provider: template.voice_provider || undefined,
          voice_id: template.voice_id || undefined,
          preview_video_url: template.preview_video_url || undefined,
          is_active: template.is_active ?? true,
          usage_count: template.usage_count || undefined,
          created_by: template.created_by || undefined,
          created_at: template.created_at || new Date().toISOString(),
          updated_at: template.updated_at || undefined
        })),
        isLoading: false 
      }));
    } catch (error) {
      console.error('Failed to load avatar templates:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load avatar templates',
        isLoading: false 
      }));
      toast.error('Failed to load avatar templates');
    }
  }, [state.avatarTemplates.length]);

  // Step 1: Handle avatar selection
  const handleAvatarSelection = useCallback(async (template: AvatarTemplate | null, customImage?: File) => {
    if (!user) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const request: TalkingAvatarRequest = {
        script_text: state.scriptText,
        avatar_template_id: template?.id,
        avatar_image_url: template?.thumbnail_url,
        custom_avatar_image: customImage || null,
        workflow_step: 'avatar_select',
        user_id: user.id,
      };

      const response = await executeTalkingAvatar(request);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          selectedAvatarTemplate: template || null,
          customAvatarImage: customImage || null,
          customAvatarUrl: response.step_data?.avatar_preview_url || null,
          credits: response.remaining_credits,
          isLoading: false,
        }));
        
        toast.success('Avatar selected successfully');
      } else {
        throw new Error(response.error || 'Avatar selection failed');
      }
    } catch (error) {
      console.error('Avatar selection error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Avatar selection failed',
        isLoading: false 
      }));
      toast.error('Avatar selection failed');
    }
  }, [user, state.scriptText]);

  // Step 2: Handle voice generation
  const handleVoiceGeneration = useCallback(async (voiceId: string, scriptText: string) => {
    if (!user) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const request: TalkingAvatarRequest = {
        script_text: scriptText,
        voice_id: voiceId,
        avatar_image_url: state.customAvatarUrl || state.selectedAvatarTemplate?.thumbnail_url,
        workflow_step: 'voice_generate',
        user_id: user.id,
      };

      const response = await executeTalkingAvatar(request);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          scriptText,
          selectedVoiceId: voiceId,
          voiceOptions: response.voice_options || prev.voiceOptions,
          voiceAudioUrl: response.step_data?.voice_audio_url || null,
          estimatedDuration: response.step_data?.estimated_duration || 0,
          currentStep: 2,
          credits: response.remaining_credits,
          isLoading: false,
        }));
        
        toast.success('Voice generated successfully');
      } else {
        throw new Error(response.error || 'Voice generation failed');
      }
    } catch (error) {
      console.error('Voice generation error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Voice generation failed',
        isLoading: false 
      }));
      toast.error('Voice generation failed');
    }
  }, [user, state.customAvatarUrl, state.selectedAvatarTemplate]);

  // Step 3: Handle video generation
  const handleVideoGeneration = useCallback(async () => {
    if (!user || !state.selectedVoiceId || !state.scriptText) return;
    
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    
    try {
      const request: TalkingAvatarRequest = {
        script_text: state.scriptText,
        voice_id: state.selectedVoiceId,
        avatar_image_url: state.customAvatarUrl || state.selectedAvatarTemplate?.thumbnail_url,
        workflow_step: 'video_generate',
        user_id: user.id,
      };

      const response = await executeTalkingAvatar(request);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          generatedVideo: response.video || null,
          currentStep: 3,
          credits: response.remaining_credits,
          isGenerating: false,
        }));
        
        toast.success('Video generation started! Check your history for updates.');
      } else {
        throw new Error(response.error || 'Video generation failed');
      }
    } catch (error) {
      console.error('Video generation error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Video generation failed',
        isGenerating: false 
      }));
      toast.error('Video generation failed');
    }
  }, [user, state.selectedVoiceId, state.scriptText, state.customAvatarUrl, state.selectedAvatarTemplate]);

  // Reset to step 1
  const resetWizard = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: 1,
      selectedAvatarTemplate: null,
      customAvatarImage: null,
      customAvatarUrl: null,
      scriptText: '',
      selectedVoiceId: null,
      voiceAudioUrl: null,
      generatedVideo: null,
      error: null,
    }));
  }, []);

  // Navigate between steps
  const goToStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  // Clear voice to allow regeneration
  const clearVoice = useCallback(() => {
    setState(prev => ({
      ...prev,
      voiceAudioUrl: null,
      selectedVoiceId: null,
      estimatedDuration: 0,
    }));
  }, []);

  return {
    activeTab,
    setActiveTab,
    state,
    loadAvatarTemplates,
    handleAvatarSelection,
    handleVoiceGeneration,
    handleVideoGeneration,
    resetWizard,
    goToStep,
    clearVoice,
  };
}