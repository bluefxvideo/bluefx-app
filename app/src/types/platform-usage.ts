// Tool name mapping for human-readable display
export const TOOL_NAMES: Record<string, string> = {
  'voice_over': 'Voice Over',
  'media_generation': 'AI Cinematographer',
  'content_generation': 'Content Multiplier',
  'avatar_video': 'Talking Avatar',
  'ai_prediction': 'Thumbnail Machine',
  'script_to_video': 'Script to Video',
  'music_generation': 'Music Maker',
  'logo_generation': 'Logo Generator',
  'ebook_generation': 'Ebook Writer',
  'video_swap': 'Video Swap',
  'starting-shot': 'Starting Shot',
  'video-generation': 'Video Generation',
  'storyboard-generation': 'Storyboard',
  'storyboard-frame-extraction': 'Frame Extraction',
};

export interface PlatformSummaryStats {
  totalCreditsUsed: number;
  totalGenerations: number;
  activeUsers: number;
  newUsers: number;
  totalUsers: number;
}

export interface ToolUsageStat {
  toolId: string;
  toolName: string;
  totalCredits: number;
  totalUses: number;
  uniqueUsers: number;
}

export interface DailyUsageTrend {
  date: string;
  creditsUsed: number;
  generations: number;
  activeUsers: number;
}

export interface TopUser {
  userId: string;
  email: string | null;
  username: string | null;
  fullName: string | null;
  creditsUsed: number;
  generations: number;
  lastActive: string | null;
}

export interface PlatformUsageResponse {
  success: boolean;
  summary?: PlatformSummaryStats;
  toolUsage?: ToolUsageStat[];
  dailyTrends?: DailyUsageTrend[];
  topUsers?: TopUser[];
  error?: string;
}
