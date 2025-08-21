'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * Content Multiplier Zustand Store
 * Manages multi-platform social media content generation and publishing state
 */

// Platform Types
export type SocialPlatform = 'twitter' | 'x' | 'instagram' | 'tiktok' | 'linkedin' | 'facebook' | 'youtube' | 'google_docs';

export interface PlatformConfig {
  name: string;
  maxLength: number;
  supportsImages: boolean;
  supportsVideos: boolean;
  supportsThreads: boolean;
  recommendedHashtags: number;
  aspectRatios: string[];
  toneStyle: 'professional' | 'casual' | 'engaging' | 'creative';
}

export interface PlatformContent {
  platform: SocialPlatform;
  content: string;
  hashtags: string[];
  mentions: string[];
  images?: string[];
  video?: string;
  scheduled_time?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  character_count: number;
  thread_parts?: string[];
  generated_at: string;
  engagement_score?: number;
  optimization_notes?: string[];
}

export interface ContentVariant {
  id: string;
  original_content: string;
  platform_adaptations: PlatformContent[];
  upload_files: UploadedFile[];
  settings: ContentSettings;
  total_platforms: number;
  status: 'generating' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  size: number;
  mime_type: string;
  transcription?: string; // For audio/video files
  extracted_text?: string; // For documents/PDFs
  uploaded_at: string;
}

export interface ContentSettings {
  tone: 'professional' | 'casual' | 'humorous' | 'inspiring' | 'educational';
  target_audience: string;
  include_hashtags: boolean;
  hashtag_count: number;
  include_mentions: boolean;
  include_cta: boolean;
  cta_type: 'website' | 'signup' | 'download' | 'contact' | 'custom';
  custom_cta?: string;
  preserve_links: boolean;
  auto_schedule: boolean;
  schedule_time?: string;
}

export interface OAuthConnection {
  platform: SocialPlatform;
  connected: boolean;
  username?: string;
  avatar_url?: string;
  expires_at?: string;
  last_connected: string;
  connection_status: 'active' | 'expired' | 'error' | 'disconnected';
}

export interface GenerationProgress {
  current_step: 'input' | 'upload' | 'generating' | 'review' | 'publishing' | 'completed';
  current_platform?: SocialPlatform;
  platforms_completed: SocialPlatform[];
  total_progress: number; // 0-100
  step_progress: number; // 0-100
  is_generating: boolean;
  estimated_time_remaining?: number;
  credits_used: number;
  error_message?: string;
}

export interface PublishingQueue {
  id: string;
  content_variant_id: string;
  platform: SocialPlatform;
  scheduled_time: string;
  status: 'queued' | 'publishing' | 'published' | 'failed' | 'cancelled';
  retry_count: number;
  error_message?: string;
  published_at?: string;
}

// Store State Interface
interface ContentMultiplierState {
  // Current project state
  current_variant: ContentVariant | null;
  original_input: string;
  uploaded_files: UploadedFile[];
  content_settings: ContentSettings;
  generation_progress: GenerationProgress;
  
  // Platform management
  selected_platforms: SocialPlatform[];
  oauth_connections: Record<SocialPlatform, OAuthConnection>;
  platform_configs: Record<SocialPlatform, PlatformConfig>;
  
  // UI State
  active_tab: SocialPlatform | 'input' | 'platforms' | 'review' | 'history';
  active_workflow_tab: 'content' | 'platforms' | 'review';
  sidebar_collapsed: boolean;
  show_preview_panel: boolean;
  show_publishing_queue: boolean;
  
  // History and persistence
  saved_variants: ContentVariant[];
  publishing_queue: PublishingQueue[];
  auto_save_enabled: boolean;
  last_save_timestamp?: string;
  
  // Credits and limits
  available_credits: number;
  credits_estimate: {
    content_adaptation: number;
    image_processing: number;
    video_processing: number;
    publishing_fee: number;
    total_estimated: number;
  };
  
  // Actions
  // Input Management
  setOriginalInput: (content: string) => void;
  uploadFile: (file: File) => Promise<void>;
  removeFile: (fileId: string) => void;
  processUploadedFiles: () => Promise<void>;
  
  // Platform Management
  togglePlatform: (platform: SocialPlatform) => void;
  connectPlatform: (platform: SocialPlatform) => Promise<void>;
  disconnectPlatform: (platform: SocialPlatform) => Promise<void>;
  refreshPlatformConnection: (platform: SocialPlatform) => Promise<void>;
  
