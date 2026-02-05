export interface Prompt {
  id: string;
  title: string;
  description: string | null;
  prompt_text: string;
  category: PromptCategory;
  use_case: string | null;
  tags: string[];
  display_order: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export type PromptCategory =
  | 'video_scripts'
  | 'marketing'
  | 'educational'
  | 'social_media'
  | 'email'
  | 'general';

export const PROMPT_CATEGORIES: { id: PromptCategory; name: string; icon: string }[] = [
  { id: 'video_scripts', name: 'Video Scripts', icon: 'Video' },
  { id: 'marketing', name: 'Marketing', icon: 'Megaphone' },
  { id: 'educational', name: 'Educational', icon: 'GraduationCap' },
  { id: 'social_media', name: 'Social Media', icon: 'Share2' },
  { id: 'email', name: 'Email', icon: 'Mail' },
  { id: 'general', name: 'General', icon: 'FileText' },
];

export type CreatePromptInput = Omit<Prompt, 'id' | 'created_at' | 'updated_at'>;
export type UpdatePromptInput = Partial<Omit<Prompt, 'id' | 'created_at' | 'updated_at'>>;
