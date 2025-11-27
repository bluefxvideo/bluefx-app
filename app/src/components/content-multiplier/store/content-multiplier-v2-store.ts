'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * Content Multiplier 2.0 Zustand Store
 * Manages the new simplified 3-step wizard workflow for social media posting
 */

// ============================================================================
// TYPES
// ============================================================================

export type SocialPlatform = 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'linkedin' | 'facebook';

export type MainTab = 'create' | 'scheduled' | 'posted' | 'accounts';

export type WizardStep = 1 | 2 | 3; // 1=Upload, 2=Review, 3=Schedule

export type PostStatus = 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed' | 'cancelled';

export type ScheduleOption = 'now' | 'scheduled' | 'best_time';

export type YouTubePrivacyStatus = 'public' | 'unlisted' | 'private';

// Platform-specific content configuration
export interface PlatformConfig {
  id: SocialPlatform;
  name: string;
  icon: string;
  maxCaptionLength: number;
  maxHashtags: number;
  supportsTags?: boolean; // YouTube
  supportsTitle?: boolean; // YouTube
  supportsDescription?: boolean; // YouTube
  color: string;
}

// Generated content for a specific platform
export interface PlatformGeneratedContent {
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  title?: string; // YouTube only
  description?: string; // YouTube only
  tags?: string[]; // YouTube only
  characterCount: number;
  isApproved: boolean;
  isEdited: boolean;
}

// Scheduled post from database
export interface ScheduledPost {
  id: string;
  userId: string;
  videoUrl: string;
  videoThumbnailUrl?: string;
  originalDescription: string;
  platform: SocialPlatform;
  generatedContent: PlatformGeneratedContent;
  scheduledFor?: string;
  status: PostStatus;
  platformPostId?: string;
  platformPostUrl?: string;
  errorMessage?: string;
  batchId?: string;
  createdAt: string;
  postedAt?: string;
}

// Connected social account
export interface SocialAccount {
  platform: SocialPlatform;
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  expiresAt?: string;
  connectionStatus: 'active' | 'expired' | 'error' | 'disconnected';
  lastConnected?: string;
}

// Schedule time per platform
export interface PlatformSchedule {
  platform: SocialPlatform;
  scheduledTime: string;
  isBestTime: boolean;
}

// Draft state for auto-save
export interface DraftState {
  id?: string;
  videoFile?: File;
  videoUrl?: string;
  videoThumbnailUrl?: string;
  originalDescription: string;
  originalTranscript?: string;
  selectedPlatforms: SocialPlatform[];
  platformContent: Record<SocialPlatform, PlatformGeneratedContent>;
  currentStep: WizardStep;
  lastSavedAt?: string;
}

// ============================================================================
// PLATFORM CONFIGURATIONS
// ============================================================================

export const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'tiktok',
    maxCaptionLength: 2200,
    maxHashtags: 5,
    color: '#000000',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    icon: 'instagram',
    maxCaptionLength: 2200,
    maxHashtags: 30,
    color: '#E4405F',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    icon: 'youtube',
    maxCaptionLength: 100, // Title
    maxHashtags: 15, // Tags
    supportsTags: true,
    supportsTitle: true,
    supportsDescription: true,
    color: '#FF0000',
  },
  twitter: {
    id: 'twitter',
    name: 'Twitter/X',
    icon: 'twitter',
    maxCaptionLength: 280,
    maxHashtags: 3,
    color: '#1DA1F2',
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'linkedin',
    maxCaptionLength: 3000,
    maxHashtags: 5,
    color: '#0A66C2',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    icon: 'facebook',
    maxCaptionLength: 63206,
    maxHashtags: 3,
    color: '#1877F2',
  },
};

