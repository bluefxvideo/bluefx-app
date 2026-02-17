'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { YouTubeMetadata } from '@/actions/tools/youtube-repurpose-extraction';
import type { BlogPostContent, SocialCaption } from '@/actions/tools/youtube-repurpose-generation';

// ============================================================================
// TYPES
// ============================================================================

export type WizardStep = 1 | 2 | 3;

export type SocialPlatform = 'linkedin';

export type PublishPlatform = SocialPlatform | 'wordpress';

export type PostingStatus = 'pending' | 'posting' | 'done' | 'error';

export interface PostingProgress {
  platform: PublishPlatform;
  status: PostingStatus;
  message?: string;
  url?: string;
}

// ============================================================================
// STORE STATE
// ============================================================================

interface YouTubeRepurposeState {
  // Wizard navigation
  currentStep: WizardStep;

  // Step 1: Input
  youtubeUrl: string;
  isExtracting: boolean;
  extractionStatus: string; // e.g. "Extracting metadata...", "Downloading video..."
  youtubeMetadata: YouTubeMetadata | null;
  transcript: string | null;
  videoStorageUrl: string | null;
  videoFileSizeMB: number | null;
  isDownloadingVideo: boolean;
  videoDownloadWarning: string | null;

  // Editable URLs (auto-populated from metadata, user can override)
  productUrl: string;

  // WordPress connection
  wordpressConnected: boolean;
  wordpressSiteUrl: string | null;

  // Social platform connections
  socialConnections: Record<SocialPlatform, { connected: boolean; username: string | null }>;

  // Step 2: Content generation & review
  isGenerating: boolean;
  generationStatus: string;
  blogPost: BlogPostContent | null;
  socialContent: Record<SocialPlatform, SocialCaption | null>;
  isRegenerating: SocialPlatform | 'blog' | null;

  // Step 3: Publishing
  selectedPlatforms: PublishPlatform[];
  isPublishing: boolean;
  postingProgress: PostingProgress[];

  // Error handling
  error: string | null;

  // ========== ACTIONS ==========

  // Navigation
  setCurrentStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Step 1
  setYouTubeUrl: (url: string) => void;
  setProductUrl: (url: string) => void;
  extractYouTubeData: () => Promise<void>;
  downloadVideo: () => Promise<void>;
  setWordPressConnection: (connected: boolean, siteUrl: string | null) => void;
  loadWordPressConnection: () => Promise<void>;
  loadSocialConnections: () => Promise<void>;

  // Step 2
  generateAllContent: () => Promise<void>;
  setBlogPost: (blogPost: BlogPostContent) => void;
  updateBlogPostField: (field: keyof BlogPostContent, value: string) => void;
  setSocialCaption: (platform: SocialPlatform, caption: SocialCaption) => void;
  updateSocialCaptionText: (platform: SocialPlatform, text: string) => void;
  updateSocialHashtags: (platform: SocialPlatform, hashtags: string[]) => void;
  regeneratePlatform: (platform: SocialPlatform) => Promise<void>;
  regenerateBlogPost: () => Promise<void>;

  // Step 3
  togglePlatform: (platform: PublishPlatform) => void;
  publishAll: () => Promise<void>;

  // Utility
  resetWizard: () => void;
  setError: (error: string | null) => void;

  // Computed getters
  canProceedToStep2: () => boolean;
  canProceedToStep3: () => boolean;
  canPublish: () => boolean;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  currentStep: 1 as WizardStep,
  youtubeUrl: '',
  isExtracting: false,
  extractionStatus: '',
  youtubeMetadata: null,
  transcript: null,
  videoStorageUrl: null,
  videoFileSizeMB: null,
  isDownloadingVideo: false,
  videoDownloadWarning: null,
  productUrl: '',
  wordpressConnected: false,
  wordpressSiteUrl: null,
  socialConnections: {
    linkedin: { connected: false, username: null },
  },
  isGenerating: false,
  generationStatus: '',
  blogPost: null,
  socialContent: { linkedin: null } as Record<SocialPlatform, SocialCaption | null>,
  isRegenerating: null,
  selectedPlatforms: ['wordpress', 'linkedin'] as PublishPlatform[],
  isPublishing: false,
  postingProgress: [] as PostingProgress[],
  error: null,
};

// ============================================================================
// STORE
// ============================================================================

