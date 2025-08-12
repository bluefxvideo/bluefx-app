/**
 * Shared types for script generation
 */

export interface ScriptGenerationResponse {
  success: boolean;
  script: string;
  metadata?: {
    word_count: number;
    estimated_duration: number;
    tone_analysis: string;
    key_points: string[];
  };
  credits_used: number;
  error?: string;
}

export interface ScriptGenerationRequest {
  idea: string;
  user_id: string;
  style?: {
    tone?: 'professional' | 'casual' | 'educational' | 'dramatic' | 'energetic';
    pacing?: 'slow' | 'medium' | 'fast';
    target_duration?: number;
  };
}