// Best posting times by platform (hour in UTC)
export const BEST_POSTING_TIMES: Record<SocialPlatform, number[]> = {
  tiktok: [9, 12, 19], // 9AM, 12PM, 7PM
  instagram: [11, 13, 19], // 11AM, 1PM, 7PM
  youtube: [12, 15, 21], // 12PM, 3PM, 9PM
  twitter: [9, 12, 17], // 9AM, 12PM, 5PM
  linkedin: [8, 10, 12], // 8AM, 10AM, 12PM
  facebook: [9, 13, 16], // 9AM, 1PM, 4PM
};

// ============================================================================
// STORE STATE INTERFACE
// ============================================================================

interface ContentMultiplierV2State {
  // Navigation
  activeMainTab: MainTab;
  wizardStep: WizardStep;

  // Step 1: Upload & Setup
  videoFile: File | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  videoDuration: number | null;
  originalDescription: string;
  originalTranscript: string | null;
  isTranscribing: boolean;
  selectedPlatforms: SocialPlatform[];

  // Step 2: Review Content
  platformContent: Record<SocialPlatform, PlatformGeneratedContent | null>;
  isGenerating: boolean;
  generationProgress: number;
  activePlatformTab: SocialPlatform | null;

  // Step 3: Schedule
  scheduleOption: ScheduleOption;
  platformSchedules: Record<SocialPlatform, PlatformSchedule | null>;
  isPosting: boolean;
  youtubePrivacy: YouTubePrivacyStatus;
  postingProgress: { platform: SocialPlatform; status: 'pending' | 'posting' | 'done' | 'error'; message?: string }[];

  // Accounts
  connectedAccounts: Record<SocialPlatform, SocialAccount | null>;
  isConnecting: SocialPlatform | null;

  // Scheduled Posts (Tab 2)
  scheduledPosts: ScheduledPost[];
  isLoadingScheduled: boolean;

  // Posted History (Tab 3)
  postedHistory: ScheduledPost[];
  isLoadingHistory: boolean;

  // Draft & Auto-save
  currentDraftId: string | null;
  lastAutoSave: string | null;
  hasUnsavedChanges: boolean;

  // Error handling
  error: string | null;

  // ========== ACTIONS ==========

  // Navigation
  setActiveMainTab: (tab: MainTab) => void;
  setWizardStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Step 1: Upload & Setup
  setVideoFile: (file: File | null) => void;
  setVideoUrl: (url: string | null) => void;
  setVideoThumbnailUrl: (url: string | null) => void;
  setVideoDuration: (duration: number | null) => void;
  setOriginalDescription: (description: string) => void;
  setOriginalTranscript: (transcript: string | null) => void;
  setIsTranscribing: (isTranscribing: boolean) => void;
  togglePlatform: (platform: SocialPlatform) => void;
  setSelectedPlatforms: (platforms: SocialPlatform[]) => void;

  // Step 2: Review Content
  setPlatformContent: (platform: SocialPlatform, content: PlatformGeneratedContent) => void;
  updatePlatformCaption: (platform: SocialPlatform, caption: string) => void;
  updatePlatformHashtags: (platform: SocialPlatform, hashtags: string[]) => void;
  updatePlatformTitle: (platform: SocialPlatform, title: string) => void;
  updatePlatformDescription: (platform: SocialPlatform, description: string) => void;
  approvePlatformContent: (platform: SocialPlatform) => void;
  regeneratePlatformContent: (platform: SocialPlatform) => Promise<void>;
  setIsGenerating: (isGenerating: boolean) => void;
  setGenerationProgress: (progress: number) => void;
  setActivePlatformTab: (platform: SocialPlatform | null) => void;
  generateAllContent: () => Promise<void>;

  // Step 3: Schedule
  setScheduleOption: (option: ScheduleOption) => void;
  setPlatformSchedule: (platform: SocialPlatform, schedule: PlatformSchedule) => void;
  setAllPlatformSchedules: (time: string) => void;
  setBestTimesForAll: () => void;
  submitPosts: () => Promise<void>;
  setIsPosting: (isPosting: boolean) => void;
  setYouTubePrivacy: (privacy: YouTubePrivacyStatus) => void;

