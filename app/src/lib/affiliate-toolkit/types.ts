// Affiliate Toolkit Types

// Media file uploaded and transcribed
export interface OfferMediaFile {
  id: string;
  name: string;
  url: string;
  type: 'video' | 'audio';
  transcript: string;
  word_count: number;
  created_at: string;
}

// YouTube URL with transcript
export interface OfferYouTubeTranscript {
  id: string;
  url: string;
  title: string | null;
  transcript: string;
  word_count: number;
  created_at: string;
}

// Base offer interface (shared fields)
interface BaseOffer {
  id: string;
  name: string;
  niche: string | null;
  offer_content: string | null;
  media_files: OfferMediaFile[];
  youtube_transcripts: OfferYouTubeTranscript[];
  aggregated_content: string | null;
  created_at: string;
}

// Library product (admin-managed, no user_id)
export interface LibraryProduct extends BaseOffer {
  display_order: number;
}

// User's business offer (user-specific)
export interface UserBusinessOffer extends BaseOffer {
  user_id: string;
  updated_at: string;
}

// Union type for Content Generator (can use either)
export type AnyOffer = LibraryProduct | UserBusinessOffer;

// Legacy alias for backwards compatibility
export type AffiliateOffer = BaseOffer;

// Helper to count words in text
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Helper to aggregate all content from an offer
export function aggregateOfferContent(offer: Partial<AffiliateOffer>): string {
  const parts: string[] = [];

  // Add manual text content
  if (offer.offer_content?.trim()) {
    parts.push(offer.offer_content.trim());
  }

  // Add media transcriptions
  if (offer.media_files?.length) {
    for (const media of offer.media_files) {
      if (media.transcript?.trim()) {
        parts.push(`[Transcription from ${media.name}]: ${media.transcript.trim()}`);
      }
    }
  }

  // Add YouTube transcripts
  if (offer.youtube_transcripts?.length) {
    for (const yt of offer.youtube_transcripts) {
      if (yt.transcript?.trim()) {
        const title = yt.title || 'YouTube Video';
        parts.push(`[Transcript from "${title}"]: ${yt.transcript.trim()}`);
      }
    }
  }

  return parts.join('\n\n');
}

export type ScriptType =
  | 'short_video'
  | 'long_video'
  | 'email_sequence'
  | 'landing_page'
  | 'social_posts'
  | 'ad_copy'
  | 'hooks'
  | 'content_calendar'
  | 'custom';

export interface ScriptTypeConfig {
  id: ScriptType;
  name: string;
  description: string;
  icon: string;
}

export const SCRIPT_TYPES: ScriptTypeConfig[] = [
  {
    id: 'short_video',
    name: 'Short Video Script',
    description: '60-90 second video script for TikTok, Reels, Shorts',
    icon: 'Video'
  },
  {
    id: 'long_video',
    name: 'Long Video Script',
    description: '5-10 minute YouTube video script',
    icon: 'Film'
  },
  {
    id: 'email_sequence',
    name: 'Email Sequence',
    description: '3-5 email follow-up sequence',
    icon: 'Mail'
  },
  {
    id: 'landing_page',
    name: 'Landing Page Copy',
    description: 'Full landing page with headline, benefits, CTA',
    icon: 'Layout'
  },
  {
    id: 'social_posts',
    name: 'Social Media Posts',
    description: '5 posts optimized for different platforms',
    icon: 'Share2'
  },
  {
    id: 'ad_copy',
    name: 'Ad Copy Variations',
    description: 'Facebook/Google ad copy with multiple angles',
    icon: 'Target'
  },
  {
    id: 'hooks',
    name: 'Hooks (10)',
    description: '10 scroll-stopping hooks for short-form video',
    icon: 'Zap'
  },
  {
    id: 'content_calendar',
    name: '30-Day Calendar',
    description: 'Complete 30-day content calendar by week',
    icon: 'Calendar'
  },
  {
    id: 'custom',
    name: 'Custom Prompt',
    description: 'Write your own prompt for custom output',
    icon: 'Pencil'
  }
];

export interface GenerationState {
  isGenerating: boolean;
  generatedScript: string | null;
  error: string | null;
}

export interface RefinementState {
  isRefining: boolean;
  refinementHistory: string[];
}

export interface SavedScript {
  id: string;
  user_id: string;
  offer_id: string | null;
  offer_name: string;
  script_type: ScriptType;
  content: string;
  custom_angle: string | null;
  custom_prompt: string | null;
  is_favorite: boolean;
  created_at: string;
}

// Helper to get type label from ScriptType
export function getScriptTypeLabel(type: ScriptType): string {
  const config = SCRIPT_TYPES.find(t => t.id === type);
  return config?.name || type;
}

// Video-related script types (for showing video tool buttons)
export const VIDEO_SCRIPT_TYPES: ScriptType[] = ['short_video', 'long_video', 'hooks'];

export function isVideoScriptType(type: ScriptType): boolean {
  return VIDEO_SCRIPT_TYPES.includes(type);
}