  // Content Generation
  generatePlatformContent: () => Promise<void>;
  regeneratePlatformContent: (platform: SocialPlatform) => Promise<void>;
  updatePlatformContent: (platform: SocialPlatform, content: string) => void;
  updatePlatformHashtags: (platform: SocialPlatform, hashtags: string[]) => void;
  
  // Content Settings
  updateContentSettings: (settings: Partial<ContentSettings>) => void;
  resetContentSettings: () => void;
  
  // Publishing
  scheduleContent: (platform: SocialPlatform, scheduledTime?: string) => Promise<void>;
  publishNow: (platform: SocialPlatform) => Promise<void>;
  publishAll: () => Promise<void>;
  cancelScheduled: (queueId: string) => Promise<void>;
  
  // History & Save
  saveCurrentVariant: () => Promise<void>;
  loadVariant: (variantId: string) => Promise<void>;
  deleteVariant: (variantId: string) => Promise<void>;
  duplicateVariant: (variantId: string) => Promise<void>;
  
  // UI State Management
  setActiveTab: (tab: ContentMultiplierState['active_tab']) => void;
  setActiveWorkflowTab: (tab: ContentMultiplierState['active_workflow_tab']) => void;
  toggleSidebar: () => void;
  togglePreviewPanel: () => void;
  togglePublishingQueue: () => void;
  
  // Progress Management
  updateProgress: (updates: Partial<GenerationProgress>) => void;
  resetProgress: () => void;
  
  // Utility Actions
  calculateCreditsEstimate: () => void;
  autoSave: () => Promise<void>;
  clearCurrentProject: () => void;
  
  // Error Handling
  setError: (error: string) => void;
  clearError: () => void;
}

// Platform configurations
const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
  twitter: {
    name: 'Twitter',
    maxLength: 280,
    supportsImages: true,
    supportsVideos: true,
    supportsThreads: true,
    recommendedHashtags: 3,
    aspectRatios: ['16:9', '1:1', '4:5'],
    toneStyle: 'engaging',
  },
  instagram: {
    name: 'Instagram',
    maxLength: 2200,
    supportsImages: true,
    supportsVideos: true,
    supportsThreads: false,
    recommendedHashtags: 8,
    aspectRatios: ['1:1', '4:5', '9:16'],
    toneStyle: 'creative',
  },
  tiktok: {
    name: 'TikTok',
    maxLength: 150,
    supportsImages: false,
    supportsVideos: true,
    supportsThreads: false,
    recommendedHashtags: 5,
    aspectRatios: ['9:16'],
    toneStyle: 'casual',
  },
  linkedin: {
    name: 'LinkedIn',
    maxLength: 3000,
    supportsImages: true,
    supportsVideos: true,
    supportsThreads: false,
    recommendedHashtags: 3,
    aspectRatios: ['16:9', '1:1', '4:5'],
    toneStyle: 'professional',
  },
  facebook: {
    name: 'Facebook',
    maxLength: 63206,
    supportsImages: true,
    supportsVideos: true,
    supportsThreads: false,
    recommendedHashtags: 2,
    aspectRatios: ['16:9', '1:1', '4:5'],
    toneStyle: 'engaging',
  },
  x: {
    name: 'X (Twitter)',
    maxLength: 280,
    supportsImages: true,
    supportsVideos: true,
    supportsThreads: true,
    recommendedHashtags: 3,
    aspectRatios: ['16:9', '1:1', '4:5'],
    toneStyle: 'engaging',
  },
  youtube: {
    name: 'YouTube',
    maxLength: 5000,
    supportsImages: true,
    supportsVideos: true,
    supportsThreads: false,
    recommendedHashtags: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
    toneStyle: 'professional',
  },
};