  // Accounts
  setConnectedAccount: (platform: SocialPlatform, account: SocialAccount | null) => void;
  setIsConnecting: (platform: SocialPlatform | null) => void;
  loadConnectedAccounts: () => Promise<void>;
  connectAccount: (platform: SocialPlatform) => Promise<void>;
  disconnectAccount: (platform: SocialPlatform) => Promise<void>;

  // Scheduled Posts
  loadScheduledPosts: () => Promise<void>;
  cancelScheduledPost: (postId: string) => Promise<void>;
  editScheduledPost: (postId: string) => void;
  reschedulePost: (postId: string, newTime: string) => Promise<void>;

  // Posted History
  loadPostedHistory: () => Promise<void>;
  repostContent: (postId: string) => void;

  // Draft & Auto-save
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  clearDraft: () => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;

  // Utility
  resetWizard: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Computed getters (as functions)
  canProceedToStep2: () => boolean;
  canProceedToStep3: () => boolean;
  canSubmit: () => boolean;
  getConnectedPlatforms: () => SocialPlatform[];
  getUnconnectedSelectedPlatforms: () => SocialPlatform[];
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  // Navigation
  activeMainTab: 'create' as MainTab,
  wizardStep: 1 as WizardStep,

  // Step 1
  videoFile: null,
  videoUrl: null,
  videoThumbnailUrl: null,
  videoDuration: null,
  originalDescription: '',
  originalTranscript: null,
  isTranscribing: false,
  selectedPlatforms: [] as SocialPlatform[],

  // Step 2
  platformContent: {} as Record<SocialPlatform, PlatformGeneratedContent | null>,
  isGenerating: false,
  generationProgress: 0,
  activePlatformTab: null,

  // Step 3
  scheduleOption: 'now' as ScheduleOption,
  platformSchedules: {} as Record<SocialPlatform, PlatformSchedule | null>,
  isPosting: false,
  youtubePrivacy: 'unlisted' as YouTubePrivacyStatus,
  postingProgress: [] as { platform: SocialPlatform; status: 'pending' | 'posting' | 'done' | 'error'; message?: string }[],

  // Accounts
  connectedAccounts: {} as Record<SocialPlatform, SocialAccount | null>,
  isConnecting: null,

  // Scheduled
  scheduledPosts: [] as ScheduledPost[],
  isLoadingScheduled: false,

  // History
  postedHistory: [] as ScheduledPost[],
  isLoadingHistory: false,

  // Draft
  currentDraftId: null,
  lastAutoSave: null,
  hasUnsavedChanges: false,

  // Error
  error: null,
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useContentMultiplierV2Store = create<ContentMultiplierV2State>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ========== NAVIGATION ==========
        setActiveMainTab: (tab) => set({ activeMainTab: tab }),

        setWizardStep: (step) => set({ wizardStep: step }),

        nextStep: () => {
          const { wizardStep } = get();
          if (wizardStep < 3) {
            set({ wizardStep: (wizardStep + 1) as WizardStep });
          }
        },

        prevStep: () => {
          const { wizardStep } = get();
          if (wizardStep > 1) {
            set({ wizardStep: (wizardStep - 1) as WizardStep });
          }
        },

        // ========== STEP 1: UPLOAD & SETUP ==========
        setVideoFile: (file) => set({
          videoFile: file,
          hasUnsavedChanges: true,
          // Reset downstream state when video changes
          platformContent: {},
          wizardStep: 1,
        }),

        setVideoUrl: (url) => set({ videoUrl: url, hasUnsavedChanges: true }),

        setVideoThumbnailUrl: (url) => set({ videoThumbnailUrl: url }),

        setVideoDuration: (duration) => set({ videoDuration: duration }),

        setOriginalDescription: (description) => set({
          originalDescription: description,
          hasUnsavedChanges: true
        }),

        setOriginalTranscript: (transcript) => set({
          originalTranscript: transcript,
          hasUnsavedChanges: true
        }),

        setIsTranscribing: (isTranscribing) => set({ isTranscribing }),