export const useYouTubeRepurposeStore = create<YouTubeRepurposeState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========== NAVIGATION ==========
      setCurrentStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep } = get();
        if (currentStep < 3) set({ currentStep: (currentStep + 1) as WizardStep });
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 1) set({ currentStep: (currentStep - 1) as WizardStep });
      },

      // ========== STEP 1: INPUT ==========
      setYouTubeUrl: (url) => set({ youtubeUrl: url, error: null }),
      setProductUrl: (url) => set({ productUrl: url }),

      extractYouTubeData: async () => {
        const { youtubeUrl } = get();
        if (!youtubeUrl.trim()) {
          set({ error: 'Please enter a YouTube URL' });
          return;
        }

        set({ isExtracting: true, extractionStatus: 'Extracting metadata & transcript...', error: null });

        try {
          const { extractYouTubeData } = await import('@/actions/tools/youtube-repurpose-extraction');
          const result = await extractYouTubeData(youtubeUrl);

          if (!result.success || !result.metadata) {
            set({ error: result.error || 'Failed to extract video data', isExtracting: false, extractionStatus: '' });
            return;
          }

          set({
            youtubeMetadata: result.metadata,
            transcript: result.transcript || null,
            productUrl: result.metadata.productUrl || '',
            isExtracting: false,
            extractionStatus: '',
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Extraction failed',
            isExtracting: false,
            extractionStatus: '',
          });
        }
      },

      downloadVideo: async () => {
        const { youtubeUrl } = get();
        if (!youtubeUrl.trim()) return;

        set({ isDownloadingVideo: true, extractionStatus: 'Downloading video from YouTube...', error: null });

        try {
          const { downloadYouTubeVideo } = await import('@/actions/tools/youtube-repurpose-extraction');
          const result = await downloadYouTubeVideo(youtubeUrl);

          if (!result.success) {
            // Non-fatal: video download failed, but feature still works for WordPress
            console.warn('Video download failed:', result.error);
            set({
              videoDownloadWarning: result.error || 'Video download unavailable',
              isDownloadingVideo: false,
              extractionStatus: '',
            });
            return;
          }

          set({
            videoStorageUrl: result.videoStorageUrl || null,
            videoFileSizeMB: result.fileSizeMB || null,
            isDownloadingVideo: false,
            extractionStatus: '',
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Download failed',
            isDownloadingVideo: false,
            extractionStatus: '',
          });
        }
      },

      setWordPressConnection: (connected, siteUrl) => set({
        wordpressConnected: connected,
        wordpressSiteUrl: siteUrl,
      }),

      loadWordPressConnection: async () => {
        try {
          const { getWordPressConnection } = await import('@/actions/auth/wordpress-connection');
          const result = await getWordPressConnection();

          if (result.success && result.connection) {
            set({
              wordpressConnected: result.connection.connected,
              wordpressSiteUrl: result.connection.siteUrl,
            });
          }
        } catch (error) {
          console.error('Failed to load WordPress connection:', error);
        }
      },

      loadSocialConnections: async () => {
        try {
          const { getSocialConnections } = await import('@/actions/auth/social-connections');
          const result = await getSocialConnections();

          if (result.success) {
            set({ socialConnections: result.connections });
          }
        } catch (error) {
          console.error('Failed to load social connections:', error);
        }
      },

      // ========== STEP 2: CONTENT GENERATION ==========
      generateAllContent: async () => {
        const { youtubeMetadata, transcript, youtubeUrl, productUrl } = get();

        if (!youtubeMetadata || !transcript) {
          set({ error: 'Missing metadata or transcript. Go back and extract data first.' });
          return;
        }

        set({ isGenerating: true, generationStatus: 'Generating blog post...', error: null });

        try {
          const { generateBlogPost, generateSocialContent } = await import('@/actions/tools/youtube-repurpose-generation');

          // Generate blog post first
          const blogResult = await generateBlogPost({
            youtubeTitle: youtubeMetadata.title,
            youtubeDescription: youtubeMetadata.description,
            transcript,
            youtubeUrl,
          });

          if (!blogResult.success || !blogResult.blogPost) {
            set({ error: blogResult.error || 'Blog post generation failed', isGenerating: false, generationStatus: '' });
            return;
          }

          set({
            blogPost: blogResult.blogPost,
            generationStatus: 'Generating social captions...',
          });

          // Then generate social content
          const socialResult = await generateSocialContent({
            youtubeTitle: youtubeMetadata.title,
            youtubeDescription: youtubeMetadata.description,
            transcript,
            youtubeUrl,
            productUrl: productUrl || null,
            blogExcerpt: blogResult.blogPost.excerpt,
          });

          if (!socialResult.success || !socialResult.socialContent) {
            set({ error: socialResult.error || 'Social content generation failed', isGenerating: false, generationStatus: '' });
            return;
          }

          set({
            socialContent: socialResult.socialContent,
            isGenerating: false,
            generationStatus: '',
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Content generation failed',
            isGenerating: false,
            generationStatus: '',
          });
        }
      },

      setBlogPost: (blogPost) => set({ blogPost }),

      updateBlogPostField: (field, value) => set((state) => {
        if (!state.blogPost) return state;
        return { blogPost: { ...state.blogPost, [field]: value } };
      }),

      setSocialCaption: (platform, caption) => set((state) => ({
        socialContent: { ...state.socialContent, [platform]: caption },
      })),

      updateSocialCaptionText: (platform, text) => set((state) => {
        const existing = state.socialContent[platform];
        if (!existing) return state;
        return {
          socialContent: {
            ...state.socialContent,
            [platform]: { ...existing, caption: text },
          },
        };
      }),

      updateSocialHashtags: (platform, hashtags) => set((state) => {
        const existing = state.socialContent[platform];
        if (!existing) return state;
        return {
          socialContent: {
            ...state.socialContent,
            [platform]: { ...existing, hashtags },
          },
        };
      }),

      regeneratePlatform: async (platform) => {
        const { youtubeMetadata, transcript, socialContent } = get();
        if (!youtubeMetadata || !transcript) return;

        set({ isRegenerating: platform });

        try {
          const { regeneratePlatformCaption } = await import('@/actions/tools/youtube-repurpose-generation');
          const result = await regeneratePlatformCaption({
            platform,
            youtubeTitle: youtubeMetadata.title,
            transcript,
            previousCaption: socialContent[platform]?.caption || '',
          });

          if (result.success && result.caption) {
            set((state) => ({
              socialContent: { ...state.socialContent, [platform]: result.caption! },
              isRegenerating: null,
            }));
          } else {
            set({ error: result.error || 'Regeneration failed', isRegenerating: null });
          }
        } catch {
          set({ error: 'Regeneration failed', isRegenerating: null });
        }
      },

      regenerateBlogPost: async () => {
        const { youtubeMetadata, transcript, youtubeUrl } = get();
        if (!youtubeMetadata || !transcript) return;

        set({ isRegenerating: 'blog', generationStatus: 'Regenerating blog post...' });

        try {
          const { generateBlogPost } = await import('@/actions/tools/youtube-repurpose-generation');
          const result = await generateBlogPost({
            youtubeTitle: youtubeMetadata.title,
            youtubeDescription: youtubeMetadata.description,
            transcript,
            youtubeUrl,
          });

          if (result.success && result.blogPost) {
            set({ blogPost: result.blogPost, isRegenerating: null, generationStatus: '' });
          } else {
            set({ error: result.error || 'Blog regeneration failed', isRegenerating: null, generationStatus: '' });
          }
        } catch {
          set({ error: 'Blog regeneration failed', isRegenerating: null, generationStatus: '' });
        }
      },

      // ========== STEP 3: PUBLISHING ==========
      togglePlatform: (platform) => set((state) => {
        const isSelected = state.selectedPlatforms.includes(platform);
        return {
          selectedPlatforms: isSelected
            ? state.selectedPlatforms.filter(p => p !== platform)
            : [...state.selectedPlatforms, platform],
        };
      }),

      publishAll: async () => {
        const {
          selectedPlatforms, blogPost, socialContent, videoStorageUrl,
          youtubeMetadata, youtubeUrl,
        } = get();

        if (selectedPlatforms.length === 0) return;

        set({
          isPublishing: true,
          error: null,
          postingProgress: selectedPlatforms.map(p => ({ platform: p, status: 'pending' as PostingStatus })),
        });

        const updateProgress = (platform: PublishPlatform, status: PostingStatus, message?: string, url?: string) => {
          set((state) => ({
            postingProgress: state.postingProgress.map(p =>
              p.platform === platform ? { ...p, status, message, url } : p
            ),
          }));
        };

        // 1. Publish to WordPress first (if selected)
        if (selectedPlatforms.includes('wordpress') && blogPost) {
          updateProgress('wordpress', 'posting');
          try {
            const { postToWordPress } = await import('@/actions/tools/wordpress-posting');

            // Add YouTube embed at the top of the blog post content
            const videoId = youtubeMetadata?.videoId;
            const youtubeEmbed = videoId
              ? `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:2rem"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%" src="https://www.youtube-nocookie.com/embed/${videoId}" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`
              : '';

            const fullContent = youtubeEmbed + blogPost.content;

            const result = await postToWordPress({
              title: blogPost.title,
              content: fullContent,
              excerpt: blogPost.excerpt,
              status: 'publish',
              tags: youtubeMetadata?.tags?.slice(0, 10),
              featuredImageUrl: youtubeMetadata?.thumbnailUrl,
              yoastMeta: {
                seoTitle: blogPost.seoTitle,
                metaDescription: blogPost.metaDescription,
                focusKeyphrase: blogPost.focusKeyphrase,
              },
            });

            if (result.success) {
              updateProgress('wordpress', 'done', 'Published', result.postUrl);
            } else {
              updateProgress('wordpress', 'error', result.error);
            }
          } catch (error) {
            updateProgress('wordpress', 'error', error instanceof Error ? error.message : 'Failed');
          }
        }

        // 2. Post to social platforms
        {
          // Post to LinkedIn
          if (selectedPlatforms.includes('linkedin') && socialContent.linkedin) {
            updateProgress('linkedin', 'posting');
            try {
              const { postToLinkedIn } = await import('@/actions/tools/linkedin-posting');
              const hashtagsText = socialContent.linkedin.hashtags.map(h => `#${h}`).join(' ');
              let text = `${socialContent.linkedin.caption}\n\n${hashtagsText}`.trim();

              // If no video downloaded, append YouTube URL for link sharing
              if (!videoStorageUrl) {
                const { youtubeUrl } = get();
                text = `${text}\n\n${youtubeUrl}`;
              }

              const result = await postToLinkedIn({ videoUrl: videoStorageUrl || '', text });
              if (result.success) {
                updateProgress('linkedin', 'done', 'Posted', result.postUrl);
              } else {
                updateProgress('linkedin', 'error', result.error);
              }
            } catch (error) {
              updateProgress('linkedin', 'error', error instanceof Error ? error.message : 'Failed');
            }
          }

        }

        // Save record to database
        try {
          const { createClient } = await import('@/app/supabase/client');
          const supabase = createClient();

          const { postingProgress } = get();
          const socialPostUrls = postingProgress
            .filter(p => p.platform !== 'wordpress' && p.status === 'done')
            .reduce((acc, p) => ({ ...acc, [p.platform]: p.url }), {});

          const wpProgress = postingProgress.find(p => p.platform === 'wordpress');

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('youtube_repurpose_posts').insert({
              user_id: user.id,
              youtube_url: youtubeUrl,
              youtube_video_id: youtubeMetadata?.videoId || '',
              video_storage_url: null, // Don't store URL — video is temporary
              youtube_metadata: youtubeMetadata,
              blog_post: blogPost,
              social_content: socialContent,
              wordpress_post_url: wpProgress?.url || null,
              social_post_urls: socialPostUrls,
              status: postingProgress.some(p => p.status === 'done') ? 'published' : 'failed',
              published_at: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('Failed to save repurpose record:', error);
        }

        // Auto-delete video from storage after publishing (temporary storage only)
        if (videoStorageUrl) {
          try {
            const { deleteVideoFromStorage } = await import('@/actions/tools/youtube-repurpose-extraction');
            await deleteVideoFromStorage(videoStorageUrl);
            console.log('Video cleaned up from storage after publishing');
          } catch (error) {
            console.error('Failed to cleanup video from storage:', error);
          }
        }

        set({ isPublishing: false });
      },

      // ========== UTILITY ==========
      resetWizard: () => set({ ...initialState }),

      setError: (error) => set({ error }),

      // ========== COMPUTED GETTERS ==========
      canProceedToStep2: () => {
        const { youtubeMetadata, transcript } = get();
        return !!(youtubeMetadata && transcript);
      },

      canProceedToStep3: () => {
        const { blogPost, socialContent } = get();
        return !!(blogPost && socialContent.linkedin);
      },

      canPublish: () => {
        const { selectedPlatforms, blogPost, socialContent } = get();
        if (selectedPlatforms.length === 0) return false;

        // WordPress needs blog post
        if (selectedPlatforms.includes('wordpress') && !blogPost) return false;

        // Social platforms need captions (video is optional — posts as link share without it)
        const socialPlatforms = selectedPlatforms.filter(p => p !== 'wordpress') as SocialPlatform[];
        if (socialPlatforms.some(p => !socialContent[p])) return false;

        return true;
      },
    }),
    { name: 'youtube-repurpose' }
  )
);
