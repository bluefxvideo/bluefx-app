// Generated TypeScript types for Supabase database schema
// This file is auto-generated based on the database schema analysis

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      announcements: {
        Row: {
          id: string
          title: string
          content: string
          type: 'info' | 'warning' | 'error' | 'maintenance' | 'feature'
          priority: number
          target_audience: string[] | null
          is_active: boolean | null
          is_dismissible: boolean | null
          starts_at: string | null
          ends_at: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          content: string
          type: 'info' | 'warning' | 'error' | 'maintenance' | 'feature'
          priority?: number
          target_audience?: string[] | null
          is_active?: boolean | null
          is_dismissible?: boolean | null
          starts_at?: string | null
          ends_at?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          content?: string
          type?: 'info' | 'warning' | 'error' | 'maintenance' | 'feature'
          priority?: number
          target_audience?: string[] | null
          is_active?: boolean | null
          is_dismissible?: boolean | null
          starts_at?: string | null
          ends_at?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      avatar_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          category: 'business' | 'casual' | 'creative' | 'educational' | 'custom'
          gender: 'male' | 'female' | 'non_binary' | null
          age_range: 'young' | 'middle_aged' | 'senior' | null
          ethnicity: string | null
          voice_provider: 'elevenlabs' | 'azure' | 'aws_polly'
          voice_id: string
          preview_video_url: string | null
          thumbnail_url: string | null
          is_active: boolean | null
          usage_count: number | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: 'business' | 'casual' | 'creative' | 'educational' | 'custom'
          gender?: 'male' | 'female' | 'non_binary' | null
          age_range?: 'young' | 'middle_aged' | 'senior' | null
          ethnicity?: string | null
          voice_provider: 'elevenlabs' | 'azure' | 'aws_polly'
          voice_id: string
          preview_video_url?: string | null
          thumbnail_url?: string | null
          is_active?: boolean | null
          usage_count?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: 'business' | 'casual' | 'creative' | 'educational' | 'custom'
          gender?: 'male' | 'female' | 'non_binary' | null
          age_range?: 'young' | 'middle_aged' | 'senior' | null
          ethnicity?: string | null
          voice_provider?: 'elevenlabs' | 'azure' | 'aws_polly'
          voice_id?: string
          preview_video_url?: string | null
          thumbnail_url?: string | null
          is_active?: boolean | null
          usage_count?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      avatar_videos: {
        Row: {
          id: string
          user_id: string
          avatar_template_id: string
          script_text: string
          voice_settings: Json | null
          video_settings: Json | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          progress_percentage: number | null
          duration_seconds: number | null
          video_url: string | null
          audio_url: string | null
          thumbnail_url: string | null
          processing_provider: 'hedra' | 'sieve' | 'runwayml' | null
          external_job_id: string | null
          error_message: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          avatar_template_id: string
          script_text: string
          voice_settings?: Json | null
          video_settings?: Json | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          progress_percentage?: number | null
          duration_seconds?: number | null
          video_url?: string | null
          audio_url?: string | null
          thumbnail_url?: string | null
          processing_provider?: 'hedra' | 'sieve' | 'runwayml' | null
          external_job_id?: string | null
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          avatar_template_id?: string
          script_text?: string
          voice_settings?: Json | null
          video_settings?: Json | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          progress_percentage?: number | null
          duration_seconds?: number | null
          video_url?: string | null
          audio_url?: string | null
          thumbnail_url?: string | null
          processing_provider?: 'hedra' | 'sieve' | 'runwayml' | null
          external_job_id?: string | null
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      cancellation_feedback: {
        Row: {
          id: string
          user_id: string
          subscription_id: string
          primary_reason: 'too_expensive' | 'not_using_enough' | 'missing_features' | 'poor_quality' | 'switching_service' | 'other'
          secondary_reasons: string[] | null
          feedback_text: string | null
          would_recommend_score: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          subscription_id: string
          primary_reason: 'too_expensive' | 'not_using_enough' | 'missing_features' | 'poor_quality' | 'switching_service' | 'other'
          secondary_reasons?: string[] | null
          feedback_text?: string | null
          would_recommend_score?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          subscription_id?: string
          primary_reason?: 'too_expensive' | 'not_using_enough' | 'missing_features' | 'poor_quality' | 'switching_service' | 'other'
          secondary_reasons?: string[] | null
          feedback_text?: string | null
          would_recommend_score?: number | null
          created_at?: string | null
        }
      }
      cinematographer_videos: {
        Row: {
          id: string
          user_id: string
          project_name: string
          video_concept: string
          style_preferences: Json
          shot_list: Json | null
          status: 'planning' | 'shooting' | 'editing' | 'completed' | 'failed'
          progress_percentage: number | null
          total_duration_seconds: number | null
          final_video_url: string | null
          preview_urls: string[] | null
          metadata: Json | null
          ai_director_notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          project_name: string
          video_concept: string
          style_preferences: Json
          shot_list?: Json | null
          status: 'planning' | 'shooting' | 'editing' | 'completed' | 'failed'
          progress_percentage?: number | null
          total_duration_seconds?: number | null
          final_video_url?: string | null
          preview_urls?: string[] | null
          metadata?: Json | null
          ai_director_notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          project_name?: string
          video_concept?: string
          style_preferences?: Json
          shot_list?: Json | null
          status?: 'planning' | 'shooting' | 'editing' | 'completed' | 'failed'
          progress_percentage?: number | null
          total_duration_seconds?: number | null
          final_video_url?: string | null
          preview_urls?: string[] | null
          metadata?: Json | null
          ai_director_notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      clickbank_offers: {
        Row: {
          id: string
          clickbank_id: string
          title: string
          description: string | null
          category: string
          subcategory: string | null
          vendor_name: string
          initial_dollar_per_sale: number | null
          average_dollar_per_sale: number | null
          commission_rate: number | null
          gravity_score: number
          has_recurring_products: boolean | null
          activation_date: string | null
          languages: string[] | null
          mobile_optimized: boolean | null
          refund_rate: number | null
          affiliate_page_url: string | null
          sales_page_url: string | null
          is_active: boolean | null
          last_updated_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          clickbank_id: string
          title: string
          description?: string | null
          category: string
          subcategory?: string | null
          vendor_name: string
          initial_dollar_per_sale?: number | null
          average_dollar_per_sale?: number | null
          commission_rate?: number | null
          gravity_score: number
          has_recurring_products?: boolean | null
          activation_date?: string | null
          languages?: string[] | null
          mobile_optimized?: boolean | null
          refund_rate?: number | null
          affiliate_page_url?: string | null
          sales_page_url?: string | null
          is_active?: boolean | null
          last_updated_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          clickbank_id?: string
          title?: string
          description?: string | null
          category?: string
          subcategory?: string | null
          vendor_name?: string
          initial_dollar_per_sale?: number | null
          average_dollar_per_sale?: number | null
          commission_rate?: number | null
          gravity_score?: number
          has_recurring_products?: boolean | null
          activation_date?: string | null
          languages?: string[] | null
          mobile_optimized?: boolean | null
          refund_rate?: number | null
          affiliate_page_url?: string | null
          sales_page_url?: string | null
          is_active?: boolean | null
          last_updated_at?: string | null
          created_at?: string | null
        }
      }
      content_multiplier_history: {
        Row: {
          id: string
          user_id: string
          original_content: string
          generated_variants: Json
          settings: Json
          output_format: 'text' | 'markdown' | 'html' | 'json'
          word_count: number | null
          variant_count: number | null
          quality_score: number | null
          export_formats: string[] | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          original_content: string
          generated_variants: Json
          settings: Json
          output_format: 'text' | 'markdown' | 'html' | 'json'
          word_count?: number | null
          variant_count?: number | null
          quality_score?: number | null
          export_formats?: string[] | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          original_content?: string
          generated_variants?: Json
          settings?: Json
          output_format?: 'text' | 'markdown' | 'html' | 'json'
          word_count?: number | null
          variant_count?: number | null
          quality_score?: number | null
          export_formats?: string[] | null
          created_at?: string | null
        }
      }
      credit_usage: {
        Row: {
          id: string
          user_id: string
          service_type: 'ai_prediction' | 'content_generation' | 'media_generation' | 'avatar_video'
          credits_used: number
          operation_type: string
          reference_id: string | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          service_type: 'ai_prediction' | 'content_generation' | 'media_generation' | 'avatar_video'
          credits_used: number
          operation_type: string
          reference_id?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          service_type?: 'ai_prediction' | 'content_generation' | 'media_generation' | 'avatar_video'
          credits_used?: number
          operation_type?: string
          reference_id?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
      }
      ebook_history: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          genre: string | null
          target_audience: string | null
          chapter_count: number
          total_word_count: number
          status: 'draft' | 'generating' | 'completed' | 'failed'
          generation_progress: number | null
          content_structure: Json | null
          generated_content: Json | null
          export_formats: string[] | null
          cover_image_url: string | null
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          genre?: string | null
          target_audience?: string | null
          chapter_count?: number
          total_word_count?: number
          status: 'draft' | 'generating' | 'completed' | 'failed'
          generation_progress?: number | null
          content_structure?: Json | null
          generated_content?: Json | null
          export_formats?: string[] | null
          cover_image_url?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          genre?: string | null
          target_audience?: string | null
          chapter_count?: number
          total_word_count?: number
          status?: 'draft' | 'generating' | 'completed' | 'failed'
          generation_progress?: number | null
          content_structure?: Json | null
          generated_content?: Json | null
          export_formats?: string[] | null
          cover_image_url?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      ebook_writer_history: {
        Row: {
          id: string
          user_id: string
          ebook_id: string | null
          writing_session_id: string
          chapter_number: number
          chapter_title: string
          content_prompt: string
          generated_content: string | null
          word_count: number | null
          writing_style: string | null
          tone: string | null
          revision_count: number
          feedback_applied: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          ebook_id?: string | null
          writing_session_id: string
          chapter_number: number
          chapter_title: string
          content_prompt: string
          generated_content?: string | null
          word_count?: number | null
          writing_style?: string | null
          tone?: string | null
          revision_count?: number
          feedback_applied?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          ebook_id?: string | null
          writing_session_id?: string
          chapter_number?: number
          chapter_title?: string
          content_prompt?: string
          generated_content?: string | null
          word_count?: number | null
          writing_style?: string | null
          tone?: string | null
          revision_count?: number
          feedback_applied?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      generated_images: {
        Row: {
          id: string
          user_id: string
          prompt: string
          negative_prompt: string | null
          image_style: 'realistic' | 'artistic' | 'cartoon' | 'abstract' | 'photographic' | null
          dimensions: 'square' | 'portrait' | 'landscape' | 'wide' | 'tall'
          width: number
          height: number
          model_name: string
          model_version: string | null
          generation_settings: Json | null
          batch_id: string | null
          variations_count: number | null
          image_urls: string[]
          thumbnail_urls: string[] | null
          file_formats: string[] | null
          quality_score: number | null
          download_count: number | null
          is_favorite: boolean | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          prompt: string
          negative_prompt?: string | null
          image_style?: 'realistic' | 'artistic' | 'cartoon' | 'abstract' | 'photographic' | null
          dimensions: 'square' | 'portrait' | 'landscape' | 'wide' | 'tall'
          width: number
          height: number
          model_name: string
          model_version?: string | null
          generation_settings?: Json | null
          batch_id?: string | null
          variations_count?: number | null
          image_urls: string[]
          thumbnail_urls?: string[] | null
          file_formats?: string[] | null
          quality_score?: number | null
          download_count?: number | null
          is_favorite?: boolean | null
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          prompt?: string
          negative_prompt?: string | null
          image_style?: 'realistic' | 'artistic' | 'cartoon' | 'abstract' | 'photographic' | null
          dimensions?: 'square' | 'portrait' | 'landscape' | 'wide' | 'tall'
          width?: number
          height?: number
          model_name?: string
          model_version?: string | null
          generation_settings?: Json | null
          batch_id?: string | null
          variations_count?: number | null
          image_urls?: string[]
          thumbnail_urls?: string[] | null
          file_formats?: string[] | null
          quality_score?: number | null
          download_count?: number | null
          is_favorite?: boolean | null
          metadata?: Json | null
          created_at?: string | null
        }
      }
      generated_voices: {
        Row: {
          id: string
          user_id: string
          voice_name: string
          text_content: string
          voice_provider: 'elevenlabs' | 'azure' | 'aws_polly' | 'murf' | 'minimax' | 'openai'
          voice_id: string
          voice_settings: Json | null
          audio_format: 'mp3' | 'wav' | 'aac' | 'flac'
          duration_seconds: number | null
          audio_url: string | null
          file_size_bytes: number | null
          quality_rating: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          voice_name: string
          text_content: string
          voice_provider: 'elevenlabs' | 'azure' | 'aws_polly' | 'murf' | 'minimax' | 'openai'
          voice_id: string
          voice_settings?: Json | null
          audio_format: 'mp3' | 'wav' | 'aac' | 'flac'
          duration_seconds?: number | null
          audio_url?: string | null
          file_size_bytes?: number | null
          quality_rating?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          voice_name?: string
          text_content?: string
          voice_provider?: 'elevenlabs' | 'azure' | 'aws_polly' | 'murf' | 'minimax' | 'openai'
          voice_id?: string
          voice_settings?: Json | null
          audio_format?: 'mp3' | 'wav' | 'aac' | 'flac'
          duration_seconds?: number | null
          audio_url?: string | null
          file_size_bytes?: number | null
          quality_rating?: number | null
          created_at?: string | null
        }
      }
      cloned_voices: {
        Row: {
          id: string
          user_id: string
          name: string
          minimax_voice_id: string
          source_audio_url: string | null
          preview_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          minimax_voice_id: string
          source_audio_url?: string | null
          preview_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          minimax_voice_id?: string
          source_audio_url?: string | null
          preview_url?: string | null
          created_at?: string
        }
      }
      user_saved_avatars: {
        Row: {
          id: string
          user_id: string
          name: string
          image_url: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          image_url: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          image_url?: string
          created_at?: string
        }
      }
      keywords: {
        Row: {
          id: string
          keyword: string
          search_volume: number | null
          difficulty_score: number | null
          competition_level: 'low' | 'medium' | 'high' | null
          cost_per_click: number | null
          target_page_url: string | null
          current_rank: number | null
          target_rank: number | null
          category: string | null
          is_active: boolean | null
          last_checked_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          keyword: string
          search_volume?: number | null
          difficulty_score?: number | null
          competition_level?: 'low' | 'medium' | 'high' | null
          cost_per_click?: number | null
          target_page_url?: string | null
          current_rank?: number | null
          target_rank?: number | null
          category?: string | null
          is_active?: boolean | null
          last_checked_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          keyword?: string
          search_volume?: number | null
          difficulty_score?: number | null
          competition_level?: 'low' | 'medium' | 'high' | null
          cost_per_click?: number | null
          target_page_url?: string | null
          current_rank?: number | null
          target_rank?: number | null
          category?: string | null
          is_active?: boolean | null
          last_checked_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      music_history: {
        Row: {
          id: string
          user_id: string
          track_title: string
          description: string | null
          genre: string
          mood: string
          tempo: number | null
          key_signature: string | null
          duration_seconds: number
          generation_settings: Json | null
          status: 'pending' | 'generating' | 'completed' | 'failed'
          progress_percentage: number | null
          audio_url: string | null
          waveform_url: string | null
          lyrics: string | null
          instrument_breakdown: Json | null
          quality_rating: number | null
          download_count: number | null
          is_favorite: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          track_title: string
          description?: string | null
          genre: string
          mood: string
          tempo?: number | null
          key_signature?: string | null
          duration_seconds: number
          generation_settings?: Json | null
          status: 'pending' | 'generating' | 'completed' | 'failed'
          progress_percentage?: number | null
          audio_url?: string | null
          waveform_url?: string | null
          lyrics?: string | null
          instrument_breakdown?: Json | null
          quality_rating?: number | null
          download_count?: number | null
          is_favorite?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          track_title?: string
          description?: string | null
          genre?: string
          mood?: string
          tempo?: number | null
          key_signature?: string | null
          duration_seconds?: number
          generation_settings?: Json | null
          status?: 'pending' | 'generating' | 'completed' | 'failed'
          progress_percentage?: number | null
          audio_url?: string | null
          waveform_url?: string | null
          lyrics?: string | null
          instrument_breakdown?: Json | null
          quality_rating?: number | null
          download_count?: number | null
          is_favorite?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      placeholders: {
        Row: {
          id: string
          key: string
          value: string
          description: string | null
          category: string
          data_type: 'text' | 'html' | 'json' | 'markdown'
          is_system: boolean | null
          is_translatable: boolean | null
          validation_rules: Json | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          key: string
          value: string
          description?: string | null
          category: string
          data_type: 'text' | 'html' | 'json' | 'markdown'
          is_system?: boolean | null
          is_translatable?: boolean | null
          validation_rules?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          key?: string
          value?: string
          description?: string | null
          category?: string
          data_type?: 'text' | 'html' | 'json' | 'markdown'
          is_system?: boolean | null
          is_translatable?: boolean | null
          validation_rules?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string | null
          bio: string | null
          avatar_url: string | null
          role?: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          username: string
          full_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          role?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          username?: string
          full_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          role?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      score_history: {
        Row: {
          id: string
          offer_id: string
          gravity_score: number
          sales_rank: number | null
          category_rank: number | null
          trend_direction: 'up' | 'down' | 'stable' | null
          trend_strength: number | null
          weekly_change: number | null
          monthly_change: number | null
          recorded_at: string | null
        }
        Insert: {
          id?: string
          offer_id: string
          gravity_score: number
          sales_rank?: number | null
          category_rank?: number | null
          trend_direction?: 'up' | 'down' | 'stable' | null
          trend_strength?: number | null
          weekly_change?: number | null
          monthly_change?: number | null
          recorded_at?: string | null
        }
        Update: {
          id?: string
          offer_id?: string
          gravity_score?: number
          sales_rank?: number | null
          category_rank?: number | null
          trend_direction?: 'up' | 'down' | 'stable' | null
          trend_strength?: number | null
          weekly_change?: number | null
          monthly_change?: number | null
          recorded_at?: string | null
        }
      }
      script_to_video_history: {
        Row: {
          id: string
          user_id: string
          script_title: string
          script_content: string
          video_style: 'talking_head' | 'slideshow' | 'animation' | 'live_action'
          duration_seconds: number | null
          resolution: '720p' | '1080p' | '4k'
          status: 'pending' | 'processing' | 'completed' | 'failed'
          progress_percentage: number | null
          video_url: string | null
          thumbnail_url: string | null
          captions_url: string | null
          rendering_settings: Json | null
          processing_logs: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          script_title: string
          script_content: string
          video_style: 'talking_head' | 'slideshow' | 'animation' | 'live_action'
          duration_seconds?: number | null
          resolution: '720p' | '1080p' | '4k'
          status: 'pending' | 'processing' | 'completed' | 'failed'
          progress_percentage?: number | null
          video_url?: string | null
          thumbnail_url?: string | null
          captions_url?: string | null
          rendering_settings?: Json | null
          processing_logs?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          script_title?: string
          script_content?: string
          video_style?: 'talking_head' | 'slideshow' | 'animation' | 'live_action'
          duration_seconds?: number | null
          resolution?: '720p' | '1080p' | '4k'
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          progress_percentage?: number | null
          video_url?: string | null
          thumbnail_url?: string | null
          captions_url?: string | null
          rendering_settings?: Json | null
          processing_logs?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tutorials: {
        Row: {
          id: string
          title: string
          description: string | null
          content: string
          category: string
          difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null
          estimated_duration_minutes: number | null
          prerequisites: string[] | null
          learning_objectives: string[] | null
          tool_name: string | null
          video_url: string | null
          thumbnail_url: string | null
          is_published: boolean | null
          view_count: number | null
          rating: number | null
          rating_count: number | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          content: string
          category: string
          difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
          estimated_duration_minutes?: number | null
          prerequisites?: string[] | null
          learning_objectives?: string[] | null
          tool_name?: string | null
          video_url?: string | null
          thumbnail_url?: string | null
          is_published?: boolean | null
          view_count?: number | null
          rating?: number | null
          rating_count?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          content?: string
          category?: string
          difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
          estimated_duration_minutes?: number | null
          prerequisites?: string[] | null
          learning_objectives?: string[] | null
          tool_name?: string | null
          video_url?: string | null
          thumbnail_url?: string | null
          is_published?: boolean | null
          view_count?: number | null
          rating?: number | null
          rating_count?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      user_credits: {
        Row: {
          id: string
          user_id: string
          total_credits: number
          used_credits: number
          available_credits: number | null
          period_start: string
          period_end: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          total_credits?: number
          used_credits?: number
          available_credits?: number | null
          period_start: string
          period_end: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          total_credits?: number
          used_credits?: number
          available_credits?: number | null
          period_start?: string
          period_end?: string
          created_at?: string | null
          updated_at?: string | null
        }
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_type: 'free' | 'starter' | 'pro' | 'enterprise'
          status: 'trial' | 'active' | 'cancelled' | 'expired' | 'pending'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean | null
          credits_per_month: number
          max_concurrent_jobs: number
          stripe_subscription_id: string | null
          stripe_customer_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          plan_type: 'free' | 'starter' | 'pro' | 'enterprise'
          status: 'trial' | 'active' | 'cancelled' | 'expired' | 'pending'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end?: boolean | null
          credits_per_month?: number
          max_concurrent_jobs?: number
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          plan_type?: 'free' | 'starter' | 'pro' | 'enterprise'
          status?: 'trial' | 'active' | 'cancelled' | 'expired' | 'pending'
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean | null
          credits_per_month?: number
          max_concurrent_jobs?: number
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      video_render_progress: {
        Row: {
          id: string
          user_id: string
          video_id: string
          video_type: 'avatar_video' | 'cinematographer_video' | 'script_to_video'
          stage: 'queued' | 'preprocessing' | 'rendering' | 'postprocessing' | 'uploading' | 'completed' | 'failed'
          progress_percentage: number | null
          current_operation: string | null
          estimated_completion_time: string | null
          error_details: Json | null
          performance_metrics: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          video_type: 'avatar_video' | 'cinematographer_video' | 'script_to_video'
          stage: 'queued' | 'preprocessing' | 'rendering' | 'postprocessing' | 'uploading' | 'completed' | 'failed'
          progress_percentage?: number | null
          current_operation?: string | null
          estimated_completion_time?: string | null
          error_details?: Json | null
          performance_metrics?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          video_type?: 'avatar_video' | 'cinematographer_video' | 'script_to_video'
          stage?: 'queued' | 'preprocessing' | 'rendering' | 'postprocessing' | 'uploading' | 'completed' | 'failed'
          progress_percentage?: number | null
          current_operation?: string | null
          estimated_completion_time?: string | null
          error_details?: Json | null
          performance_metrics?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience type aliases
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Specific table types for common usage
export type Profile = Tables<'profiles'>
export type UserSubscription = Tables<'user_subscriptions'>
export type UserCredits = Tables<'user_credits'>
export type CreditUsage = Tables<'credit_usage'>
export type AvatarVideo = Tables<'avatar_videos'>
export type GeneratedImage = Tables<'generated_images'>
export type MusicHistory = Tables<'music_history'>
export type ContentMultiplierHistory = Tables<'content_multiplier_history'>
export type EbookHistory = Tables<'ebook_history'>
export type Announcement = Tables<'announcements'>
export type Tutorial = Tables<'tutorials'>

// Insert types for common usage
export type ProfileInsert = InsertTables<'profiles'>
export type UserSubscriptionInsert = InsertTables<'user_subscriptions'>
export type UserCreditsInsert = InsertTables<'user_credits'>
export type CreditUsageInsert = InsertTables<'credit_usage'>
export type AvatarVideoInsert = InsertTables<'avatar_videos'>
export type GeneratedImageInsert = InsertTables<'generated_images'>

// Update types for common usage
export type ProfileUpdate = UpdateTables<'profiles'>
export type UserSubscriptionUpdate = UpdateTables<'user_subscriptions'>
export type UserCreditsUpdate = UpdateTables<'user_credits'>
export type AvatarVideoUpdate = UpdateTables<'avatar_videos'>
export type GeneratedImageUpdate = UpdateTables<'generated_images'>