        togglePlatform: (platform) => {
          const { selectedPlatforms, connectedAccounts } = get();
          const isSelected = selectedPlatforms.includes(platform);
          const isConnected = connectedAccounts[platform]?.connected;

          if (isSelected) {
            set({
              selectedPlatforms: selectedPlatforms.filter(p => p !== platform),
              hasUnsavedChanges: true
            });
          } else if (isConnected) {
            set({
              selectedPlatforms: [...selectedPlatforms, platform],
              hasUnsavedChanges: true
            });
          }
        },

        setSelectedPlatforms: (platforms) => set({
          selectedPlatforms: platforms,
          hasUnsavedChanges: true
        }),

        // ========== STEP 2: REVIEW CONTENT ==========
        setPlatformContent: (platform, content) => set((state) => ({
          platformContent: { ...state.platformContent, [platform]: content },
          hasUnsavedChanges: true,
        })),

        updatePlatformCaption: (platform, caption) => set((state) => {
          const existing = state.platformContent[platform];
          if (!existing) return state;

          return {
            platformContent: {
              ...state.platformContent,
              [platform]: {
                ...existing,
                caption,
                characterCount: caption.length,
                isEdited: true,
              },
            },
            hasUnsavedChanges: true,
          };
        }),

        updatePlatformHashtags: (platform, hashtags) => set((state) => {
          const existing = state.platformContent[platform];
          if (!existing) return state;

          return {
            platformContent: {
              ...state.platformContent,
              [platform]: { ...existing, hashtags, isEdited: true },
            },
            hasUnsavedChanges: true,
          };
        }),

        updatePlatformTitle: (platform, title) => set((state) => {
          const existing = state.platformContent[platform];
          if (!existing) return state;

          return {
            platformContent: {
              ...state.platformContent,
              [platform]: { ...existing, title, isEdited: true },
            },
            hasUnsavedChanges: true,
          };
        }),

        updatePlatformDescription: (platform, description) => set((state) => {
          const existing = state.platformContent[platform];
          if (!existing) return state;

          return {
            platformContent: {
              ...state.platformContent,
              [platform]: { ...existing, description, isEdited: true },
            },
            hasUnsavedChanges: true,
          };
        }),

        approvePlatformContent: (platform) => set((state) => {
          const existing = state.platformContent[platform];
          if (!existing) return state;

          return {
            platformContent: {
              ...state.platformContent,
              [platform]: { ...existing, isApproved: true },
            },
          };
        }),

        regeneratePlatformContent: async (platform) => {
          // TODO: Implement AI regeneration for single platform
          console.log('Regenerating content for', platform);
        },

        setIsGenerating: (isGenerating) => set({ isGenerating }),

        setGenerationProgress: (progress) => set({ generationProgress: progress }),

        setActivePlatformTab: (platform) => set({ activePlatformTab: platform }),

        generateAllContent: async () => {
          const { selectedPlatforms, originalDescription, originalTranscript } = get();

          if (selectedPlatforms.length === 0) return;

          set({ isGenerating: true, generationProgress: 0 });

          try {
            // Import the generation action
            const { generatePlatformContentV2 } = await import('@/actions/tools/content-multiplier-v2-actions');

            const contentToUse = originalTranscript || originalDescription;

            for (let i = 0; i < selectedPlatforms.length; i++) {
              const platform = selectedPlatforms[i];

              set({ generationProgress: Math.round(((i + 0.5) / selectedPlatforms.length) * 100) });

              const result = await generatePlatformContentV2(platform, contentToUse);

              if (result.success && result.content) {
                set((state) => ({
                  platformContent: {
                    ...state.platformContent,
                    [platform]: result.content,
                  },
                }));
              }

              set({ generationProgress: Math.round(((i + 1) / selectedPlatforms.length) * 100) });
            }

            // Set first platform as active tab
            set({
              activePlatformTab: selectedPlatforms[0],
              wizardStep: 2,
            });

          } catch (error) {
            console.error('Content generation error:', error);
            set({ error: error instanceof Error ? error.message : 'Generation failed' });
          } finally {
            set({ isGenerating: false, generationProgress: 100 });
          }
        },

