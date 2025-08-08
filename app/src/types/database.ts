export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_purchases: {
        Row: {
          addon_type: string
          created_at: string | null
          id: string
          payment_status: string
          price_paid: number
          user_id: string
        }
        Insert: {
          addon_type: string
          created_at?: string | null
          id?: string
          payment_status: string
          price_paid: number
          user_id: string
        }
        Update: {
          addon_type?: string
          created_at?: string | null
          id?: string
          payment_status?: string
          price_paid?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_predictions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          input_data: Json | null
          logs: string | null
          model_version: string
          output_data: Json | null
          prediction_id: string
          service_id: string
          status: string
          tool_id: string
          updated_at: string | null
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          input_data?: Json | null
          logs?: string | null
          model_version: string
          output_data?: Json | null
          prediction_id: string
          service_id: string
          status: string
          tool_id: string
          updated_at?: string | null
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          input_data?: Json | null
          logs?: string | null
          model_version?: string
          output_data?: Json | null
          prediction_id?: string
          service_id?: string
          status?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean | null
          is_dismissible: boolean | null
          priority: number
          starts_at: string | null
          target_audience: string[] | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          is_dismissible?: boolean | null
          priority?: number
          starts_at?: string | null
          target_audience?: string[] | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          is_dismissible?: boolean | null
          priority?: number
          starts_at?: string | null
          target_audience?: string[] | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      avatar_templates: {
        Row: {
          age_range: string | null
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          ethnicity: string | null
          gender: string | null
          id: string
          is_active: boolean | null
          name: string
          preview_video_url: string | null
          thumbnail_url: string | null
          updated_at: string | null
          usage_count: number | null
          voice_id: string
          voice_provider: string
        }
        Insert: {
          age_range?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ethnicity?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          preview_video_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
          voice_id: string
          voice_provider: string
        }
        Update: {
          age_range?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ethnicity?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          preview_video_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
          voice_id?: string
          voice_provider?: string
        }
        Relationships: []
      }
      avatar_videos: {
        Row: {
          audio_url: string | null
          avatar_template_id: string
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          external_job_id: string | null
          id: string
          processing_provider: string | null
          progress_percentage: number | null
          script_text: string
          status: string
          thumbnail_url: string | null
          updated_at: string | null
          user_id: string
          video_settings: Json | null
          video_url: string | null
          voice_settings: Json | null
        }
        Insert: {
          audio_url?: string | null
          avatar_template_id: string
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          external_job_id?: string | null
          id?: string
          processing_provider?: string | null
          progress_percentage?: number | null
          script_text: string
          status: string
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id: string
          video_settings?: Json | null
          video_url?: string | null
          voice_settings?: Json | null
        }
        Update: {
          audio_url?: string | null
          avatar_template_id?: string
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          external_job_id?: string | null
          id?: string
          processing_provider?: string | null
          progress_percentage?: number | null
          script_text?: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string
          video_settings?: Json | null
          video_url?: string | null
          voice_settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "avatar_videos_avatar_template_id_fkey"
            columns: ["avatar_template_id"]
            isOneToOne: false
            referencedRelation: "avatar_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_feedback: {
        Row: {
          created_at: string | null
          feedback_text: string | null
          id: string
          primary_reason: string
          secondary_reasons: string[] | null
          subscription_id: string
          user_id: string
          would_recommend_score: number | null
        }
        Insert: {
          created_at?: string | null
          feedback_text?: string | null
          id?: string
          primary_reason: string
          secondary_reasons?: string[] | null
          subscription_id: string
          user_id: string
          would_recommend_score?: number | null
        }
        Update: {
          created_at?: string | null
          feedback_text?: string | null
          id?: string
          primary_reason?: string
          secondary_reasons?: string[] | null
          subscription_id?: string
          user_id?: string
          would_recommend_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_feedback_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      cinematographer_videos: {
        Row: {
          ai_director_notes: string | null
          created_at: string | null
          final_video_url: string | null
          id: string
          metadata: Json | null
          preview_urls: string[] | null
          progress_percentage: number | null
          project_name: string
          shot_list: Json | null
          status: string
          style_preferences: Json
          total_duration_seconds: number | null
          updated_at: string | null
          user_id: string
          video_concept: string
        }
        Insert: {
          ai_director_notes?: string | null
          created_at?: string | null
          final_video_url?: string | null
          id?: string
          metadata?: Json | null
          preview_urls?: string[] | null
          progress_percentage?: number | null
          project_name: string
          shot_list?: Json | null
          status: string
          style_preferences: Json
          total_duration_seconds?: number | null
          updated_at?: string | null
          user_id: string
          video_concept: string
        }
        Update: {
          ai_director_notes?: string | null
          created_at?: string | null
          final_video_url?: string | null
          id?: string
          metadata?: Json | null
          preview_urls?: string[] | null
          progress_percentage?: number | null
          project_name?: string
          shot_list?: Json | null
          status?: string
          style_preferences?: Json
          total_duration_seconds?: number | null
          updated_at?: string | null
          user_id?: string
          video_concept?: string
        }
        Relationships: []
      }
      clickbank_offers: {
        Row: {
          activation_date: string | null
          affiliate_page_url: string | null
          average_dollar_per_sale: number | null
          category: string
          clickbank_id: string
          commission_rate: number | null
          created_at: string | null
          description: string | null
          gravity_score: number
          has_recurring_products: boolean | null
          id: string
          initial_dollar_per_sale: number | null
          is_active: boolean | null
          languages: string[] | null
          last_updated_at: string | null
          mobile_optimized: boolean | null
          refund_rate: number | null
          sales_page_url: string | null
          subcategory: string | null
          title: string
          vendor_name: string
        }
        Insert: {
          activation_date?: string | null
          affiliate_page_url?: string | null
          average_dollar_per_sale?: number | null
          category: string
          clickbank_id: string
          commission_rate?: number | null
          created_at?: string | null
          description?: string | null
          gravity_score: number
          has_recurring_products?: boolean | null
          id?: string
          initial_dollar_per_sale?: number | null
          is_active?: boolean | null
          languages?: string[] | null
          last_updated_at?: string | null
          mobile_optimized?: boolean | null
          refund_rate?: number | null
          sales_page_url?: string | null
          subcategory?: string | null
          title: string
          vendor_name: string
        }
        Update: {
          activation_date?: string | null
          affiliate_page_url?: string | null
          average_dollar_per_sale?: number | null
          category?: string
          clickbank_id?: string
          commission_rate?: number | null
          created_at?: string | null
          description?: string | null
          gravity_score?: number
          has_recurring_products?: boolean | null
          id?: string
          initial_dollar_per_sale?: number | null
          is_active?: boolean | null
          languages?: string[] | null
          last_updated_at?: string | null
          mobile_optimized?: boolean | null
          refund_rate?: number | null
          sales_page_url?: string | null
          subcategory?: string | null
          title?: string
          vendor_name?: string
        }
        Relationships: []
      }
      content_multiplier_history: {
        Row: {
          created_at: string | null
          export_formats: string[] | null
          generated_variants: Json
          id: string
          original_content: string
          output_format: string
          quality_score: number | null
          settings: Json
          user_id: string
          variant_count: number | null
          word_count: number | null
        }
        Insert: {
          created_at?: string | null
          export_formats?: string[] | null
          generated_variants: Json
          id?: string
          original_content: string
          output_format: string
          quality_score?: number | null
          settings: Json
          user_id: string
          variant_count?: number | null
          word_count?: number | null
        }
        Update: {
          created_at?: string | null
          export_formats?: string[] | null
          generated_variants?: Json
          id?: string
          original_content?: string
          output_format?: string
          quality_score?: number | null
          settings?: Json
          user_id?: string
          variant_count?: number | null
          word_count?: number | null
        }
        Relationships: []
      }
      credit_usage: {
        Row: {
          created_at: string | null
          credits_used: number
          id: string
          metadata: Json | null
          operation_type: string
          reference_id: string | null
          service_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credits_used: number
          id?: string
          metadata?: Json | null
          operation_type: string
          reference_id?: string | null
          service_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          credits_used?: number
          id?: string
          metadata?: Json | null
          operation_type?: string
          reference_id?: string | null
          service_type?: string
          user_id?: string
        }
        Relationships: []
      }
      ebook_history: {
        Row: {
          chapter_count: number
          content_structure: Json | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          export_formats: string[] | null
          generated_content: Json | null
          generation_progress: number | null
          genre: string | null
          id: string
          metadata: Json | null
          status: string
          target_audience: string | null
          title: string
          total_word_count: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chapter_count?: number
          content_structure?: Json | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          export_formats?: string[] | null
          generated_content?: Json | null
          generation_progress?: number | null
          genre?: string | null
          id?: string
          metadata?: Json | null
          status: string
          target_audience?: string | null
          title: string
          total_word_count?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chapter_count?: number
          content_structure?: Json | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          export_formats?: string[] | null
          generated_content?: Json | null
          generation_progress?: number | null
          genre?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          target_audience?: string | null
          title?: string
          total_word_count?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ebook_writer_history: {
        Row: {
          chapter_number: number
          chapter_title: string
          content_prompt: string
          created_at: string | null
          ebook_id: string | null
          feedback_applied: Json | null
          generated_content: string | null
          id: string
          revision_count: number
          tone: string | null
          updated_at: string | null
          user_id: string
          word_count: number | null
          writing_session_id: string
          writing_style: string | null
        }
        Insert: {
          chapter_number: number
          chapter_title: string
          content_prompt: string
          created_at?: string | null
          ebook_id?: string | null
          feedback_applied?: Json | null
          generated_content?: string | null
          id?: string
          revision_count?: number
          tone?: string | null
          updated_at?: string | null
          user_id: string
          word_count?: number | null
          writing_session_id: string
          writing_style?: string | null
        }
        Update: {
          chapter_number?: number
          chapter_title?: string
          content_prompt?: string
          created_at?: string | null
          ebook_id?: string | null
          feedback_applied?: Json | null
          generated_content?: string | null
          id?: string
          revision_count?: number
          tone?: string | null
          updated_at?: string | null
          user_id?: string
          word_count?: number | null
          writing_session_id?: string
          writing_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ebook_writer_history_ebook_id_fkey"
            columns: ["ebook_id"]
            isOneToOne: false
            referencedRelation: "ebook_history"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_images: {
        Row: {
          batch_id: string | null
          created_at: string | null
          dimensions: string
          download_count: number | null
          file_formats: string[] | null
          generation_settings: Json | null
          height: number
          id: string
          image_style: string | null
          image_urls: string[]
          is_favorite: boolean | null
          metadata: Json | null
          model_name: string
          model_version: string | null
          negative_prompt: string | null
          prompt: string
          quality_score: number | null
          thumbnail_urls: string[] | null
          user_id: string
          variations_count: number | null
          width: number
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          dimensions: string
          download_count?: number | null
          file_formats?: string[] | null
          generation_settings?: Json | null
          height: number
          id?: string
          image_style?: string | null
          image_urls: string[]
          is_favorite?: boolean | null
          metadata?: Json | null
          model_name: string
          model_version?: string | null
          negative_prompt?: string | null
          prompt: string
          quality_score?: number | null
          thumbnail_urls?: string[] | null
          user_id: string
          variations_count?: number | null
          width: number
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          dimensions?: string
          download_count?: number | null
          file_formats?: string[] | null
          generation_settings?: Json | null
          height?: number
          id?: string
          image_style?: string | null
          image_urls?: string[]
          is_favorite?: boolean | null
          metadata?: Json | null
          model_name?: string
          model_version?: string | null
          negative_prompt?: string | null
          prompt?: string
          quality_score?: number | null
          thumbnail_urls?: string[] | null
          user_id?: string
          variations_count?: number | null
          width?: number
        }
        Relationships: []
      }
      generated_voices: {
        Row: {
          audio_format: string
          audio_url: string | null
          batch_id: string | null
          created_at: string | null
          credits_used: number | null
          duration_seconds: number | null
          export_format: string | null
          file_size_bytes: number | null
          file_size_mb: number | null
          id: string
          quality_rating: number | null
          script_text: string | null
          text_content: string
          user_id: string
          voice_id: string
          voice_name: string
          voice_provider: string
          voice_settings: Json | null
        }
        Insert: {
          audio_format: string
          audio_url?: string | null
          batch_id?: string | null
          created_at?: string | null
          credits_used?: number | null
          duration_seconds?: number | null
          export_format?: string | null
          file_size_bytes?: number | null
          file_size_mb?: number | null
          id?: string
          quality_rating?: number | null
          script_text?: string | null
          text_content: string
          user_id: string
          voice_id: string
          voice_name: string
          voice_provider: string
          voice_settings?: Json | null
        }
        Update: {
          audio_format?: string
          audio_url?: string | null
          batch_id?: string | null
          created_at?: string | null
          credits_used?: number | null
          duration_seconds?: number | null
          export_format?: string | null
          file_size_bytes?: number | null
          file_size_mb?: number | null
          id?: string
          quality_rating?: number | null
          script_text?: string | null
          text_content?: string
          user_id?: string
          voice_id?: string
          voice_name?: string
          voice_provider?: string
          voice_settings?: Json | null
        }
        Relationships: []
      }
      generation_metrics: {
        Row: {
          created_at: string | null
          credits_used: number
          generation_time_ms: number
          id: string
          metadata: Json | null
          tool_name: string
          user_id: string
          workflow_type: string | null
        }
        Insert: {
          created_at?: string | null
          credits_used?: number
          generation_time_ms?: number
          id?: string
          metadata?: Json | null
          tool_name: string
          user_id: string
          workflow_type?: string | null
        }
        Update: {
          created_at?: string | null
          credits_used?: number
          generation_time_ms?: number
          id?: string
          metadata?: Json | null
          tool_name?: string
          user_id?: string
          workflow_type?: string | null
        }
        Relationships: []
      }
      keywords: {
        Row: {
          category: string | null
          competition_level: string | null
          cost_per_click: number | null
          created_at: string | null
          current_rank: number | null
          difficulty_score: number | null
          id: string
          is_active: boolean | null
          keyword: string
          last_checked_at: string | null
          search_volume: number | null
          target_page_url: string | null
          target_rank: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          competition_level?: string | null
          cost_per_click?: number | null
          created_at?: string | null
          current_rank?: number | null
          difficulty_score?: number | null
          id?: string
          is_active?: boolean | null
          keyword: string
          last_checked_at?: string | null
          search_volume?: number | null
          target_page_url?: string | null
          target_rank?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          competition_level?: string | null
          cost_per_click?: number | null
          created_at?: string | null
          current_rank?: number | null
          difficulty_score?: number | null
          id?: string
          is_active?: boolean | null
          keyword?: string
          last_checked_at?: string | null
          search_volume?: number | null
          target_page_url?: string | null
          target_rank?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      music_history: {
        Row: {
          audio_url: string | null
          created_at: string | null
          description: string | null
          download_count: number | null
          duration_seconds: number
          generation_settings: Json | null
          genre: string
          id: string
          instrument_breakdown: Json | null
          is_favorite: boolean | null
          key_signature: string | null
          lyrics: string | null
          mood: string
          progress_percentage: number | null
          quality_rating: number | null
          status: string
          tempo: number | null
          track_title: string
          updated_at: string | null
          user_id: string
          waveform_url: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          duration_seconds: number
          generation_settings?: Json | null
          genre: string
          id?: string
          instrument_breakdown?: Json | null
          is_favorite?: boolean | null
          key_signature?: string | null
          lyrics?: string | null
          mood: string
          progress_percentage?: number | null
          quality_rating?: number | null
          status: string
          tempo?: number | null
          track_title: string
          updated_at?: string | null
          user_id: string
          waveform_url?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          duration_seconds?: number
          generation_settings?: Json | null
          genre?: string
          id?: string
          instrument_breakdown?: Json | null
          is_favorite?: boolean | null
          key_signature?: string | null
          lyrics?: string | null
          mood?: string
          progress_percentage?: number | null
          quality_rating?: number | null
          status?: string
          tempo?: number | null
          track_title?: string
          updated_at?: string | null
          user_id?: string
          waveform_url?: string | null
        }
        Relationships: []
      }
      placeholders: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          data_type: string
          description: string | null
          id: string
          is_system: boolean | null
          is_translatable: boolean | null
          key: string
          updated_at: string | null
          validation_rules: Json | null
          value: string
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          data_type: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          is_translatable?: boolean | null
          key: string
          updated_at?: string | null
          validation_rules?: Json | null
          value: string
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          data_type?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          is_translatable?: boolean | null
          key?: string
          updated_at?: string | null
          validation_rules?: Json | null
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_suspended: boolean | null
          role: string | null
          suspension_reason: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_suspended?: boolean | null
          role?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_suspended?: boolean | null
          role?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      publishing_queue: {
        Row: {
          content_variant_id: string
          created_at: string | null
          error_message: string | null
          id: string
          max_retries: number | null
          platform: string
          published_at: string | null
          retry_count: number | null
          scheduled_time: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_variant_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          platform: string
          published_at?: string | null
          retry_count?: number | null
          scheduled_time: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_variant_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          platform?: string
          published_at?: string | null
          retry_count?: number | null
          scheduled_time?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_publishing_queue_content_variant"
            columns: ["content_variant_id"]
            isOneToOne: false
            referencedRelation: "content_multiplier_history"
            referencedColumns: ["id"]
          },
        ]
      }
      score_history: {
        Row: {
          category_rank: number | null
          gravity_score: number
          id: string
          monthly_change: number | null
          offer_id: string
          recorded_at: string | null
          sales_rank: number | null
          trend_direction: string | null
          trend_strength: number | null
          weekly_change: number | null
        }
        Insert: {
          category_rank?: number | null
          gravity_score: number
          id?: string
          monthly_change?: number | null
          offer_id: string
          recorded_at?: string | null
          sales_rank?: number | null
          trend_direction?: string | null
          trend_strength?: number | null
          weekly_change?: number | null
        }
        Update: {
          category_rank?: number | null
          gravity_score?: number
          id?: string
          monthly_change?: number | null
          offer_id?: string
          recorded_at?: string | null
          sales_rank?: number | null
          trend_direction?: string | null
          trend_strength?: number | null
          weekly_change?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "score_history_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "clickbank_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      script_to_video_history: {
        Row: {
          captions_url: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          processing_logs: Json | null
          progress_percentage: number | null
          rendering_settings: Json | null
          resolution: string
          script_content: string
          script_title: string
          status: string
          thumbnail_url: string | null
          updated_at: string | null
          user_id: string
          video_style: string
          video_url: string | null
        }
        Insert: {
          captions_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          processing_logs?: Json | null
          progress_percentage?: number | null
          rendering_settings?: Json | null
          resolution: string
          script_content: string
          script_title: string
          status: string
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id: string
          video_style: string
          video_url?: string | null
        }
        Update: {
          captions_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          processing_logs?: Json | null
          progress_percentage?: number | null
          rendering_settings?: Json | null
          resolution?: string
          script_content?: string
          script_title?: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string
          video_style?: string
          video_url?: string | null
        }
        Relationships: []
      }
      social_platform_connections: {
        Row: {
          access_token_encrypted: string | null
          avatar_url: string | null
          connected: boolean | null
          connection_status: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          last_connected: string | null
          platform: string
          refresh_token_encrypted: string | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          avatar_url?: string | null
          connected?: boolean | null
          connection_status?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_connected?: string | null
          platform: string
          refresh_token_encrypted?: string | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          avatar_url?: string | null
          connected?: boolean | null
          connection_status?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_connected?: string | null
          platform?: string
          refresh_token_encrypted?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      tutorials: {
        Row: {
          category: string
          content: string
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty_level: string | null
          estimated_duration_minutes: number | null
          id: string
          is_published: boolean | null
          learning_objectives: string[] | null
          prerequisites: string[] | null
          rating: number | null
          rating_count: number | null
          thumbnail_url: string | null
          title: string
          tool_name: string | null
          updated_at: string | null
          video_url: string | null
          view_count: number | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          learning_objectives?: string[] | null
          prerequisites?: string[] | null
          rating?: number | null
          rating_count?: number | null
          thumbnail_url?: string | null
          title: string
          tool_name?: string | null
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          learning_objectives?: string[] | null
          prerequisites?: string[] | null
          rating?: number | null
          rating_count?: number | null
          thumbnail_url?: string | null
          title?: string
          tool_name?: string | null
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          available_credits: number | null
          bonus_credits: number | null
          created_at: string | null
          id: string
          period_end: string
          period_start: string
          total_credits: number
          updated_at: string | null
          used_credits: number
          user_id: string
        }
        Insert: {
          available_credits?: number | null
          bonus_credits?: number | null
          created_at?: string | null
          id?: string
          period_end: string
          period_start: string
          total_credits?: number
          updated_at?: string | null
          used_credits?: number
          user_id: string
        }
        Update: {
          available_credits?: number | null
          bonus_credits?: number | null
          created_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          total_credits?: number
          updated_at?: string | null
          used_credits?: number
          user_id?: string
        }
        Relationships: []
      }
      user_migration_reference: {
        Row: {
          auth_avatar_url: string | null
          auth_first_name: string | null
          auth_last_name: string | null
          confirmed_at: string | null
          created_at: string | null
          credits_available: number | null
          credits_monthly_allocation: number | null
          email: string
          email_confirmed_at: string | null
          full_name: string | null
          has_active_subscription: boolean | null
          has_canceled_subscription: boolean | null
          has_deactivated_subscription: boolean | null
          has_trial_subscription: boolean | null
          id: string
          last_allocation_date: string | null
          last_sign_in_at: string | null
          legacy_auth_user_id: string
          legacy_profile_created_at: string | null
          legacy_profile_id: string | null
          legacy_profile_updated_at: string | null
          migrated_at: string | null
          migration_status: string | null
          new_user_id: string | null
          notes: string | null
          profile_email: string | null
          profile_first_name: string | null
          profile_last_name: string | null
          profile_role: string | null
          profile_source: string | null
          profile_username: string | null
          subscription_auto_renew: boolean | null
          subscription_created_at: string | null
          subscription_id: string | null
          subscription_period_end: string | null
          subscription_period_start: string | null
          subscription_plan_type: string | null
          subscription_status: string | null
          subscription_updated_at: string | null
          total_subscriptions: number | null
          user_created_at: string | null
          user_updated_at: string | null
        }
        Insert: {
          auth_avatar_url?: string | null
          auth_first_name?: string | null
          auth_last_name?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          credits_available?: number | null
          credits_monthly_allocation?: number | null
          email: string
          email_confirmed_at?: string | null
          full_name?: string | null
          has_active_subscription?: boolean | null
          has_canceled_subscription?: boolean | null
          has_deactivated_subscription?: boolean | null
          has_trial_subscription?: boolean | null
          id?: string
          last_allocation_date?: string | null
          last_sign_in_at?: string | null
          legacy_auth_user_id: string
          legacy_profile_created_at?: string | null
          legacy_profile_id?: string | null
          legacy_profile_updated_at?: string | null
          migrated_at?: string | null
          migration_status?: string | null
          new_user_id?: string | null
          notes?: string | null
          profile_email?: string | null
          profile_first_name?: string | null
          profile_last_name?: string | null
          profile_role?: string | null
          profile_source?: string | null
          profile_username?: string | null
          subscription_auto_renew?: boolean | null
          subscription_created_at?: string | null
          subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_period_start?: string | null
          subscription_plan_type?: string | null
          subscription_status?: string | null
          subscription_updated_at?: string | null
          total_subscriptions?: number | null
          user_created_at?: string | null
          user_updated_at?: string | null
        }
        Update: {
          auth_avatar_url?: string | null
          auth_first_name?: string | null
          auth_last_name?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          credits_available?: number | null
          credits_monthly_allocation?: number | null
          email?: string
          email_confirmed_at?: string | null
          full_name?: string | null
          has_active_subscription?: boolean | null
          has_canceled_subscription?: boolean | null
          has_deactivated_subscription?: boolean | null
          has_trial_subscription?: boolean | null
          id?: string
          last_allocation_date?: string | null
          last_sign_in_at?: string | null
          legacy_auth_user_id?: string
          legacy_profile_created_at?: string | null
          legacy_profile_id?: string | null
          legacy_profile_updated_at?: string | null
          migrated_at?: string | null
          migration_status?: string | null
          new_user_id?: string | null
          notes?: string | null
          profile_email?: string | null
          profile_first_name?: string | null
          profile_last_name?: string | null
          profile_role?: string | null
          profile_source?: string | null
          profile_username?: string | null
          subscription_auto_renew?: boolean | null
          subscription_created_at?: string | null
          subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_period_start?: string | null
          subscription_plan_type?: string | null
          subscription_status?: string | null
          subscription_updated_at?: string | null
          total_subscriptions?: number | null
          user_created_at?: string | null
          user_updated_at?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          credits_per_month: number
          current_period_end: string
          current_period_start: string
          fastspring_subscription_id: string | null
          id: string
          max_concurrent_jobs: number
          plan_type: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          credits_per_month?: number
          current_period_end: string
          current_period_start: string
          fastspring_subscription_id?: string | null
          id?: string
          max_concurrent_jobs?: number
          plan_type: string
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          credits_per_month?: number
          current_period_end?: string
          current_period_start?: string
          fastspring_subscription_id?: string | null
          id?: string
          max_concurrent_jobs?: number
          plan_type?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      video_render_progress: {
        Row: {
          created_at: string | null
          current_operation: string | null
          error_details: Json | null
          estimated_completion_time: string | null
          id: string
          performance_metrics: Json | null
          progress_percentage: number | null
          stage: string
          updated_at: string | null
          user_id: string
          video_id: string
          video_type: string
        }
        Insert: {
          created_at?: string | null
          current_operation?: string | null
          error_details?: Json | null
          estimated_completion_time?: string | null
          id?: string
          performance_metrics?: Json | null
          progress_percentage?: number | null
          stage: string
          updated_at?: string | null
          user_id: string
          video_id: string
          video_type: string
        }
        Update: {
          created_at?: string | null
          current_operation?: string | null
          error_details?: Json | null
          estimated_completion_time?: string | null
          id?: string
          performance_metrics?: Json | null
          progress_percentage?: number | null
          stage?: string
          updated_at?: string | null
          user_id?: string
          video_id?: string
          video_type?: string
        }
        Relationships: []
      }
      voice_collections: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          user_id: string | null
          voice_ids: string[]
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          user_id?: string | null
          voice_ids?: string[]
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          user_id?: string | null
          voice_ids?: string[]
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          processor: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          processor: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processor?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_user_migration_data: {
        Args: { p_email: string }
        Returns: Json
      }
      get_user_content_stats: {
        Args: { user_id_param: string }
        Returns: Json
      }
      get_user_top_tools: {
        Args: {
          user_id_param: string
          days_back?: number
          limit_count?: number
        }
        Returns: {
          tool_id: string
          usage_count: number
          credits_used: number
          last_used: string
          first_used: string
        }[]
      }
      get_user_usage_analytics: {
        Args: { user_id_param: string; days_back?: number }
        Returns: {
          date_bucket: string
          credits_used: number
          unique_tools: number
          content_created: number
        }[]
      }
      get_voice_over_stats: {
        Args: { user_id_param: string }
        Returns: Json
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      restore_user_data_on_registration: {
        Args: { p_auth_user_id: string; p_email: string }
        Returns: Json
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

// Legacy aliases for backwards compatibility
export type InsertTables<T extends keyof Database['public']['Tables'] = keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables'] = keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export const Constants = {
  public: {
    Enums: {},
  },
} as const