// Helper function to generate realistic mock platform content
function generateMockPlatformContent(
  platform: SocialPlatform, 
  originalContent: string, 
  config: PlatformConfig, 
  _settings: ContentSettings
): PlatformContent {
  const platformStyles = {
    twitter: {
      prefix: '🧵 ',
      suffix: '\n\nWhat do you think? 💭',
      hashtags: ['#TwitterTips', '#SocialMedia', '#ContentCreator', '#Digital'],
    },
    instagram: {
      prefix: '✨ ',
      suffix: '\n\n💡 Save this post for later!\n📸 Share your thoughts below ⬇️',
      hashtags: ['#Instagram', '#ContentCreator', '#DigitalMarketing', '#SocialMediaTips', '#Inspiration', '#Creative', '#Viral', '#Trending'],
    },
    tiktok: {
      prefix: '🔥 ',
      suffix: '\n\n#fyp #viral',
      hashtags: ['#TikTok', '#Viral', '#ForYouPage', '#Trending', '#Content'],
    },
    linkedin: {
      prefix: '💼 ',
      suffix: '\n\nWhat are your thoughts on this? Share your experience in the comments.\n\n#LinkedIn #Professional',
      hashtags: ['#LinkedIn', '#Professional', '#BusinessTips', '#CareerAdvice'],
    },
    facebook: {
      prefix: '👋 ',
      suffix: '\n\nWhat do you think? Let me know in the comments! 👇',
      hashtags: ['#Facebook', '#Community'],
    },
    x: {
      prefix: '🚀 ',
      suffix: '\n\nThoughts? 💭',
      hashtags: ['#X', '#Twitter', '#SocialMedia', '#Digital'],
    },
    youtube: {
      prefix: '🎥 ',
      suffix: '\n\nDon\'t forget to like and subscribe! 👍',
      hashtags: ['#YouTube', '#Video', '#Content', '#Subscribe', '#Like'],
    },
  };

  const style = platformStyles[platform];
  const maxContentLength = config.maxLength - style.suffix.length - 50; // Buffer for hashtags
  
  let adaptedContent = originalContent;
  
  // Truncate if needed
  if (adaptedContent.length > maxContentLength) {
    adaptedContent = adaptedContent.substring(0, maxContentLength - 3) + '...';
  }
  
  // Add platform-specific styling
  const finalContent = `${style.prefix}${adaptedContent}${style.suffix}`;
  
  // Select appropriate hashtags
  const selectedHashtags = style.hashtags.slice(0, config.recommendedHashtags);
  
  return {
    platform,
    content: finalContent,
    hashtags: selectedHashtags,
    mentions: [],
    status: 'draft',
    character_count: finalContent.length,
    generated_at: new Date().toISOString(),
    optimization_notes: [
      `Optimized for ${config.name} algorithm`,
      `Added ${selectedHashtags.length} relevant hashtags`,
      `Content within ${config.maxLength} character limit`,
      `Tone adapted for ${config.toneStyle} audience`,
    ],
    engagement_score: Math.floor(Math.random() * 30) + 70, // 70-100 range
  };
}

// Initial State
const initialState = {
  current_variant: null,
  original_input: '',
  uploaded_files: [],
  content_settings: {
    tone: 'professional' as const,
    target_audience: 'General audience',
    include_hashtags: true,
    hashtag_count: 5,
    include_mentions: false,
    include_cta: true,
    cta_type: 'website' as const,
    preserve_links: true,
    auto_schedule: false,
  },
  generation_progress: {
    current_step: 'input' as const,
    platforms_completed: [],
    total_progress: 0,
    step_progress: 0,
    is_generating: false,
    credits_used: 0,
  },
  selected_platforms: ['twitter', 'instagram', 'linkedin'] as SocialPlatform[],
  oauth_connections: {} as Record<SocialPlatform, OAuthConnection>,
  platform_configs: PLATFORM_CONFIGS,
  active_tab: 'input' as const,
  active_workflow_tab: 'content' as const,
  sidebar_collapsed: false,
  show_preview_panel: true,
  show_publishing_queue: false,
  saved_variants: [],
  publishing_queue: [],
  auto_save_enabled: true,
  available_credits: 0,
  credits_estimate: {
    content_adaptation: 0,
    image_processing: 0,
    video_processing: 0,
    publishing_fee: 0,
    total_estimated: 0,
  },
};