        // ========== STEP 3: SCHEDULE ==========
        setScheduleOption: (option) => set({ scheduleOption: option }),

        setPlatformSchedule: (platform, schedule) => set((state) => ({
          platformSchedules: { ...state.platformSchedules, [platform]: schedule },
        })),

        setAllPlatformSchedules: (time) => {
          const { selectedPlatforms } = get();
          const schedules: Record<SocialPlatform, PlatformSchedule> = {} as Record<SocialPlatform, PlatformSchedule>;

          selectedPlatforms.forEach((platform) => {
            schedules[platform] = {
              platform,
              scheduledTime: time,
              isBestTime: false,
            };
          });

          set({ platformSchedules: schedules });
        },

        setBestTimesForAll: () => {
          const { selectedPlatforms } = get();
          const schedules: Record<SocialPlatform, PlatformSchedule> = {} as Record<SocialPlatform, PlatformSchedule>;
          const now = new Date();

          selectedPlatforms.forEach((platform) => {
            const bestHours = BEST_POSTING_TIMES[platform];
            // Find next best time
            let bestTime = new Date(now);
            bestTime.setMinutes(0, 0, 0);

            // Find the next available best hour
            for (const hour of bestHours) {
              if (hour > now.getHours()) {
                bestTime.setHours(hour);
                break;
              }
            }

            // If no hour found today, use first best hour tomorrow
            if (bestTime <= now) {
              bestTime.setDate(bestTime.getDate() + 1);
              bestTime.setHours(bestHours[0]);
            }

            schedules[platform] = {
              platform,
              scheduledTime: bestTime.toISOString(),
              isBestTime: true,
            };
          });

          set({ platformSchedules: schedules });
        },

        submitPosts: async () => {
          const {
            selectedPlatforms,
            platformContent,
            scheduleOption,
            platformSchedules,
            videoUrl,
            originalDescription,
            youtubePrivacy,
          } = get();

          set({ isPosting: true, error: null, postingProgress: [] });

          try {
            // Initialize progress for all platforms
            const initialProgress = selectedPlatforms.map(platform => ({
              platform,
              status: 'pending' as const,
            }));
            set({ postingProgress: initialProgress });

            // If posting now, actually post to platforms
            if (scheduleOption === 'now') {
              for (const platform of selectedPlatforms) {
                // Update progress to show we're posting this platform
                set(state => ({
                  postingProgress: state.postingProgress.map(p =>
                    p.platform === platform ? { ...p, status: 'posting' as const } : p
                  ),
                }));

                if (platform === 'youtube') {
                  // Post to YouTube
                  const { postToYouTube } = await import('@/actions/tools/youtube-posting');
                  const content = platformContent[platform];

                  if (content && videoUrl) {
                    const result = await postToYouTube({
                      videoUrl,
                      title: content.title || content.caption.substring(0, 100),
                      description: content.description || content.caption,
                      tags: content.tags || content.hashtags,
                      privacyStatus: youtubePrivacy,
                    });

                    if (result.success) {
                      set(state => ({
                        postingProgress: state.postingProgress.map(p =>
                          p.platform === platform
                            ? { ...p, status: 'done' as const, message: `Posted: ${result.videoUrl}` }
                            : p
                        ),
                      }));
                    } else {
                      set(state => ({
                        postingProgress: state.postingProgress.map(p =>
                          p.platform === platform
                            ? { ...p, status: 'error' as const, message: result.error }
                            : p
                        ),
                      }));
                    }
                  }
                } else {
                  // Other platforms not implemented yet - mark as error
                  set(state => ({
                    postingProgress: state.postingProgress.map(p =>
                      p.platform === platform
                        ? { ...p, status: 'error' as const, message: 'Platform not yet supported' }
                        : p
                    ),
                  }));
                }
              }

              // Check if any posts succeeded
              const { postingProgress } = get();
              const anySuccess = postingProgress.some(p => p.status === 'done');
              const allFailed = postingProgress.every(p => p.status === 'error');

              if (allFailed) {
                set({ error: 'All posts failed. Check individual errors.' });
              } else if (anySuccess) {
                // Reset wizard after a short delay to show results
                setTimeout(() => {
                  get().resetWizard();
                  set({ activeMainTab: 'posted' });
                }, 2000);
              }
            } else {
              // Scheduling for later - save to database
              const { createScheduledPosts } = await import('@/actions/tools/content-multiplier-v2-actions');

              const postsToCreate = selectedPlatforms.map((platform) => ({
                platform,
                content: platformContent[platform]!,
                scheduledFor: platformSchedules[platform]?.scheduledTime || null,
                postImmediately: false,
              }));

              const result = await createScheduledPosts({
                videoUrl: videoUrl!,
                originalDescription,
                posts: postsToCreate,
              });

              if (result.success) {
                get().resetWizard();
                set({ activeMainTab: 'scheduled' });
              } else {
                set({ error: result.error || 'Failed to schedule posts' });
              }
            }

          } catch (error) {
            console.error('Submit posts error:', error);
            set({ error: error instanceof Error ? error.message : 'Failed to submit posts' });
          } finally {
            set({ isPosting: false });
          }
        },

