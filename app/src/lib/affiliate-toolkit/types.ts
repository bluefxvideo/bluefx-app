// Affiliate Toolkit Types

export interface AffiliateOffer {
  id: string;
  name: string;
  niche: string | null;
  offer_content: string | null;
  created_at: string;
}

export type ScriptType =
  | 'short_video'
  | 'long_video'
  | 'email_sequence'
  | 'landing_page'
  | 'social_posts'
  | 'ad_copy'
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