// Store Implementation
export const useContentMultiplierStore = create<ContentMultiplierState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        // Input Management
        setOriginalInput: (content: string) => {
          set(state => ({
            original_input: content,
            generation_progress: {
              ...state.generation_progress,
              current_step: content ? 'generating' : 'input',
            }
          }));
        },
        
        uploadFile: async (file: File) => {
          const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Mock file upload implementation
          const uploadedFile: UploadedFile = {
            id: fileId,
            name: file.name,
            type: file.type.startsWith('image') ? 'image' : 
                  file.type.startsWith('video') ? 'video' :
                  file.type.startsWith('audio') ? 'audio' : 'document',
            url: URL.createObjectURL(file),
            size: file.size,
            mime_type: file.type,
            uploaded_at: new Date().toISOString(),
          };
          
          set(state => ({
            uploaded_files: [...state.uploaded_files, uploadedFile]
          }));
        },
        
        removeFile: (fileId: string) => {
          set(state => ({
            uploaded_files: state.uploaded_files.filter(f => f.id !== fileId)
          }));
        },
        
        processUploadedFiles: async () => {
          const state = get();
          
          // Process files for transcription/text extraction
          for (const file of state.uploaded_files) {
            if (file.type === 'audio' || file.type === 'video') {
              // Mock transcription
              set(state => ({
                uploaded_files: state.uploaded_files.map(f =>
                  f.id === file.id 
                    ? { ...f, transcription: `Transcribed content from ${file.name}...` }
                    : f
                )
              }));
            }
          }
        },
        
        // Platform Management
        togglePlatform: (platform: SocialPlatform) => {
          set(state => ({
            selected_platforms: state.selected_platforms.includes(platform)
              ? state.selected_platforms.filter(p => p !== platform)
              : [...state.selected_platforms, platform]
          }));
        },
        
        connectPlatform: async (platform: SocialPlatform) => {
          // Mock OAuth connection
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          set(state => ({
            oauth_connections: {
              ...state.oauth_connections,
              [platform]: {
                platform,
                connected: true,
                username: `@user_${platform}`,
                avatar_url: `https://via.placeholder.com/40?text=${platform[0].toUpperCase()}`,
                last_connected: new Date().toISOString(),
                connection_status: 'active',
              }
            }
          }));
        },
        
        disconnectPlatform: async (platform: SocialPlatform) => {
          set(state => ({
            oauth_connections: {
              ...state.oauth_connections,
              [platform]: {
                ...state.oauth_connections[platform],
                connected: false,
                connection_status: 'disconnected',
              }
            }
          }));
        },
        
        refreshPlatformConnection: async (platform: SocialPlatform) => {
          // Mock refresh
          await new Promise(resolve => setTimeout(resolve, 500));
          
          set(state => ({
            oauth_connections: {
              ...state.oauth_connections,
              [platform]: {
                ...state.oauth_connections[platform],
                last_connected: new Date().toISOString(),
                connection_status: 'active',
              }
            }
          }));
        },
        
        // Content Generation
        generatePlatformContent: async () => {
          const state = get();
          if (!state.original_input && state.uploaded_files.length === 0) return;
          
          set(state => ({
            generation_progress: {
              ...state.generation_progress,
              is_generating: true,
              current_step: 'generating',
              total_progress: 0,
            }
          }));
          
          try {
            // Mock content generation for each platform
            const platformAdaptations: PlatformContent[] = [];
            
            for (let i = 0; i < state.selected_platforms.length; i++) {
              const platform = state.selected_platforms[i];
              const config = state.platform_configs[platform];
              
              set(state => ({
                generation_progress: {
                  ...state.generation_progress,
                  current_platform: platform,
                  total_progress: Math.round((i / state.selected_platforms.length) * 80),
                }
              }));
              
              // Simulate AI processing time
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Generate more realistic platform-specific content
              const adaptedContent: PlatformContent = generateMockPlatformContent(
                platform, 
                state.original_input, 
                config, 
                state.content_settings
              );
              
              if (config.supportsThreads && adaptedContent.character_count > config.maxLength) {
                adaptedContent.thread_parts = [
                  adaptedContent.content,
                  'Continued in thread...'
                ];
              }
              
              platformAdaptations.push(adaptedContent);
            }
            
            const variant: ContentVariant = {
              id: `variant_${Date.now()}`,
              original_content: state.original_input,
              platform_adaptations: platformAdaptations,
              upload_files: state.uploaded_files,
              settings: state.content_settings,
              total_platforms: state.selected_platforms.length,
              status: 'completed',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            
            set(state => ({
              current_variant: variant,
              active_tab: state.selected_platforms[0] || 'review', // Auto-navigate to first platform
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                current_step: 'review',
                total_progress: 100,
                step_progress: 100,
                platforms_completed: state.selected_platforms,
                credits_used: state.generation_progress.credits_used + (state.selected_platforms.length * 2),
              }
            }));
            
          } catch (error) {
            set(state => ({
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                error_message: error instanceof Error ? error.message : 'Content generation failed',
              }
            }));
          }
        },
        
        regeneratePlatformContent: async (platform: SocialPlatform) => {
          const state = get();
          if (!state.current_variant) return;
          
          set(state => ({
            generation_progress: {
              ...state.generation_progress,
              is_generating: true,
              current_platform: platform,
            }
          }));
          
          try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const config = state.platform_configs[platform];
            const newContent: PlatformContent = {
              platform,
              content: `Regenerated: ${state.original_input.substring(0, config.maxLength - 50)} #${platform}`,
              hashtags: Array.from({ length: config.recommendedHashtags }, (_, j) => `#new${j + 1}`),
              mentions: [],
              status: 'draft',
              character_count: Math.min(state.original_input.length, config.maxLength),
              generated_at: new Date().toISOString(),
            };
            
            set(state => ({
              current_variant: {
                ...state.current_variant!,
                platform_adaptations: state.current_variant!.platform_adaptations.map(p =>
                  p.platform === platform ? newContent : p
                ),
                updated_at: new Date().toISOString(),
              },
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                credits_used: state.generation_progress.credits_used + 2,
              }
            }));
            
          } catch (error) {
            set(state => ({
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                error_message: error instanceof Error ? error.message : 'Regeneration failed',
              }
            }));
          }
        },
        
        updatePlatformContent: (platform: SocialPlatform, content: string) => {
          set(state => ({
            current_variant: state.current_variant ? {
              ...state.current_variant,
              platform_adaptations: state.current_variant.platform_adaptations.map(p =>
                p.platform === platform 
                  ? { ...p, content, character_count: content.length }
                  : p
              ),
              updated_at: new Date().toISOString(),
            } : null
          }));
        },
        
        updatePlatformHashtags: (platform: SocialPlatform, hashtags: string[]) => {
          set(state => ({
            current_variant: state.current_variant ? {
              ...state.current_variant,
              platform_adaptations: state.current_variant.platform_adaptations.map(p =>
                p.platform === platform ? { ...p, hashtags } : p
              ),
              updated_at: new Date().toISOString(),
            } : null
          }));
        },
        
        // Publishing
        publishNow: async (platform: SocialPlatform) => {
          const state = get();
          if (!state.current_variant) return;
          
          const platformContent = state.current_variant.platform_adaptations.find(p => p.platform === platform);
          if (!platformContent) return;
          
          set(state => ({
            generation_progress: {
              ...state.generation_progress,
              is_generating: true,
              current_platform: platform,
            }
          }));
          
          try {
            // Mock publishing
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            set(state => ({
              current_variant: state.current_variant ? {
                ...state.current_variant,
                platform_adaptations: state.current_variant.platform_adaptations.map(p =>
                  p.platform === platform 
                    ? { ...p, status: 'published' as const }
                    : p
                ),
              } : null,
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                credits_used: state.generation_progress.credits_used + 1,
              }
            }));
            
          } catch (error) {
            set(state => ({
              current_variant: state.current_variant ? {
                ...state.current_variant,
                platform_adaptations: state.current_variant.platform_adaptations.map(p =>
                  p.platform === platform 
                    ? { ...p, status: 'failed' as const }
                    : p
                ),
              } : null,
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                error_message: error instanceof Error ? error.message : 'Publishing failed',
              }
            }));
          }
        },
        
        publishAll: async () => {
          const state = get();
          if (!state.current_variant) return;
          
          for (const platform of state.selected_platforms) {
            if (state.oauth_connections[platform]?.connected) {
              await get().publishNow(platform);
            }
          }
        },
        
        // Content Settings
        updateContentSettings: (settings: Partial<ContentSettings>) => {
          set(state => ({
            content_settings: { ...state.content_settings, ...settings }
          }));
        },
        
        resetContentSettings: () => {
          set({
            content_settings: {
              tone: 'professional',
              target_audience: 'General audience',
              include_hashtags: true,
              hashtag_count: 5,
              include_mentions: false,
              include_cta: true,
              cta_type: 'website',
              preserve_links: true,
              auto_schedule: false,
            }
          });
        },
        
        // UI State Management
        setActiveTab: (tab) => {
          set({ active_tab: tab });
        },
        
        setActiveWorkflowTab: (tab) => {
          set({ active_workflow_tab: tab });
        },
        
        toggleSidebar: () => {
          set(state => ({ sidebar_collapsed: !state.sidebar_collapsed }));
        },
        
        togglePreviewPanel: () => {
          set(state => ({ show_preview_panel: !state.show_preview_panel }));
        },
        
        togglePublishingQueue: () => {
          set(state => ({ show_publishing_queue: !state.show_publishing_queue }));
        },
        
        // Progress Management
        updateProgress: (updates) => {
          set(state => ({
            generation_progress: {
              ...state.generation_progress,
              ...updates,
            }
          }));
        },
        
        resetProgress: () => {
          set({
            generation_progress: {
              current_step: 'input',
              platforms_completed: [],
              total_progress: 0,
              step_progress: 0,
              is_generating: false,
              credits_used: 0,
            }
          });
        },
        
        // Utility Actions
        calculateCreditsEstimate: () => {
          const state = get();
          const platformCount = state.selected_platforms.length;
          const hasImages = state.uploaded_files.some(f => f.type === 'image');
          const hasVideos = state.uploaded_files.some(f => f.type === 'video');
          
          set({
            credits_estimate: {
              content_adaptation: platformCount * 2,
              image_processing: hasImages ? platformCount * 1 : 0,
              video_processing: hasVideos ? platformCount * 3 : 0,
              publishing_fee: platformCount * 1,
              total_estimated: platformCount * 6 + (hasImages ? platformCount : 0) + (hasVideos ? platformCount * 3 : 0),
            }
          });
        },
        
        autoSave: async () => {
          const state = get();
          if (!state.auto_save_enabled || !state.current_variant) return;
          
          try {
            // This would save to the database
            set({
              last_save_timestamp: new Date().toISOString(),
            });
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        },
        
        clearCurrentProject: () => {
          set({
            current_variant: null,
            original_input: '',
            uploaded_files: [],
            generation_progress: {
              current_step: 'input',
              platforms_completed: [],
              total_progress: 0,
              step_progress: 0,
              is_generating: false,
              credits_used: 0,
            },
            active_tab: 'input',
            active_workflow_tab: 'content',
          });
        },
        
        // Error Handling
        setError: (error: string) => {
          set(state => ({
            generation_progress: {
              ...state.generation_progress,
              error_message: error,
            }
          }));
        },
        
        clearError: () => {
          set(state => ({
            generation_progress: {
              ...state.generation_progress,
              error_message: undefined,
            }
          }));
        },
        
        // Placeholder implementations for remaining actions
        scheduleContent: async (_platform: SocialPlatform, _scheduledTime?: string) => {
          // Implementation would schedule content for publishing
        },
        
        cancelScheduled: async (_queueId: string) => {
          // Implementation would cancel scheduled content
        },
        
        saveCurrentVariant: async () => {
          // Implementation would save current variant to database
        },
        
        loadVariant: async (_variantId: string) => {
          // Implementation would load variant from database
        },
        
        deleteVariant: async (_variantId: string) => {
          // Implementation would delete variant from database
        },
        
        duplicateVariant: async (_variantId: string) => {
          // Implementation would duplicate existing variant
        },
      }),
      {
        name: 'content-multiplier-store',
        partialize: (state) => ({
          saved_variants: state.saved_variants,
          auto_save_enabled: state.auto_save_enabled,
          sidebar_collapsed: state.sidebar_collapsed,
          show_preview_panel: state.show_preview_panel,
          content_settings: state.content_settings,
          oauth_connections: state.oauth_connections,
        }),
      }
    ),
    {
      name: 'content-multiplier',
    }
  )
);

// Individual selectors to avoid object creation
export const useContentProgress = () => useContentMultiplierStore((state) => state.generation_progress);
export const usePlatformConnections = () => useContentMultiplierStore((state) => state.oauth_connections || {});
export const useSelectedPlatforms = () => useContentMultiplierStore((state) => state.selected_platforms || []);
export const usePlatformConfigs = () => useContentMultiplierStore((state) => state.platform_configs);
export const useActiveTab = () => useContentMultiplierStore((state) => state.active_tab);
export const useActiveWorkflowTab = () => useContentMultiplierStore((state) => state.active_workflow_tab);
export const useCurrentVariant = () => useContentMultiplierStore((state) => state.current_variant);