        setIsPosting: (isPosting) => set({ isPosting }),

        setYouTubePrivacy: (privacy) => set({ youtubePrivacy: privacy }),

        // ========== ACCOUNTS ==========
        setConnectedAccount: (platform, account) => set((state) => ({
          connectedAccounts: { ...state.connectedAccounts, [platform]: account },
        })),

        setIsConnecting: (platform) => set({ isConnecting: platform }),

        loadConnectedAccounts: async () => {
          try {
            const { getConnectedAccounts } = await import('@/actions/tools/content-multiplier-v2-actions');
            const result = await getConnectedAccounts();

            if (result.success && result.accounts) {
              set({ connectedAccounts: result.accounts });
            }
          } catch (error) {
            console.error('Failed to load connected accounts:', error);
          }
        },

        connectAccount: async (platform) => {
          set({ isConnecting: platform });

          try {
            // Use platform-specific OAuth flows
            if (platform === 'youtube') {
              // YouTube uses dedicated OAuth flow
              const { initiateYouTubeOAuth } = await import('@/actions/auth/youtube-oauth');
              const result = await initiateYouTubeOAuth();

              if (result.success && result.authUrl) {
                window.location.href = result.authUrl;
              } else {
                throw new Error(result.error || 'Failed to initiate YouTube OAuth');
              }
            } else {
              // Other platforms use generic social OAuth
              const { initiateOAuthFlow } = await import('@/actions/auth/social-oauth');
              const { createClient } = await import('@/app/supabase/client');

              const supabase = createClient();
              const { data: { user } } = await supabase.auth.getUser();

              if (!user) {
                throw new Error('Please log in to connect accounts');
              }

              const result = await initiateOAuthFlow(platform, user.id);

              if (result.success && result.authUrl) {
                window.location.href = result.authUrl;
              } else {
                throw new Error(result.error || 'Failed to initiate OAuth');
              }
            }
          } catch (error) {
            console.error('Connect account error:', error);
            set({ error: error instanceof Error ? error.message : 'Failed to connect account' });
          } finally {
            set({ isConnecting: null });
          }
        },

        disconnectAccount: async (platform) => {
          try {
            const { disconnectSocialPlatform } = await import('@/actions/auth/social-oauth');
            const { createClient } = await import('@/app/supabase/client');

            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return;

            const result = await disconnectSocialPlatform(platform, user.id);

            if (result.success) {
              set((state) => ({
                connectedAccounts: { ...state.connectedAccounts, [platform]: null },
                selectedPlatforms: state.selectedPlatforms.filter(p => p !== platform),
              }));
            }
          } catch (error) {
            console.error('Disconnect account error:', error);
          }
        },

