'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { storeScriptVideoResults } from '@/actions/database/script-video-database';

// REMOVED: Old built-in editor orchestrator actions (no longer used with standalone editor)
// import {
//   analyzeSegmentAddition,
//   analyzeSegmentRemoval, 
//   executeSegmentAddition,
//   executeSegmentRemoval,
//   regenerateSegmentAsset,
//   getOperationProgress,
//   type UserChoiceDialog,
//   type OperationProgress
// } from '../../../actions/tools/video-editor-actions';

// Temporary types until we clean up the store
type UserChoiceDialog = any;
type OperationProgress = any;

// Import types from our comprehensive schema
interface VideoEditorState {
  // Project metadata and lifecycle
  project: ProjectState;
  
  // Timeline and playback control
  timeline: TimelineState;
  
  // Video content segments
  segments: SegmentData[];
  
  // Generated/source media assets
  assets: AssetsState;
  
  // User editor settings
  settings: EditorSettings;
  
  // UI state and interactions
  ui: UIState;
  
  // Export and rendering
  export: ExportState;
}

// Core state interfaces
interface ProjectState {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  duration: number;
  aspect_ratio: '9:16' | '16:9' | '4:5' | '1:1';
  resolution: { width: number; height: number };
  frame_rate: 24 | 30 | 60;
  status: 'draft' | 'editing' | 'rendering' | 'completed' | 'error';
  version: number;
  original_script: string;
  generation_settings: {
    voice_settings: VoiceSettings;
    video_style: VideoStyle;
    quality: 'draft' | 'standard' | 'premium';
  };
  credits_used: number;
  generation_time_ms: number;
  video_id?: string; // Database ID for fetching captions
  video_url?: string; // Generated video URL
}

interface VoiceSettings {
  voice_id: string;
  speed: 'slower' | 'normal' | 'faster';
  emotion: 'neutral' | 'excited' | 'calm' | 'confident' | 'authoritative';
}

interface VideoStyle {
  tone: 'professional' | 'casual' | 'educational' | 'dramatic' | 'energetic';
  pacing: 'slow' | 'medium' | 'fast';
  visual_style: 'realistic' | 'artistic' | 'minimal' | 'dynamic';
}

interface TimelineState {
  current_time: number;
  is_playing: boolean;
  playback_rate: 0.25 | 0.5 | 1.0 | 1.25 | 1.5 | 2.0;
  loop_mode: boolean;
  zoom_level: number;
  viewport_start: number;
  viewport_end: number;
  visible_tracks: {
    video: boolean;
    audio: boolean;
    captions: boolean;
  };
  track_heights: {
    video: number;
    audio: number;
    captions: number;
  };
  selected_segment_ids: string[];
  selected_track?: 'video' | 'audio' | 'captions';
  hover_segment_id?: string;
  interaction_mode: 'select' | 'trim' | 'split' | 'drag';
  snap_to_segments: boolean;
  snap_to_grid: boolean;
  grid_interval: number;
  is_scrubbing: boolean;
  scrub_preview: boolean;
  clipboard_segments: string[];
  
  // Sync status
  sync_status: 'synced' | 'out_of_sync' | 'regenerating';
  last_audio_generation: string;
  last_segment_change: string;
  segments_needing_voice: string[];
}

interface SegmentData {
  id: string;
  index: number;
  text: string;
  text_hash: string;
  start_time: number;
  end_time: number;
  duration: number;
  original_duration: number;
  assets: {
    voice: {
      url?: string;
      duration?: number;
      audio_offset?: number; // NEW: Where this segment starts in the continuous audio file
      waveform_data?: number[];
      status: 'pending' | 'generating' | 'ready' | 'error';
    };
    image: {
      url?: string;
      prompt: string;
      style_applied?: string;
      status: 'pending' | 'generating' | 'ready' | 'error';
    };
    captions: {
      words: WordTimingData[];
      style_applied: string;
      status: 'pending' | 'generating' | 'ready' | 'error';
      caption_chunks?: any; // Professional caption chunks from generation
    };
  };
  overrides?: {
    typography?: Partial<TypographySettings>;
    colors?: Partial<ColorSettings>;
    animation?: Partial<AnimationSettings>;
    position?: PositionSettings;
    visibility?: boolean;
  };
  edit_history: Array<{
    type: 'text_change' | 'regenerate_image' | 'style_change';
    timestamp: string;
    data: unknown;
  }>;
  status: 'draft' | 'ready' | 'editing' | 'error';
  locked: boolean;
  notes?: string;
}

interface WordTimingData {
  word: string;
  start_time: number;
  end_time: number;
  confidence: number;
}

interface AssetsState {
  background: {
    type: 'solid_color' | 'gradient' | 'video' | 'image';
    value: string;
    opacity: number;
  };
  audio: {
    background_music?: {
      url: string;
      volume: number;
      fade_in: number;
      fade_out: number;
      loop: boolean;
    };
    voice_enhancement: {
      noise_reduction: boolean;
      normalize: boolean;
      compression: number;
    };
  };
  fonts: Array<{
    family: string;
    variants: string[];
    url?: string;
    loaded: boolean;
  }>;
  cache: Record<string, {
    blob?: Blob;
    loaded: boolean;
    size: number;
    last_accessed: string;
  }>;
}

interface EditorSettings {
  typography: TypographySettings;
  colors: ColorSettings;
  animation: AnimationSettings;
  layout: LayoutSettings;
  quality: QualitySettings;
}

interface TypographySettings {
  font_family: string;
  font_size: number;
  font_weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  font_style: 'normal' | 'italic';
  text_align: 'left' | 'center' | 'right' | 'justify';
  line_height: number;
  letter_spacing: number;
  word_spacing: number;
  text_transform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  text_decoration: 'none' | 'underline' | 'overline' | 'line-through';
  text_shadow: {
    enabled: boolean;
    x_offset: number;
    y_offset: number;
    blur_radius: number;
    color: string;
  };
  responsive: {
    mobile_scale: number;
    tablet_scale: number;
  };
}

interface ColorSettings {
  text_color: string;
  background_color: string;
  highlight_color: string;
  stroke: {
    enabled: boolean;
    color: string;
    width: number;
    style: 'solid' | 'dashed' | 'dotted';
  };
  gradient: {
    enabled: boolean;
    type: 'linear' | 'radial';
    colors: string[];
    direction: number;
    center?: { x: number; y: number };
  };
  theme: 'default' | 'dark' | 'bright' | 'minimal' | 'custom';
  custom_palette: string[];
}