        // ========== SCHEDULED POSTS ==========
        loadScheduledPosts: async () => {
          set({ isLoadingScheduled: true });

          try {
            const { getScheduledPosts } = await import('@/actions/tools/content-multiplier-v2-actions');
            const result = await getScheduledPosts();

            if (result.success && result.posts) {
              set({ scheduledPosts: result.posts });
            }
          } catch (error) {
            console.error('Failed to load scheduled posts:', error);
          } finally {
            set({ isLoadingScheduled: false });
          }
        },

        cancelScheduledPost: async (postId) => {
          try {
            const { cancelScheduledPost } = await import('@/actions/tools/content-multiplier-v2-actions');
            const result = await cancelScheduledPost(postId);

            if (result.success) {
              set((state) => ({
                scheduledPosts: state.scheduledPosts.filter(p => p.id !== postId),
              }));
            }
          } catch (error) {
            console.error('Failed to cancel post:', error);
          }
        },

        editScheduledPost: (postId) => {
          const { scheduledPosts } = get();
          const post = scheduledPosts.find(p => p.id === postId);

          if (post) {
            // Load post data into wizard for editing
            set({
              activeMainTab: 'create',
              wizardStep: 2,
              videoUrl: post.videoUrl,
              originalDescription: post.originalDescription,
              selectedPlatforms: [post.platform],
              platformContent: { [post.platform]: post.generatedContent } as Record<SocialPlatform, PlatformGeneratedContent>,
              activePlatformTab: post.platform,
            });
          }
        },

        reschedulePost: async (postId, newTime) => {
          try {
            const { reschedulePost } = await import('@/actions/tools/content-multiplier-v2-actions');
            const result = await reschedulePost(postId, newTime);

            if (result.success) {
              set((state) => ({
                scheduledPosts: state.scheduledPosts.map(p =>
                  p.id === postId ? { ...p, scheduledFor: newTime } : p
                ),
              }));
            }
          } catch (error) {
            console.error('Failed to reschedule post:', error);
          }
        },

        // ========== POSTED HISTORY ==========
        loadPostedHistory: async () => {
          set({ isLoadingHistory: true });

          try {
            const { getPostedHistory } = await import('@/actions/tools/content-multiplier-v2-actions');
            const result = await getPostedHistory();

            if (result.success && result.posts) {
              set({ postedHistory: result.posts });
            }
          } catch (error) {
            console.error('Failed to load history:', error);
          } finally {
            set({ isLoadingHistory: false });
          }
        },

        repostContent: (postId) => {
          const { postedHistory } = get();
          const post = postedHistory.find(p => p.id === postId);

          if (post) {
            // Load post data into wizard for reposting
            set({
              activeMainTab: 'create',
              wizardStep: 1,
              videoUrl: post.videoUrl,
              originalDescription: post.originalDescription,
              selectedPlatforms: [],
              platformContent: {},
            });
          }
        },

        // ========== DRAFT & AUTO-SAVE ==========
        saveDraft: async () => {
          const state = get();

          try {
            const { saveDraft } = await import('@/actions/tools/content-multiplier-v2-actions');

            const result = await saveDraft({
              id: state.currentDraftId || undefined,
              videoUrl: state.videoUrl || undefined,
              originalDescription: state.originalDescription,
              selectedPlatforms: state.selectedPlatforms,
              platformContent: state.platformContent,
              currentStep: state.wizardStep,
            });

            if (result.success) {
              set({
                currentDraftId: result.draftId,
                lastAutoSave: new Date().toISOString(),
                hasUnsavedChanges: false,
              });
            }
          } catch (error) {
            console.error('Failed to save draft:', error);
          }
        },

        loadDraft: async (draftId) => {
          try {
            const { loadDraft } = await import('@/actions/tools/content-multiplier-v2-actions');
            const result = await loadDraft(draftId);

            if (result.success && result.draft) {
              set({
                currentDraftId: draftId,
                videoUrl: result.draft.videoUrl,
                originalDescription: result.draft.originalDescription,
                selectedPlatforms: result.draft.selectedPlatforms,
                platformContent: result.draft.platformContent,
                wizardStep: result.draft.currentStep,
                hasUnsavedChanges: false,
              });
            }
          } catch (error) {
            console.error('Failed to load draft:', error);
          }
        },

        clearDraft: () => {
          set({ currentDraftId: null, hasUnsavedChanges: false });
        },

        setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),

        // ========== UTILITY ==========
        resetWizard: () => set({
          wizardStep: 1,
          videoFile: null,
          videoUrl: null,
          videoThumbnailUrl: null,
          videoDuration: null,
          originalDescription: '',
          originalTranscript: null,
          selectedPlatforms: [],
          platformContent: {},
          activePlatformTab: null,
          scheduleOption: 'now',
          platformSchedules: {},
          currentDraftId: null,
          hasUnsavedChanges: false,
          error: null,
        }),

        setError: (error) => set({ error }),

        clearError: () => set({ error: null }),

        // ========== COMPUTED GETTERS ==========
        canProceedToStep2: () => {
          const { videoUrl, originalDescription, selectedPlatforms } = get();
          return !!(videoUrl && originalDescription.trim() && selectedPlatforms.length > 0);
        },

        canProceedToStep3: () => {
          const { selectedPlatforms, platformContent } = get();
          return selectedPlatforms.every(p => platformContent[p]?.isApproved);
        },

        canSubmit: () => {
          const { selectedPlatforms, platformContent, scheduleOption, platformSchedules } = get();

          // All content must be approved
          const allApproved = selectedPlatforms.every(p => platformContent[p]?.isApproved);

          // If scheduling, all must have times
          if (scheduleOption !== 'now') {
            const allScheduled = selectedPlatforms.every(p => platformSchedules[p]?.scheduledTime);
            return allApproved && allScheduled;
          }

          return allApproved;
        },

        getConnectedPlatforms: () => {
          const { connectedAccounts } = get();
          return Object.entries(connectedAccounts)
            .filter(([_, account]) => account?.connected)
            .map(([platform]) => platform as SocialPlatform);
        },

        getUnconnectedSelectedPlatforms: () => {
          const { selectedPlatforms, connectedAccounts } = get();
          return selectedPlatforms.filter(p => !connectedAccounts[p]?.connected);
        },
      }),
      {
        name: 'content-multiplier-v2-store',
        partialize: (state) => ({
          // Only persist essential data
          connectedAccounts: state.connectedAccounts,
          // Don't persist video files or transient state
        }),
      }
    ),
    { name: 'content-multiplier-v2' }
  )
);

// ============================================================================
// SELECTORS (for optimized re-renders)
// ============================================================================

export const useActiveMainTab = () => useContentMultiplierV2Store((s) => s.activeMainTab);
export const useWizardStep = () => useContentMultiplierV2Store((s) => s.wizardStep);
export const useSelectedPlatforms = () => useContentMultiplierV2Store((s) => s.selectedPlatforms);
export const useConnectedAccounts = () => useContentMultiplierV2Store((s) => s.connectedAccounts);
export const usePlatformContent = () => useContentMultiplierV2Store((s) => s.platformContent);
export const useIsGenerating = () => useContentMultiplierV2Store((s) => s.isGenerating);
export const useGenerationProgress = () => useContentMultiplierV2Store((s) => s.generationProgress);
export const useScheduledPosts = () => useContentMultiplierV2Store((s) => s.scheduledPosts);
export const usePostedHistory = () => useContentMultiplierV2Store((s) => s.postedHistory);
export const useScheduleOption = () => useContentMultiplierV2Store((s) => s.scheduleOption);
export const useVideoUrl = () => useContentMultiplierV2Store((s) => s.videoUrl);
export const useOriginalDescription = () => useContentMultiplierV2Store((s) => s.originalDescription);