interface AnimationSettings {
  entrance: {
    type: 'none' | 'fade' | 'slide_up' | 'slide_down' | 'slide_left' | 'slide_right' | 'zoom' | 'bounce' | 'typewriter';
    duration: number;
    delay: number;
    easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
  exit: {
    type: 'none' | 'fade' | 'slide_up' | 'slide_down' | 'slide_left' | 'slide_right' | 'zoom' | 'bounce';
    duration: number;
    timing: 'with_next' | 'before_next' | 'manual';
    easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
  continuous: {
    type: 'none' | 'pulse' | 'glow' | 'float' | 'shake';
    intensity: number;
    speed: number;
  };
}

interface LayoutSettings {
  position: {
    x: number;
    y: number;
    anchor: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  };
  text_box: {
    width: number;
    max_width?: number;
    padding: { top: number; right: number; bottom: number; left: number };
    margin: { top: number; right: number; bottom: number; left: number };
    background: {
      enabled: boolean;
      color: string;
      opacity: number;
      border_radius: number;
    };
  };
  safe_area: {
    enabled: boolean;
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

interface QualitySettings {
  video_quality: 'draft' | 'good' | 'high' | 'ultra';
  text_rendering: 'fast' | 'quality' | 'subpixel';
  preview_quality: 'low' | 'medium' | 'high';
  cache_enabled: boolean;
  hardware_acceleration: boolean;
}

interface UIState {
  panels: {
    left_panel: {
      width: number;
      collapsed: boolean;
      active_tab: 'settings' | 'segments';
      scroll_position: number;
    };
    right_panel: {
      width: number;
      collapsed: boolean;
      video_size: 'small' | 'medium' | 'large';
    };
    timeline_panel: {
      height: number;
      collapsed: boolean;
      ruler_visible: boolean;
    };
  };
  modals: {
    user_choice: {
      open: boolean;
      data?: UserChoiceDialog;
      onConfirm?: (strategyId: string) => void;
      onCancel?: () => void;
    };
    segment_editor: {
      open: boolean;
      segment_id?: string;
      tab: 'text' | 'image' | 'voice' | 'timing';
    };
    export_dialog: {
      open: boolean;
      format: 'mp4' | 'webm' | 'gif';
      quality: 'draft' | 'standard' | 'premium';
    };
    text_editor: {
      open: boolean;
      segment_id?: string;
    };
  };
  shortcuts_help: boolean;
  project_settings: boolean;
  loading: {
    global: boolean;
    segments: Record<string, boolean>;
    export: boolean;
    preview: boolean;
  };
  progress: {
    export: {
      percentage: number;
      stage: ExportStage;
      eta_seconds?: number;
    };
    regeneration: Record<string, {
      percentage: number;
      type: 'voice' | 'image' | 'text';
    }>;
    operations: Record<string, OperationProgress>;
  };
  feedback: {
    notifications: Notification[];
    toast_messages: ToastMessage[];
    unsaved_changes: boolean;
    last_save: string;
  };
  input: {
    keyboard_shortcuts_enabled: boolean;
    multi_select_mode: boolean;
    precision_mode: boolean;
    active_tool: 'select' | 'trim' | 'split' | 'text' | 'hand';
  };
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    timeline_style: 'compact' | 'detailed' | 'waveform';
    preview_follows_playhead: boolean;
    auto_save_interval: number;
    snap_sensitivity: number;
  };
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration: number;
  dismissible: boolean;
}

interface ExportState {
  current_job?: {
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    stage: ExportStage;
    started_at: string;
    estimated_completion?: string;
    error_message?: string;
  };
  settings: {
    format: 'mp4' | 'webm' | 'mov' | 'gif';
    quality: ExportQuality;
    resolution: {
      width: number;
      height: number;
      maintain_aspect: boolean;
    };
    codec: {
      video: 'h264' | 'h265' | 'vp9' | 'av1';
      audio: 'aac' | 'mp3' | 'opus';
    };
    bitrate: {
      video: number;
      audio: number;
      mode: 'constant' | 'variable';
    };
    frame_rate: number;
    audio_sample_rate: 44100 | 48000;
  };
  history: ExportJob[];
  presets: {
    tiktok: ExportSettings;
    youtube_shorts: ExportSettings;
    instagram_story: ExportSettings;
    twitter: ExportSettings;
    custom: ExportSettings[];
  };
}

interface ExportJob {
  id: string;
  project_id: string;
  settings: ExportSettings;
  status: 'completed' | 'failed';
  file_url?: string;
  file_size?: number;
  duration: number;
  created_at: string;
  credits_used: number;
}

type ExportStage = 
  | 'preparing'
  | 'rendering_segments' 
  | 'compositing'
  | 'encoding_video'
  | 'encoding_audio'
  | 'finalizing'
  | 'uploading'

type ExportQuality = 'draft' | 'good' | 'high' | 'ultra'

interface ExportSettings {
  format: string;
  quality: ExportQuality;
  resolution: { width: number; height: number };
  codec: { video: string; audio: string };
  bitrate: { video: number; audio: number };
  frame_rate: number;
}

interface PositionSettings {
  x: number;
  y: number;
  anchor: string;
}

// Actions interface
interface VideoEditorActions {
  // Project actions
  initializeUser: (user_id: string) => void;
  createProject: (script: string, settings?: Partial<ProjectState>) => Promise<void>;
  updateProject: (updates: Partial<ProjectState>) => void;
  saveProject: () => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;

  // Timeline actions
  play: () => void;
  pause: () => void;
  seek: (time: number, pausePlayback?: boolean) => void;
  setZoom: (level: number) => void;
  selectSegment: (id: string, multi?: boolean) => void;
  moveSegment: (id: string, newStartTime: number) => void;
  
  // Segment actions
  updateSegmentText: (id: string, text: string) => void;
  openTextEditor: (segmentId: string) => void;
  closeTextEditor: () => void;
  regenerateAsset: (id: string, type: 'voice' | 'image', customPrompt?: string) => Promise<void>;
  deleteSegment: (id: string) => Promise<void>;
  splitSegment: (id: string, atTime: number) => void;
  addSegment: (afterId?: string, text?: string) => Promise<void>;
  addEmptySegment: () => string; // Returns the new segment ID
  reorderSegments: (fromIndex: number, toIndex: number) => void;
  
  // User choice dialog actions
  showUserChoiceDialog: (dialog: UserChoiceDialog, onConfirm: (strategyId: string) => void, onCancel?: () => void) => void;
  hideUserChoiceDialog: () => void;
  
  // Progress tracking
  trackOperationProgress: (operationId: string) => Promise<void>;
  
  // Internal orchestrator execution methods
  executeAddSegmentWithStrategy: (afterId?: string, text?: string, strategy?: string) => Promise<void>;
  executeDeleteSegmentWithStrategy: (id: string, strategy?: string) => Promise<void>;
  
  // Timeline sync methods
  markTimelineOutOfSync: (changedSegmentIds: string[]) => void;
  regenerateTimelineSync: () => Promise<void>;
  checkSyncStatus: () => 'synced' | 'out_of_sync' | 'regenerating';

  // Settings actions
  updateTypography: (changes: Partial<TypographySettings>) => void;
  updateColors: (changes: Partial<ColorSettings>) => void;
  updateAnimation: (changes: Partial<AnimationSettings>) => void;
  updateLayout: (changes: Partial<LayoutSettings>) => void;
  applyPreset: (preset: string) => void;

  // UI actions
  setActiveTab: (tab: 'settings' | 'segments') => void;
  togglePanel: (panel: 'left' | 'right' | 'timeline') => void;
  showModal: (modal: string, data?: unknown) => void;
  hideModal: (modal: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;

  // Export actions
  exportVideo: (format?: 'mp4' | 'webm' | 'gif') => Promise<void>;
  cancelExport: () => void;
  getRemotionConfig: () => Record<string, unknown>;

  // AI Orchestration actions
  generateFromScript: (script: string) => Promise<void>;
  loadGenerationResults: (results: any) => void;
  loadExistingResults: (user_id: string) => Promise<void>;
  regenerateSegment: (segmentId: string, type?: 'voice' | 'image' | 'both') => Promise<void>;
  optimizeTimeline: () => Promise<void>;
}

// Helper function to create empty segments (no default mock data)
const createDraftSegments = (): SegmentData[] => [];

// Default state
const getInitialState = (): VideoEditorState => ({
  project: {
    id: `proj_${Date.now()}`,
    name: 'New Video Project',
    description: 'Create your script-to-video project',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: '', // Will be set when user loads
    duration: 0,
    aspect_ratio: '9:16',
    resolution: { width: 1080, height: 1920 },
    frame_rate: 30,
    status: 'draft',
    version: 1,
    original_script: '',
    generation_settings: {
      voice_settings: {
        voice_id: 'anna',
        speed: 'normal',
        emotion: 'confident'
      },
      video_style: {
        tone: 'professional',
        pacing: 'medium',
        visual_style: 'realistic'
      },
      quality: 'standard'
    },
    credits_used: 0,
    generation_time_ms: 0
  },
  
  timeline: {
    current_time: 0,
    is_playing: false,
    playback_rate: 1.0,
    loop_mode: false,
    zoom_level: 1.0,
    viewport_start: 0,
    viewport_end: 30,
    visible_tracks: {
      video: true,
      audio: true,
      captions: true
    },
    track_heights: {
      video: 80,
      audio: 40,
      captions: 30
    },
    selected_segment_ids: [],
    interaction_mode: 'select',
    snap_to_segments: true,
    snap_to_grid: false,
    grid_interval: 1,
    is_scrubbing: false,
    scrub_preview: true,
    clipboard_segments: [],
    
    // Sync status
    sync_status: 'synced',
    last_audio_generation: new Date().toISOString(),
    last_segment_change: new Date().toISOString(),
    segments_needing_voice: []
  },

  segments: createDraftSegments(),

  assets: {
    background: {
      type: 'solid_color',
      value: '#000000',
      opacity: 1
    },
    audio: {
      voice_enhancement: {
        noise_reduction: true,
        normalize: true,
        compression: 0.7
      }
    },
    fonts: [
      {
        family: 'Inter',
        variants: ['regular', 'bold'],
        loaded: true
      }
    ],
    cache: {}
  },

  settings: {
    typography: {
      font_family: 'Inter',
      font_size: 48,
      font_weight: 700,
      font_style: 'normal',
      text_align: 'center',
      line_height: 1.2,
      letter_spacing: 0,
      word_spacing: 0,
      text_transform: 'none',
      text_decoration: 'none',
      text_shadow: {
        enabled: false,
        x_offset: 0,
        y_offset: 0,
        blur_radius: 0,
        color: '#000000'
      },
      responsive: {
        mobile_scale: 1.0,
        tablet_scale: 1.0
      }
    },
    colors: {
      text_color: '#ffffff',
      background_color: 'transparent',
      highlight_color: '#ff0000',
      stroke: {
        enabled: false,
        color: '#000000',
        width: 2,
        style: 'solid'
      },
      gradient: {
        enabled: false,
        type: 'linear',
        colors: ['#ffffff', '#000000'],
        direction: 0
      },
      theme: 'default',
      custom_palette: ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff']
    },
    animation: {
      entrance: {
        type: 'fade',
        duration: 500,
        delay: 0,
        easing: 'ease-out'
      },
      exit: {
        type: 'fade',
        duration: 500,
        timing: 'with_next',
        easing: 'ease-in'
      },
      continuous: {
        type: 'none',
        intensity: 50,
        speed: 1
      }
    },
    layout: {
      position: {
        x: 50,
        y: 50,
        anchor: 'center'
      },
      text_box: {
        width: 80,
        padding: { top: 20, right: 20, bottom: 20, left: 20 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        background: {
          enabled: false,
          color: '#000000',
          opacity: 0.5,
          border_radius: 8
        }
      },
      safe_area: {
        enabled: true,
        top: 10,
        bottom: 10,
        left: 10,
        right: 10
      }
    },
    quality: {
      video_quality: 'high',
      text_rendering: 'quality',
      preview_quality: 'medium',
      cache_enabled: true,
      hardware_acceleration: true
    }
  },

  ui: {
    panels: {
      left_panel: {
        width: 320,
        collapsed: false,
        active_tab: 'segments',
        scroll_position: 0
      },
      right_panel: {
        width: 400,
        collapsed: false,
        video_size: 'medium'
      },
      timeline_panel: {
        height: 200,
        collapsed: false,
        ruler_visible: true
      }
    },
    modals: {
      user_choice: {
        open: false
      },
      segment_editor: {
        open: false,
        tab: 'text'
      },
      export_dialog: {
        open: false,
        format: 'mp4',
        quality: 'standard'
      },
      text_editor: {
        open: false,
        segment_id: undefined
      }
    },
    shortcuts_help: false,
    project_settings: false,
    loading: {
      global: false,
      segments: {},
      export: false,
      preview: false
    },
    progress: {
      export: {
        percentage: 0,
        stage: 'preparing'
      },
      regeneration: {},
      operations: {}
    },
    feedback: {
      notifications: [],
      toast_messages: [],
      unsaved_changes: false,
      last_save: new Date().toISOString()
    },
    input: {
      keyboard_shortcuts_enabled: true,
      multi_select_mode: false,
      precision_mode: false,
      active_tool: 'select'
    },
    preferences: {
      theme: 'auto',
      timeline_style: 'detailed',
      preview_follows_playhead: true,
      auto_save_interval: 5,
      snap_sensitivity: 10
    }
  },

  export: {
    settings: {
      format: 'mp4',
      quality: 'high',
      resolution: {
        width: 1080,
        height: 1920,
        maintain_aspect: true
      },
      codec: {
        video: 'h264',
        audio: 'aac'
      },
      bitrate: {
        video: 8000,
        audio: 192,
        mode: 'constant'
      },
      frame_rate: 30,
      audio_sample_rate: 48000
    },
    history: [],
    presets: {
      tiktok: {
        format: 'mp4',
        quality: 'high',
        resolution: { width: 1080, height: 1920 },
        codec: { video: 'h264', audio: 'aac' },
        bitrate: { video: 8000, audio: 192 },
        frame_rate: 30
      },
      youtube_shorts: {
        format: 'mp4',
        quality: 'ultra',
        resolution: { width: 1080, height: 1920 },
        codec: { video: 'h264', audio: 'aac' },
        bitrate: { video: 12000, audio: 256 },
        frame_rate: 30
      },
      instagram_story: {
        format: 'mp4',
        quality: 'high',
        resolution: { width: 1080, height: 1920 },
        codec: { video: 'h264', audio: 'aac' },
        bitrate: { video: 8000, audio: 192 },
        frame_rate: 30
      },
      twitter: {
        format: 'mp4',
        quality: 'good',
        resolution: { width: 720, height: 1280 },
        codec: { video: 'h264', audio: 'aac' },
        bitrate: { video: 5000, audio: 128 },
        frame_rate: 30
      },
      custom: []
    }
  }
});

// Helper function to create Unicode-safe text hash
function createTextHash(text: string): string {
  try {
    // First try regular btoa for ASCII-only text (most common case)
    return btoa(text);
  } catch (_error) {
    // If btoa fails (Unicode characters), use UTF-8 encoding
    // Convert Unicode string to UTF-8 bytes, then to base64
    const utf8Bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary);
  }
}

// Create the store
export const useVideoEditorStore = create<VideoEditorState & VideoEditorActions>()(
  devtools(
    immer((set, get) => ({
        ...getInitialState(),

        // Project actions
        initializeUser: (user_id: string) => {
          set((state) => {
            state.project.user_id = user_id;
          });
        },

        createProject: async (script: string, settings?: Partial<ProjectState>) => {
          set((state) => {
            state.project = {
              ...getInitialState().project,
              ...settings,
              original_script: script,
              id: `proj_${Date.now()}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              user_id: state.project.user_id // Keep the real user ID
            };
            state.ui.loading.global = true;
          });

          // Mock AI generation - replace with actual API calls
          await get().generateFromScript(script);
        },

        updateProject: (updates: Partial<ProjectState>) => {
          set((state) => {
            Object.assign(state.project, updates);
            state.project.updated_at = new Date().toISOString();
            state.ui.feedback.unsaved_changes = true;
          });
        },

        saveProject: async () => {
          set((state) => {
            state.ui.loading.global = true;
          });

          // Mock save API call
          await new Promise(resolve => setTimeout(resolve, 1000));

          set((state) => {
            state.ui.loading.global = false;
            state.ui.feedback.unsaved_changes = false;
            state.ui.feedback.last_save = new Date().toISOString();
          });

          get().showToast('Project saved successfully', 'success');
        },

        loadProject: async (_projectId: string) => {
          set((state) => {
            state.ui.loading.global = true;
          });

          // Mock load API call
          await new Promise(resolve => setTimeout(resolve, 1500));

          set((state) => {
            state.ui.loading.global = false;
          });
        },

        // Load real generation results into editor
        loadGenerationResults: (results: any) => {
          if (!results || !results.success) {
            console.warn('No valid results to load:', results);
            return;
          }
          
          console.log('🎬 Loading generation results into store:', {
            has_segments: !!results.segments,
            segments_count: results.segments?.length || 0,
            has_images: !!results.generated_images,
            images_count: results.generated_images?.length || 0,
            has_audio: !!results.audio_url,
            video_id: results.video_id,
            prediction_id: results.prediction_id,
            batch_id: results.batch_id,
            available_keys: Object.keys(results)
          });
          
          set((state) => {
            // CRITICAL FIX: Use Whisper frame_alignment data instead of corrupted segments timing
            console.log('🔍 Checking for Whisper frame alignment data...');
            
            let segmentTimingData = results.segments || [];
            let totalDuration = results.timeline_data?.total_duration;
            
            // Check if we have stored Whisper data from database
            if (results.whisper_frame_alignment && results.whisper_frame_alignment.length > 0) {
              console.log('⚠️ Whisper frame_alignment found but contains per-segment timing, not continuous timeline');
              console.log('📊 Whisper segments analyzed individually, need to reconstruct continuous timeline');
              
              // CRITICAL FIX: Whisper analyzed segments individually, need to create continuous timeline
              // Reconstruct continuous timeline by laying segments sequentially
              let currentTime = 0;
              segmentTimingData = results.whisper_frame_alignment.map((frameData: any, index: number) => {
                const segmentDuration = frameData.duration;
                const startTime = currentTime;
                const endTime = currentTime + segmentDuration;
                currentTime = endTime;
                
                return {
                  id: frameData.segment_id,
                  text: frameData.text,
                  start_time: startTime,
                  end_time: endTime,
                  duration: segmentDuration,
                  image_prompt: results.segments?.find((s: any) => s.id === frameData.segment_id)?.image_prompt || '',
                  word_timings: frameData.word_timings?.map((wt: any) => ({
                    ...wt,
                    start: wt.start + startTime, // Offset word timing to continuous timeline
                    end: wt.end + startTime,
                    start_time: wt.start + startTime,
                    end_time: wt.end + startTime
                  })) || []
                };
              });
              
              totalDuration = currentTime; // Use reconstructed timeline duration
              console.log(`✅ Reconstructed continuous timeline: ${totalDuration.toFixed(1)}s across ${segmentTimingData.length} segments`);
            } else {
              console.log('⚠️ No Whisper frame_alignment found, using segments data with timing validation');
              
              // Validate and fix timing corruption in regular segments
              segmentTimingData = results.segments?.map((segment: any, index: number) => {
                const segmentDuration = segment.duration || 5;
                let startTime = segment.start_time;
                let endTime = segment.end_time;
                
                // Fix corrupted timing data
                if (startTime == null || startTime === 'null' || isNaN(startTime) || 
                    endTime == null || endTime === 'null' || isNaN(endTime) ||
                    endTime <= startTime) {
                  console.warn(`🔧 Fixing corrupted timing for segment ${index}`);
                  startTime = index === 0 ? 0 : (results.segments[index - 1]?.end_time || index * 5);
                  endTime = startTime + segmentDuration;
                }
                
                return {
                  ...segment,
                  start_time: startTime,
                  end_time: endTime,
                  duration: endTime - startTime
                };
              }) || [];
              
              if (segmentTimingData.length > 0) {
                totalDuration = Math.max(...segmentTimingData.map((s: any) => s.end_time));
                console.log(`📊 Calculated duration from segments: ${totalDuration}s`);
              }
            }
            
            console.log('🔍 Using timing data:', segmentTimingData.map((s: any, i: number) => ({
              index: i,
              id: s.id,
              start_time: s.start_time,
              end_time: s.end_time,
              duration: s.duration,
              text_preview: s.text?.substring(0, 30)
            })));
            
            const segments: SegmentData[] = segmentTimingData.map((segment: any, index: number) => {
              // Find matching image by segment_index to ensure correct mapping
              const matchingImage = results.generated_images?.find((img: any) => img.segment_index === index);
              const imageUrl = matchingImage?.url || '';
              
              console.log(`Segment ${index}: "${segment.text.substring(0, 30)}..." -> Image: ${imageUrl ? 'Found' : 'Missing'}, Timing: ${segment.start_time}s-${segment.end_time}s`);
              
              return {
                id: segment.id || `seg_${index + 1}`,
                index,
                text: segment.text,
                text_hash: createTextHash(segment.text),
                start_time: segment.start_time,
                end_time: segment.end_time,
                duration: segment.duration,
                original_duration: segment.duration,
                assets: {
                  voice: {
                    url: results.audio_url, // All segments share same continuous audio file
                    duration: totalDuration, // Use actual total audio duration
                    audio_offset: segment.start_time, // Where this segment starts in the audio
                    status: results.audio_url ? 'ready' as const : 'pending' as const
                  },
                  image: {
                    url: imageUrl,
                    prompt: segment.image_prompt || matchingImage?.prompt || `Visual for: ${segment.text.substring(0, 50)}`,
                    status: imageUrl ? 'ready' as const : 'pending' as const
                  },
                  captions: {
                    words: segment.word_timings?.map((wt: any) => ({
                      word: wt.word,
                      start_time: wt.start,
                      end_time: wt.end,
                      confidence: wt.confidence || 0.95
                    })) || [],
                    style_applied: 'default',
                    status: 'ready' as const,
                    // Store caption chunks if available
                    caption_chunks: segment.caption_chunks || null
                  }
                },
                edit_history: [],
                status: 'ready' as const,
                locked: false
              };
            });

            console.log(`✅ Loaded ${segments.length} segments into editor`);

            // Update store state
            state.segments = segments;
            state.project.duration = totalDuration;
            state.project.status = 'editing';
            state.project.video_url = results.video_url;
            // Try multiple sources for video_id
            state.project.video_id = results.video_id || results.prediction_id || results.batch_id;
            console.log('🔍 Setting video_id from:', { 
              video_id: results.video_id, 
              prediction_id: results.prediction_id, 
              batch_id: results.batch_id,
              final_video_id: state.project.video_id 
            });
            state.project.original_script = results.final_script || results.script_text || state.project.original_script;
            state.ui.loading.global = false;
            
            // Update timeline to match duration
            state.timeline.viewport_end = Math.max(30, state.project.duration);
            
            // Clear any existing selections
            state.timeline.selected_segment_ids = [];
            
            // Show notification if script was generated from prompt
            if (results.was_script_generated) {
              state.ui.feedback.notifications.unshift({
                id: `script_gen_${Date.now()}`,
                type: 'info',
                title: 'Script Generated!',
                message: 'AI created a script from your idea. You can view and edit it in the segments tab.',
                timestamp: new Date().toISOString(),
                read: false
              });
            }
          });
        },

        // Load existing results from database
        loadExistingResults: async (user_id: string) => {
          if (!user_id) {
            console.warn('No user_id provided to loadExistingResults');
            return;
          }

          set((state) => {
            state.ui.loading.global = true;
          });

          try {
            console.log('Loading existing results for user:', user_id);
            
            // Call server action to get latest results
            const response = await fetch('/api/script-video/latest', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({ user_id })
            });
            
            console.log('API response status:', response.status, response.statusText);
            
            if (response.ok) {
              const contentType = response.headers.get('content-type');
              console.log('Response content-type:', contentType);
              
              if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                console.log('API response data:', data);
                
                if (data.success && data.result) {
                  get().loadGenerationResults(data.result);
                } else {
                  console.log('No existing script-to-video results found for user');
                }
              } else {
                console.error('API returned non-JSON response');
                const text = await response.text();
                console.error('Response text:', text);
              }
            } else {
              console.error('Failed to fetch latest results:', response.status, response.statusText);
            }
          } catch (error) {
            console.error('Error loading existing results:', error);
          }

          set((state) => {
            state.ui.loading.global = false;
          });
        },

        // Timeline actions
        play: () => {
          set((state) => {
            state.timeline.is_playing = true;
          });
          // Removed animation loop - audio element drives timeline updates via timeupdate events
          // This prevents conflicts between multiple timeline update sources
        },

        pause: () => {
          set((state) => {
            state.timeline.is_playing = false;
          });
        },

        seek: (time: number, pausePlayback: boolean = true) => {
          set((state) => {
            state.timeline.current_time = Math.max(0, Math.min(time, state.project.duration));
            // Only pause when seeking manually, not when audio is updating timeline
            if (pausePlayback) {
              state.timeline.is_playing = false;
            }
          });
        },

        setZoom: (level: number) => {
          set((state) => {
            state.timeline.zoom_level = Math.max(0.5, Math.min(3, level));
          });
        },

        selectSegment: (id: string, multi = false) => {
          set((state) => {
            if (multi) {
              const index = state.timeline.selected_segment_ids.indexOf(id);
              if (index >= 0) {
                state.timeline.selected_segment_ids.splice(index, 1);
              } else {
                state.timeline.selected_segment_ids.push(id);
              }
            } else {
              // Only select if not already selected, or if we're switching to a different segment
              const currentSelection = state.timeline.selected_segment_ids;
              const isAlreadySelected = currentSelection.length === 1 && currentSelection[0] === id;
              
              if (!isAlreadySelected) {
                state.timeline.selected_segment_ids = [id];
              }
              
              // DON'T auto-seek when selecting a segment from the timeline view
              // This was causing the timeline to jump to segment start (0) when clicking on timeline
              // Only seek if explicitly needed for other operations
            }
          });
        },

        moveSegment: (id: string, newStartTime: number) => {
          set((state) => {
            const segment = state.segments.find(s => s.id === id);
            if (segment) {
              const duration = segment.duration;
              segment.start_time = newStartTime;
              segment.end_time = newStartTime + duration;
              state.ui.feedback.unsaved_changes = true;
            }
          });
        },

        // Segment actions
        updateSegmentText: (id: string, text: string) => {
          set((state) => {
            const segment = state.segments.find(s => s.id === id);
            if (segment) {
              const oldText = segment.text;
              segment.text = text;
              segment.text_hash = createTextHash(text);
              segment.edit_history.push({
                type: 'text_change',
                timestamp: new Date().toISOString(),
                data: { old_text: oldText, new_text: text }
              });
              state.ui.feedback.unsaved_changes = true;
              
              // Mark segment as needing voice regeneration
              if (!state.timeline.segments_needing_voice.includes(id)) {
                state.timeline.segments_needing_voice.push(id);
              }
            }
          });
          
          // Mark timeline as out of sync since text changed
          get().markTimelineOutOfSync([id]);
          
          // Show resync prompt
          get().showToast('Text updated. Click "Resync Timeline" to regenerate voice and realign timing.', 'warning');
        },

        openTextEditor: (segmentId: string) => {
          set((state) => {
            state.ui.modals.text_editor.open = true;
            state.ui.modals.text_editor.segment_id = segmentId;
          });
        },

        closeTextEditor: () => {
          set((state) => {
            state.ui.modals.text_editor.open = false;
            state.ui.modals.text_editor.segment_id = undefined;
          });
        },

        regenerateAsset: async (id: string, type: 'voice' | 'image', customPrompt?: string) => {
          try {
            const currentComposition = get().getRemotionConfig();
            
            // Start regeneration operation
            const operation = await regenerateSegmentAsset(
              get().project.id,
              get().project.user_id,
              currentComposition,
              id,
              type,
              customPrompt
            );
            
            // Track progress
            set((state) => {
              state.ui.loading.segments[id] = true;
              state.ui.progress.operations[operation.operationId] = operation;
              state.ui.progress.regeneration[id] = {
                percentage: 0,
                type
              };
            });
            
            get().trackOperationProgress(operation.operationId);
            get().showToast(`Regenerating ${type}...`, 'info');
            
          } catch (error) {
            console.error('Regenerate asset error:', error);
            get().showToast(`Failed to regenerate ${type}`, 'error');
            set((state) => {
              delete state.ui.loading.segments[id];
            });
          }
        },

        deleteSegment: async (id: string) => {
          try {
            // Step 1: AI Impact Analysis
            const impactAnalysis = await analyzeSegmentRemoval(
              get().segments as unknown as Array<Record<string, unknown>>,
              id
            );
            
            // Step 2: User Choice Dialog (if needed)
            if (impactAnalysis.requiresUserChoice) {
              const segment = get().segments.find(s => s.id === id);
              const dialog: UserChoiceDialog = {
                title: 'Delete Segment',
                description: `Deleting "${segment?.text.substring(0, 50)}..." will affect ${impactAnalysis.affectedSegmentIds.length} segments.`,
                operation: 'remove_segment',
                strategies: impactAnalysis.strategies,
                defaultStrategy: impactAnalysis.recommendedStrategy,
                showCostBreakdown: true
              };
              
              return new Promise((resolve) => {
                get().showUserChoiceDialog(dialog, async (strategyId: string) => {
                  await get().executeDeleteSegmentWithStrategy(id, strategyId);
                  resolve();
                }, () => {
                  get().showToast('Segment deletion cancelled', 'info');
                  resolve();
                });
              });
            } else {
              // Execute directly with recommended strategy
              await get().executeDeleteSegmentWithStrategy(id, impactAnalysis.recommendedStrategy);
            }
          } catch (error) {
            console.error('Delete segment error:', error);
            get().showToast('Failed to delete segment', 'error');
          }
        },
        
        executeDeleteSegmentWithStrategy: async (id: string, strategy = 'simple_remove') => {
          try {
            // Call the orchestrator for analysis and processing
            const currentComposition = get().getRemotionConfig();
            const operation = await executeSegmentRemoval(
              get().project.id,
              get().project.user_id,
              currentComposition,
              id,
              strategy
            );
            
            // Track progress
            set((state) => {
              state.ui.progress.operations[operation.operationId] = operation;
            });
            
            // Immediately remove the segment from the UI (optimistic update)
            set((state) => {
              const segmentIndex = state.segments.findIndex(s => s.id === id);
              if (segmentIndex >= 0) {
                state.segments.splice(segmentIndex, 1);
                
                // Reindex remaining segments and adjust timeline
                state.segments.forEach((segment, index) => {
                  segment.index = index;
                });
                
                // Recalculate total duration
                state.project.duration = state.segments.length > 0 
                  ? Math.max(...state.segments.map(s => s.end_time))
                  : 0;
                
                // Remove from selection
                const selectedIndex = state.timeline.selected_segment_ids.indexOf(id);
                if (selectedIndex >= 0) {
                  state.timeline.selected_segment_ids.splice(selectedIndex, 1);
                }
                
                state.ui.feedback.unsaved_changes = true;
              }
            });
            
            get().trackOperationProgress(operation.operationId);
            get().showToast('Deleting segment...', 'info');
            
          } catch (error) {
            console.error('Execute delete segment error:', error);
            get().showToast('Failed to execute segment deletion', 'error');
          }
        },

        splitSegment: (id: string, atTime: number) => {
          set((state) => {
            const segmentIndex = state.segments.findIndex(s => s.id === id);
            const segment = state.segments[segmentIndex];
            
            if (segment && atTime > segment.start_time && atTime < segment.end_time) {
              // Create new segment for the second part
              const newSegment: SegmentData = {
                ...segment,
                id: `seg_${Date.now()}`,
                index: segment.index + 1,
                start_time: atTime,
                duration: segment.end_time - atTime,
                text: segment.text.substring(Math.floor(segment.text.length / 2)),
                text_hash: createTextHash(segment.text.substring(Math.floor(segment.text.length / 2))),
                edit_history: []
              };
              
              // Update original segment
              segment.end_time = atTime;
              segment.duration = atTime - segment.start_time;
              segment.text = segment.text.substring(0, Math.floor(segment.text.length / 2));
              segment.text_hash = createTextHash(segment.text);
              
              // Insert new segment
              state.segments.splice(segmentIndex + 1, 0, newSegment);
              
              // Reindex all segments after the split
              for (let i = segmentIndex + 1; i < state.segments.length; i++) {
                state.segments[i].index = i;
              }
              
              state.ui.feedback.unsaved_changes = true;
            }
          });

          get().showToast('Segment split successfully', 'success');
        },

        addSegment: async (afterId?: string, text?: string) => {
          const newText = text || 'New segment text...';
          
          try {
            // Step 1: AI Impact Analysis
            const impactAnalysis = await analyzeSegmentAddition(
              get().segments,
              afterId,
              newText
            );
            
            // Step 2: User Choice Dialog (if needed)
            if (impactAnalysis.requiresUserChoice) {
              const dialog: UserChoiceDialog = {
                title: 'Add New Segment',
                description: `Adding "${newText.substring(0, 50)}..." will affect ${impactAnalysis.affectedSegmentIds.length} segments.`,
                operation: 'add_segment',
                strategies: impactAnalysis.strategies,
                defaultStrategy: impactAnalysis.recommendedStrategy,
                showCostBreakdown: true
              };
              
              return new Promise((resolve) => {
                get().showUserChoiceDialog(dialog, async (strategyId: string) => {
                  await get().executeAddSegmentWithStrategy(afterId, newText, strategyId);
                  resolve();
                }, () => {
                  get().showToast('Segment addition cancelled', 'info');
                  resolve();
                });
              });
            } else {
              // Execute directly with recommended strategy
              await get().executeAddSegmentWithStrategy(afterId, newText, impactAnalysis.recommendedStrategy);
            }
          } catch (error) {
            console.error('Add segment error:', error);
            get().showToast('Failed to add segment', 'error');
          }
        },
        
        addEmptySegment: () => {
          const newSegmentId = `seg_${Date.now()}`;
          const duration = 3; // Default duration
          
          const newSegment: SegmentData = {
            id: newSegmentId,
            index: 0, // Always add at first position
            text: 'Enter segment text...',
            text_hash: createTextHash('Enter segment text...'),
            start_time: 0, // Will be recalculated
            end_time: duration,
            duration,
            original_duration: duration,
            assets: {
              voice: {
                status: 'pending'
              },
              image: {
                url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400', // Placeholder
                prompt: 'Empty segment placeholder',
                status: 'pending'
              },
              captions: {
                words: [],
                style_applied: '',
                status: 'pending'
              }
            },
            edit_history: [],
            status: 'draft',
            locked: false
          };
          
          set((state) => {
            // Add at the beginning
            state.segments.unshift(newSegment);
            
            // Reindex all segments and recalculate timeline
            let currentTime = 0;
            state.segments.forEach((segment, index) => {
              segment.index = index;
              segment.start_time = currentTime;
              segment.end_time = currentTime + segment.duration;
              currentTime = segment.end_time;
            });
            
            // Update project duration
            state.project.duration = currentTime;
            state.ui.feedback.unsaved_changes = true;
            
            // Auto-select the new segment
            state.timeline.selected_segment_ids = [newSegmentId];
            state.timeline.current_time = 0; // Jump to beginning
          });
          
          // Mark timeline as out of sync since we added a segment without voice
          get().markTimelineOutOfSync([newSegmentId]);
          
          get().showToast('Empty segment added at beginning', 'success');
          return newSegmentId;
        },
        
        reorderSegments: (fromIndex: number, toIndex: number) => {
          // Get the segment ID before the state update
          const movedSegmentId = get().segments[fromIndex]?.id;
          
          set((state) => {
            // Move the segment from fromIndex to toIndex
            const [movedSegment] = state.segments.splice(fromIndex, 1);
            state.segments.splice(toIndex, 0, movedSegment);
            
            // Reindex all segments and recalculate timeline positions
            let currentTime = 0;
            state.segments.forEach((segment, index) => {
              segment.index = index;
              segment.start_time = currentTime;
              segment.end_time = currentTime + segment.duration;
              currentTime = segment.end_time;
            });
            
            // Update project duration
            state.project.duration = currentTime;
            state.ui.feedback.unsaved_changes = true;
            
            // Update playhead to follow the moved segment if it was selected
            if (state.timeline.selected_segment_ids.includes(movedSegment.id)) {
              state.timeline.current_time = movedSegment.start_time;
            }
          });
          
          // Mark timeline as out of sync since segment order changed
          if (movedSegmentId) {
            get().markTimelineOutOfSync([movedSegmentId]);
          }
          
          get().showToast('Segments reordered', 'success');
        },
        
        executeAddSegmentWithStrategy: async (afterId?: string, text = 'New segment text...', strategy = 'isolated') => {
          try {
            // Call the orchestrator for analysis and processing
            const currentComposition = get().getRemotionConfig();
            const operation = await executeSegmentAddition(
              get().project.id,
              get().project.user_id,
              currentComposition,
              afterId,
              text,
              strategy
            );
            
            // Track progress
            set((state) => {
              state.ui.progress.operations[operation.operationId] = operation;
            });
            
            // Immediately add the segment to the UI (optimistic update)
            const insertIndex = afterId 
              ? get().segments.findIndex(s => s.id === afterId) + 1 
              : get().segments.length;
            
            const prevSegment = get().segments[insertIndex - 1];
            const startTime = prevSegment ? prevSegment.end_time : 0;
            const duration = 3; // Default duration
            
            const newSegment: SegmentData = {
              id: `seg_${Date.now()}`,
              index: insertIndex,
              text,
              text_hash: createTextHash(text),
              start_time: startTime,
              end_time: startTime + duration,
              duration,
              original_duration: duration,
              assets: {
                voice: {
                  status: 'generating' // Will be updated by progress tracking
                },
                image: {
                  prompt: `Visual representation of: ${text.substring(0, 50)}`,
                  status: 'generating'
                },
                captions: {
                  words: [],
                  style_applied: '',
                  status: 'generating'
                }
              },
              edit_history: [{
                type: 'text_change',
                timestamp: new Date().toISOString(),
                data: { text, strategy }
              }],
              status: 'editing',
              locked: false
            };
            
            set((state) => {
              state.segments.splice(insertIndex, 0, newSegment);
              
              // Reindex segments
              state.segments.forEach((segment, index) => {
                segment.index = index;
              });
              
              // Update project duration
              state.project.duration = Math.max(...state.segments.map(s => s.end_time));
              state.ui.feedback.unsaved_changes = true;
            });
            
            get().trackOperationProgress(operation.operationId);
            get().showToast('Adding segment...', 'info');
            
          } catch (error) {
            console.error('Execute add segment error:', error);
            get().showToast('Failed to execute segment addition', 'error');
          }
        },

        // Settings actions
        updateTypography: (changes: Partial<TypographySettings>) => {
          set((state) => {
            Object.assign(state.settings.typography, changes);
            state.ui.feedback.unsaved_changes = true;
          });
        },

        updateColors: (changes: Partial<ColorSettings>) => {
          set((state) => {
            Object.assign(state.settings.colors, changes);
            state.ui.feedback.unsaved_changes = true;
          });
        },

        updateAnimation: (changes: Partial<AnimationSettings>) => {
          set((state) => {
            Object.assign(state.settings.animation, changes);
            state.ui.feedback.unsaved_changes = true;
          });
        },

        updateLayout: (changes: Partial<LayoutSettings>) => {
          set((state) => {
            Object.assign(state.settings.layout, changes);
            state.ui.feedback.unsaved_changes = true;
          });
        },

        applyPreset: (preset: string) => {
          // Apply predefined style presets with proper type safety
          const currentSettings = get().settings;
          
          const presets: Record<string, Partial<EditorSettings>> = {
            'professional': {
              typography: { 
                ...currentSettings.typography, 
                font_family: 'Inter', 
                font_weight: 600, 
                text_align: 'center' 
              },
              colors: { 
                ...currentSettings.colors, 
                text_color: '#ffffff', 
                background_color: 'transparent' 
              }
            },
            'energetic': {
              typography: { 
                ...currentSettings.typography, 
                font_family: 'Inter', 
                font_weight: 800, 
                text_transform: 'uppercase' 
              },
              colors: { 
                ...currentSettings.colors, 
                text_color: '#ffff00', 
                highlight_color: '#ff0000' 
              },
              animation: { 
                ...currentSettings.animation,
                entrance: { 
                  ...currentSettings.animation.entrance,
                  type: 'zoom', 
                  duration: 300,
                  delay: 0,
                  easing: 'ease-out'
                } 
              }
            },
            'minimal': {
              typography: { 
                ...currentSettings.typography, 
                font_family: 'Inter', 
                font_weight: 400, 
                text_align: 'left' 
              },
              colors: { 
                ...currentSettings.colors, 
                text_color: '#333333', 
                background_color: '#ffffff' 
              }
            }
          };

          const presetConfig = presets[preset];
          if (presetConfig) {
            set((state) => {
              if (presetConfig.typography) Object.assign(state.settings.typography, presetConfig.typography);
              if (presetConfig.colors) Object.assign(state.settings.colors, presetConfig.colors);
              if (presetConfig.animation) Object.assign(state.settings.animation, presetConfig.animation);
              if (presetConfig.layout) Object.assign(state.settings.layout, presetConfig.layout);
              state.ui.feedback.unsaved_changes = true;
            });

            get().showToast(`Applied ${preset} preset`, 'success');
          }
        },

        // UI actions
        setActiveTab: (tab: 'settings' | 'segments') => {
          set((state) => {
            state.ui.panels.left_panel.active_tab = tab;
          });
        },

        togglePanel: (panel: 'left' | 'right' | 'timeline') => {
          set((state) => {
            if (panel === 'left') {
              state.ui.panels.left_panel.collapsed = !state.ui.panels.left_panel.collapsed;
            } else if (panel === 'right') {
              state.ui.panels.right_panel.collapsed = !state.ui.panels.right_panel.collapsed;
            } else if (panel === 'timeline') {
              state.ui.panels.timeline_panel.collapsed = !state.ui.panels.timeline_panel.collapsed;
            }
          });
        },

        showModal: (modal: string, data?: unknown) => {
          set((state) => {
            if (modal === 'segment_editor' && data && typeof data === 'object' && 'segment_id' in data) {
              const segmentData = data as { segment_id: string; tab?: string };
              state.ui.modals.segment_editor = {
                open: true,
                segment_id: segmentData.segment_id,
                tab: (segmentData.tab as 'voice' | 'image' | 'text' | 'timing') || 'text'
              };
            } else if (modal === 'export_dialog') {
              state.ui.modals.export_dialog.open = true;
            }
          });
        },

        hideModal: (modal: string) => {
          set((state) => {
            if (modal === 'segment_editor') {
              state.ui.modals.segment_editor.open = false;
            } else if (modal === 'export_dialog') {
              state.ui.modals.export_dialog.open = false;
            }
          });
        },

        addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => {
          set((state) => {
            state.ui.feedback.notifications.unshift({
              ...notification,
              id: `notif_${Date.now()}`,
              timestamp: new Date().toISOString(),
              read: false
            });
          });
        },

        showToast: (message: string, type = 'info' as const) => {
          const toast: ToastMessage = {
            id: `toast_${Date.now()}`,
            type,
            message,
            duration: type === 'error' ? 0 : 3000,
            dismissible: true
          };

          set((state) => {
            state.ui.feedback.toast_messages.push(toast);
          });

          // Auto-remove toast after duration
          if (toast.duration > 0) {
            setTimeout(() => {
              set((state) => {
                const index = state.ui.feedback.toast_messages.findIndex(t => t.id === toast.id);
                if (index >= 0) {
                  state.ui.feedback.toast_messages.splice(index, 1);
                }
              });
            }, toast.duration);
          }
        },
        
        // User choice dialog methods
        showUserChoiceDialog: (dialog: UserChoiceDialog, onConfirm: (strategyId: string) => void, onCancel?: () => void) => {
          set((state) => {
            state.ui.modals.user_choice = {
              open: true,
              data: dialog,
              onConfirm,
              onCancel
            };
          });
        },
        
        hideUserChoiceDialog: () => {
          set((state) => {
            state.ui.modals.user_choice = {
              open: false
            };
          });
        },
        
        // Progress tracking
        trackOperationProgress: async (operationId: string) => {
          const pollProgress = async () => {
            try {
              const progress = await getOperationProgress(operationId);
              if (!progress) return;
              
              set((state) => {
                state.ui.progress.operations[operationId] = progress;
                
                // Update segment loading state if it's a regeneration
                if (progress.type === 'regenerate_asset') {
                  const segmentId = operationId.includes('regen_image_') ? operationId.replace('regen_image_', '') : operationId.replace('regen_voice_', '');
                  if (state.ui.progress.regeneration[segmentId]) {
                    state.ui.progress.regeneration[segmentId].percentage = progress.progress;
                  }
                }
              });
              
              // Handle completion
              if (progress.status === 'completed') {
                get().showToast(`${progress.type.replace('_', ' ')} completed successfully!`, 'success');
                
                // Update segment assets based on operation type
                if (progress.type === 'add_segment') {
                  // Find the segment that was just added and update its assets
                  set((state) => {
                    const newestSegment = state.segments[state.segments.length - 1];
                    if (newestSegment && newestSegment.status === 'editing') {
                      newestSegment.assets.voice.status = 'ready';
                      newestSegment.assets.voice.url = `https://example.com/voice/${newestSegment.id}.mp3`;
                      newestSegment.assets.image.status = 'ready';
                      newestSegment.assets.image.url = `https://images.unsplash.com/photo-${Date.now()}?w=400`;
                      newestSegment.assets.captions.status = 'ready';
                      newestSegment.status = 'ready';
                    }
                  });
                } else if (progress.type === 'regenerate_asset') {
                  // Update the regenerated asset
                  const segmentId = operationId.includes('regen_image_') ? operationId.replace('regen_image_', '') : operationId.replace('regen_voice_', '');
                  const assetType = operationId.includes('regen_image_') ? 'image' : 'voice';
                  
                  set((state) => {
                    const segment = state.segments.find(s => s.id === segmentId);
                    if (segment) {
                      if (assetType === 'image') {
                        segment.assets.image.status = 'ready';
                        segment.assets.image.url = `https://images.unsplash.com/photo-${Date.now()}?w=400`;
                      } else {
                        segment.assets.voice.status = 'ready';
                        segment.assets.voice.url = `https://example.com/voice/${segmentId}.mp3`;
                      }
                    }
                    delete state.ui.loading.segments[segmentId];
                    delete state.ui.progress.regeneration[segmentId];
                  });
                }
                
                return; // Stop polling
              }
              
              // Handle failure
              if (progress.status === 'failed') {
                get().showToast(`${progress.type.replace('_', ' ')} failed: ${progress.error}`, 'error');
                
                // Clean up loading states
                set((state) => {
                  if (progress.type === 'regenerate_asset') {
                    const segmentId = operationId.includes('regen_image_') ? operationId.replace('regen_image_', '') : operationId.replace('regen_voice_', '');
                    delete state.ui.loading.segments[segmentId];
                    delete state.ui.progress.regeneration[segmentId];
                  }
                });
                
                return; // Stop polling
              }
              
              // Continue polling if still processing
              if (progress.status === 'processing' || progress.status === 'queued') {
                setTimeout(pollProgress, 2000); // Poll every 2 seconds
              }
              
            } catch (error) {
              console.error('Error tracking progress:', error);
              get().showToast('Error tracking operation progress', 'error');
            }
          };
          
          // Start polling
          pollProgress();
        },
        
        // Timeline sync methods
        markTimelineOutOfSync: (changedSegmentIds: string[]) => {
          set((state) => {
            state.timeline.sync_status = 'out_of_sync';
            state.timeline.last_segment_change = new Date().toISOString();
            state.timeline.segments_needing_voice = [...new Set([...state.timeline.segments_needing_voice, ...changedSegmentIds])];
          });
        },
        
        regenerateTimelineSync: async () => {
          set((state) => {
            state.timeline.sync_status = 'regenerating';
          });
          
          try {
            get().showToast('Regenerating voice and realigning timeline...', 'info');
            
            // Import the resync service
            const { resyncSegmentsAfterEdit } = await import('@/actions/services/segment-resync-service');
            
            // Get current state
            const state = get();
            const segments = state.segments;
            const videoId = state.project.video_id;
            const userId = state.project.user_id;
            
            if (!videoId) {
              throw new Error('No video ID found');
            }
            
            // Prepare segments with resync flags
            const segmentsForResync = segments.map(seg => ({
              id: seg.id,
              text: seg.text,
              start_time: seg.start_time,
              end_time: seg.end_time,
              duration: seg.duration,
              image_prompt: seg.assets.image.prompt || '',
              needs_voice_regen: state.timeline.segments_needing_voice.includes(seg.id)
            }));
            
            // Execute resync
            const result = await resyncSegmentsAfterEdit({
              video_id: videoId,
              segments: segmentsForResync,
              voice_settings: state.settings.voice,
              user_id: userId
            });
            
            if (result.success) {
              // Update segments with new timing
              set((state) => {
                // Update segments with realigned timing
                result.segments.forEach((resyncedSeg: any) => {
                  const storeSegment = state.segments.find(s => s.id === resyncedSeg.id);
                  if (storeSegment) {
                    storeSegment.start_time = resyncedSeg.start_time;
                    storeSegment.end_time = resyncedSeg.end_time;
                    storeSegment.duration = resyncedSeg.duration;
                    
                    // Update voice asset
                    if (result.audio_url) {
                      storeSegment.assets.voice = {
                        url: result.audio_url,
                        status: 'ready'
                      };
                    }
                    
                    // Update word timings if available
                    if (resyncedSeg.word_timings) {
                      storeSegment.assets.captions.words = resyncedSeg.word_timings;
                    }
                  }
                });
                
                // Clear sync flags
                state.timeline.segments_needing_voice = [];
                state.timeline.sync_status = 'synced';
                state.timeline.last_segment_change = null;
                
                // Update project duration
                state.project.duration = Math.max(...state.segments.map(s => s.end_time));
              });
              
              get().showToast('Timeline synchronized successfully!', 'success');
            } else {
              throw new Error(result.error || 'Resync failed');
            }
          
            set((state) => {
              state.timeline.sync_status = 'synced';
              state.timeline.last_audio_generation = new Date().toISOString();
              state.timeline.segments_needing_voice = [];
              
              // Update all segments to have voice
              state.segments.forEach(segment => {
                if (segment.assets.voice.status === 'pending') {
                  segment.assets.voice.status = 'ready';
                  segment.assets.voice.url = `https://example.com/voice/${segment.id}.mp3`;
                  segment.assets.voice.duration = segment.duration;
                }
                if (segment.assets.captions.status === 'pending') {
                  segment.assets.captions.status = 'ready';
                  segment.assets.captions.words = segment.text.split(' ').map((word, i) => ({
                    word,
                    start_time: segment.start_time + (i / segment.text.split(' ').length) * segment.duration,
                    end_time: segment.start_time + ((i + 1) / segment.text.split(' ').length) * segment.duration,
                    confidence: 0.95
                  }));
                }
              });
            });
            
            get().showToast('Timeline synchronized successfully!', 'success');
            
          } catch (_error) {
            set((state) => {
              state.timeline.sync_status = 'out_of_sync';
            });
            get().showToast('Failed to regenerate timeline sync', 'error');
          }
        },
        
        checkSyncStatus: () => {
          const state = get();
          return state.timeline.sync_status;
        },

        // Export actions
        exportVideo: async (format = 'mp4' as const) => {
          const jobId = `export_${Date.now()}`;

          set((state) => {
            state.export.current_job = {
              id: jobId,
              status: 'queued',
              progress: 0,
              stage: 'preparing',
              started_at: new Date().toISOString()
            };
            state.ui.loading.export = true;
            state.ui.progress.export = {
              percentage: 0,
              stage: 'preparing'
            };
          });

          // Mock export process with realistic stages
          const stages: ExportStage[] = ['preparing', 'rendering_segments', 'compositing', 'encoding_video', 'encoding_audio', 'finalizing'];
          
          for (const stage of stages) {
            set((state) => {
              if (state.export.current_job) {
                state.export.current_job.stage = stage;
                state.ui.progress.export.stage = stage;
              }
            });

            // Progress through each stage
            const stageProgress = 100 / stages.length;
            const currentStageIndex = stages.indexOf(stage);
            
            for (let i = 0; i <= 10; i++) {
              await new Promise(resolve => setTimeout(resolve, 300));
              set((state) => {
                const progress = (currentStageIndex * stageProgress) + ((i / 10) * stageProgress);
                if (state.export.current_job) {
                  state.export.current_job.progress = progress;
                }
                state.ui.progress.export.percentage = progress;
              });
            }
          }

          // Complete export and save to database
          const state = get();
          const videoUrl = `https://example.com/exports/${jobId}.${format}`;
          
          // Prepare complete editor state for re-editing capability
          const editorState = {
            project: state.project,
            segments: state.segments,
            timeline: state.timeline,
            settings: state.settings,
            assets: state.assets,
            export_settings: state.export.settings
          };

          // Save to database with full editor state
          try {
            await storeScriptVideoResults({
              user_id: state.project.user_id || 'current-user', // Get actual user ID
              script_text: state.project.original_script,
              video_url: videoUrl,
              audio_url: state.assets.audio_url,
              generated_images: state.segments.map(s => s.media?.image_url).filter(Boolean),
              segments: state.segments as any,
              batch_id: jobId,
              model_version: '1.0.0',
              generation_parameters: {
                format,
                resolution: state.project.resolution,
                frame_rate: state.project.frame_rate,
                aspect_ratio: state.project.aspect_ratio
              },
              credits_used: Math.ceil(state.project.duration / 10),
              
              // Store complete editor state for re-editing
              editor_data: editorState,
              remotion_composition: state.getRemotionConfig(),
              
              // Store metadata for history display
              storyboard_data: {
                narrative_analysis: state.project.generation_settings,
                characters: [],
                scene_orchestration: state.segments.map(s => ({
                  id: s.id,
                  text: s.text,
                  duration: s.duration,
                  media: s.media
                })),
                original_context: {
                  script: state.project.original_script,
                  created_at: state.project.created_at
                }
              }
            });

            get().showToast('Video exported and saved to history!', 'success');
          } catch (error) {
            console.error('Failed to save to database:', error);
            get().showToast('Video exported but failed to save to history', 'warning');
          }

          set((state) => {
            if (state.export.current_job) {
              state.export.current_job.status = 'completed';
              state.export.current_job.progress = 100;
            }
            state.ui.loading.export = false;

            // Add to local history
            state.export.history.unshift({
              id: jobId,
              project_id: state.project.id,
              settings: state.export.settings,
              status: 'completed',
              file_url: videoUrl,
              file_size: 15728640, // ~15MB
              duration: state.project.duration,
              created_at: new Date().toISOString(),
              credits_used: Math.ceil(state.project.duration / 10)
            });
          });
        },

        cancelExport: () => {
          set((state) => {
            if (state.export.current_job) {
              state.export.current_job.status = 'failed';
            }
            state.ui.loading.export = false;
            state.ui.progress.export.percentage = 0;
          });

          get().showToast('Export cancelled', 'info');
        },

        getRemotionConfig: () => {
          const state = get();
          
          // Generate Remotion-compatible configuration
          return {
            composition: {
              id: state.project.id,
              width: state.project.resolution.width,
              height: state.project.resolution.height,
              fps: state.project.frame_rate,
              durationInFrames: Math.ceil(state.project.duration * state.project.frame_rate)
            },
            segments: state.segments.map(segment => ({
              id: segment.id,
              startFrame: Math.floor(segment.start_time * state.project.frame_rate),
              endFrame: Math.floor(segment.end_time * state.project.frame_rate),
              text: segment.text,
              imageUrl: segment.assets.image.url,
              voiceUrl: segment.assets.voice.url,
              style: {
                typography: state.settings.typography,
                colors: state.settings.colors,
                animation: state.settings.animation,
                layout: state.settings.layout,
                overrides: segment.overrides
              }
            })),
            globalSettings: {
              typography: state.settings.typography,
              colors: state.settings.colors,
              animation: state.settings.animation,
              layout: state.settings.layout,
              quality: state.settings.quality
            },
            audio: {
              backgroundMusic: state.assets.audio.background_music,
              voiceEnhancement: state.assets.audio.voice_enhancement
            },
            background: state.assets.background
          };
        },

        // AI Orchestration actions
        generateFromScript: async (script: string) => {
          set((state) => {
            state.ui.loading.global = true;
            state.project.original_script = script;
            state.project.status = 'editing';
          });

          // Mock AI script analysis and segmentation
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Generate mock segments from script
          const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
          const mockSegments: SegmentData[] = sentences.map((sentence, index) => {
            const startTime = index * 3.5;
            const duration = 3 + Math.random() * 2; // 3-5 seconds
            
            return {
              id: `seg_${Date.now()}_${index}`,
              index,
              text: sentence.trim(),
              text_hash: createTextHash(sentence.trim()),
              start_time: startTime,
              end_time: startTime + duration,
              duration,
              original_duration: duration,
              assets: {
                voice: {
                  url: `https://example.com/voice/seg_${index}.mp3`,
                  duration,
                  status: 'ready'
                },
                image: {
                  url: `https://images.unsplash.com/photo-${1500000000000 + index}?w=400`,
                  prompt: `Visual representation of: ${sentence.trim().substring(0, 50)}`,
                  status: 'ready'
                },
                captions: {
                  words: sentence.trim().split(' ').map((word, wordIndex) => ({
                    word,
                    start_time: startTime + (wordIndex / sentence.split(' ').length) * duration,
                    end_time: startTime + ((wordIndex + 1) / sentence.split(' ').length) * duration,
                    confidence: 0.95
                  })),
                  style_applied: 'default',
                  status: 'ready'
                }
              },
              edit_history: [],
              status: 'ready',
              locked: false
            };
          });

          set((state) => {
            state.segments = mockSegments;
            state.project.duration = mockSegments.length > 0 
              ? Math.max(...mockSegments.map(s => s.end_time))
              : 0;
            state.project.status = 'completed';
            state.ui.loading.global = false;
          });

          get().showToast('Video generated from script!', 'success');
        },

        regenerateSegment: async (segmentId: string, type = 'both' as 'voice' | 'image' | 'both') => {
          if (type === 'both') {
            await Promise.all([
              get().regenerateAsset(segmentId, 'voice'),
              get().regenerateAsset(segmentId, 'image')
            ]);
          } else {
            await get().regenerateAsset(segmentId, type);
          }
        },

        optimizeTimeline: async () => {
          set((state) => {
            state.ui.loading.global = true;
          });

          get().showToast('Optimizing timeline...', 'info');

          // Mock AI optimization
          await new Promise(resolve => setTimeout(resolve, 3000));

          set((state) => {
            // Mock optimization: adjust segment timing for better flow
            let currentTime = 0;
            state.segments.forEach(segment => {
              segment.start_time = currentTime;
              segment.end_time = currentTime + segment.duration;
              currentTime = segment.end_time + 0.1; // Small gap between segments
            });

            state.project.duration = currentTime;
            state.ui.loading.global = false;
            state.ui.feedback.unsaved_changes = true;
          });

          get().showToast('Timeline optimized for better flow!', 'success');
        }
      })),
    { name: 'VideoEditorStore' }
  )
);

// Export types for use in components
export type { VideoEditorState, VideoEditorActions, SegmentData, ProjectState, TimelineState };