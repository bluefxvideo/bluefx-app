/**
 * ReelEstate - Real Estate Listing Video Maker & Photo Cleanup
 * Shared types for both client and server components
 */

// ═══════════════════════════════════════════
// Zillow Scraper Types
// ═══════════════════════════════════════════

export interface ZillowListingData {
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  price_formatted: string;
  beds: number;
  baths: number;
  sqft: number;
  lot_size?: string;
  year_built?: number;
  property_type: string;
  description: string;
  agent_name?: string;
  agent_brokerage?: string;
  photo_urls: string[];
  mls_id?: string;
  status: string;
}

export interface ZillowScrapeResult {
  success: boolean;
  listing?: ZillowListingData;
  error?: string;
}

// ═══════════════════════════════════════════
// Image Interpreter Types
// ═══════════════════════════════════════════

export const ROOM_TYPES = [
  'exterior_front', 'exterior_back', 'exterior_side', 'aerial',
  'living_room', 'kitchen', 'bedroom', 'bathroom', 'dining_room',
  'office', 'basement', 'garage', 'backyard', 'pool',
  'laundry', 'hallway', 'foyer', 'patio', 'balcony',
  'closet', 'attic', 'other',
] as const;

export type RoomType = typeof ROOM_TYPES[number];

export const SHOT_TYPES = ['wide', 'medium', 'close_up', 'detail'] as const;
export type ShotType = typeof SHOT_TYPES[number];

// LTX-2.3-Fast native camera motions — no mapping needed
export const CAMERA_MOTIONS = [
  'none', 'dolly_in', 'dolly_out', 'dolly_left', 'dolly_right',
  'jib_up', 'jib_down', 'static', 'focus_shift',
] as const;

export type CameraMotion = typeof CAMERA_MOTIONS[number];

export interface ImageAnalysis {
  index: number;
  room_type: RoomType;
  description: string;
  key_features: string[];
  shot_type: ShotType;
  camera_motion: CameraMotion;
  motion_reasoning: string;
  quality_score: number;
  is_usable: boolean;
  issues: string[];
  cleanup_needed: boolean;
  pair_candidate: number | null;
}

export interface ImageAnalysisResult {
  success: boolean;
  analyses: ImageAnalysis[];
  error?: string;
}

// ═══════════════════════════════════════════
// Script Generator Types
// ═══════════════════════════════════════════

export interface ScriptSegment {
  index: number;
  image_index: number;
  voiceover: string;
  duration_seconds: number;
}

export interface ListingScript {
  segments: ScriptSegment[];
  total_duration_seconds: number;
}

export interface ScriptGenerationResult {
  success: boolean;
  script?: ListingScript;
  error?: string;
}

export const TARGET_DURATIONS = [15, 30, 45, 60] as const;
export type TargetDuration = typeof TARGET_DURATIONS[number];

// ═══════════════════════════════════════════
// Clip Generator Types
// ═══════════════════════════════════════════

export interface ClipGenerationRequest {
  index: number;
  photo_url: string;
  camera_motion: CameraMotion;
  prompt: string;
  aspect_ratio: '16:9' | '9:16';
}

export type ClipStatusValue = 'pending' | 'starting' | 'processing' | 'succeeded' | 'failed';

export interface ClipStatus {
  index: number;
  prediction_id: string;
  status: ClipStatusValue;
  video_url?: string;
  error?: string;
}

// ═══════════════════════════════════════════
// Video Assembly Types
// ═══════════════════════════════════════════

export interface AssemblyRequest {
  listing_id: string;
  clip_urls: string[];
  voiceover_url: string;
  voiceover_duration: number;
  aspect_ratio: '16:9' | '9:16';
  listing_data?: ZillowListingData;
}

export interface AssemblyResult {
  success: boolean;
  video_url?: string;
  duration_seconds?: number;
  error?: string;
}

// ═══════════════════════════════════════════
// Photo Cleanup Types
// ═══════════════════════════════════════════

export type CleanupPreset =
  | 'remove_people'
  | 'remove_license_plates'
  | 'remove_clutter'
  | 'remove_personal_items'
  | 'declutter_counters'
  | 'sky_enhancement'
  | 'custom';

export const CLEANUP_PRESET_CONFIG: Record<CleanupPreset, {
  label: string;
  description: string;
  prompt: string;
}> = {
  remove_people: {
    label: 'Remove People',
    description: 'Remove people from the photo',
    prompt: 'Remove all people from this real estate photo. Keep the background, furniture, and architecture exactly the same. Fill in the area where people were with the surrounding environment seamlessly.',
  },
  remove_license_plates: {
    label: 'Remove License Plates',
    description: 'Blur or remove visible license plates',
    prompt: 'Remove or blur all license plates visible in this real estate photo. Replace with a clean, generic plate area. Keep everything else identical.',
  },
  remove_clutter: {
    label: 'Remove Clutter',
    description: 'Clean up general clutter and mess',
    prompt: 'Remove clutter, mess, and disorganized items from this real estate photo. Make surfaces clean and tidy. Keep furniture and architecture the same but remove small scattered items, papers, toys, and general disorder.',
  },
  remove_personal_items: {
    label: 'Remove Personal Items',
    description: 'Remove family photos, names, personal effects',
    prompt: 'Remove all personal items from this real estate photo including family photos, personal artwork, name tags, personal decorations, religious items, and identifiable personal effects. Replace with neutral decor or blank walls/surfaces.',
  },
  declutter_counters: {
    label: 'Declutter Counters',
    description: 'Clean kitchen and bathroom countertops',
    prompt: 'Remove all items from countertops in this real estate photo. Clear kitchen counters of appliances, dishes, food items. Clear bathroom counters of toiletries. Leave counters clean and bare to showcase the surface material.',
  },
  sky_enhancement: {
    label: 'Sky Enhancement',
    description: 'Replace dull skies with vibrant blue sky',
    prompt: 'Replace the sky in this real estate exterior photo with a beautiful, vibrant blue sky with a few soft white clouds. Keep the house, landscaping, and all other elements exactly the same. Make the lighting consistent with a bright sunny day.',
  },
  custom: {
    label: 'Custom Instructions',
    description: 'Describe what to change in your own words',
    prompt: '',
  },
};

/** Map an image analysis issue to the best cleanup preset */
export function issueToPreset(issue: string): CleanupPreset {
  const map: Record<string, CleanupPreset> = {
    contains_person: 'remove_people',
    license_plate: 'remove_license_plates',
    personal_items: 'remove_personal_items',
    clutter: 'remove_clutter',
  };
  return map[issue] || 'remove_clutter';
}

export interface CleanupRequest {
  image_url: string;
  preset: CleanupPreset;
  custom_prompt?: string;
  listing_id?: string;
}

export interface CleanupResult {
  success: boolean;
  original_url: string;
  cleaned_url?: string;
  preset: CleanupPreset;
  error?: string;
}

// ═══════════════════════════════════════════
// Listing Project (Client State)
// ═══════════════════════════════════════════

export type ListingStatus =
  | 'idle'
  | 'scraping'
  | 'analyzing'
  | 'analyzed'
  | 'scripting'
  | 'script_ready'
  | 'generating_clips'
  | 'generating_voiceover'
  | 'rendering'
  | 'assembling'
  | 'completed'
  | 'failed';

export interface ReelEstateProject {
  id?: string;
  listing: ZillowListingData | null;
  photos: string[];
  analyses: ImageAnalysis[];
  selectedIndices: number[];
  script: ListingScript | null;
  clips: ClipStatus[];
  voiceover: { url: string; duration: number } | null;
  renderId: string | null;
  renderProgress: number | null;
  finalVideoUrl: string | null;
  status: ListingStatus;
  error: string | null;
  aspectRatio: '16:9' | '9:16';
  targetDuration: TargetDuration;
  voiceId: string;
  voiceSpeed: number;
  creditsUsed: number;
}

/** Map camera_motion from Gemini analysis → Ken Burns direction for Remotion */
export function cameraMotionToKenBurns(motion: CameraMotion): string {
  const map: Record<string, string> = {
    dolly_in: 'zoom_in',
    dolly_out: 'zoom_out',
    dolly_left: 'pan_left',
    dolly_right: 'pan_right',
    jib_up: 'pan_up',
    jib_down: 'pan_down',
    static: 'zoom_in',
    focus_shift: 'zoom_in',
    none: 'zoom_in',
  };
  return map[motion] || 'zoom_in';
}

// ═══════════════════════════════════════════
// Agent Clone Types
// ═══════════════════════════════════════════

export type AgentCloneShotStatus = 'idle' | 'compositing' | 'composite_ready' | 'animating' | 'ready' | 'failed';

export const AGENT_CLONE_CAMERA_MOTIONS = [
  'none', 'dolly_in', 'dolly_out', 'dolly_left', 'dolly_right',
  'jib_up', 'jib_down', 'static', 'focus_shift',
] as const;

export type AgentCloneCameraMotion = typeof AGENT_CLONE_CAMERA_MOTIONS[number];

export const AGENT_CLONE_DURATIONS = [6, 8, 10, 12, 14, 16, 18, 20] as const;
export type AgentCloneDuration = typeof AGENT_CLONE_DURATIONS[number];

export interface AgentCloneShot {
  id: string;
  generationId: string | null;
  agentPhotoUrl: string;
  backgroundUrl: string;
  compositeUrl: string | null;
  videoUrl: string | null;
  predictionId: string | null;
  status: AgentCloneShotStatus;
  prompt: string;
  dialogue: string;
  action: string;
  cameraMotion: AgentCloneCameraMotion;
  duration: AgentCloneDuration;
  error: string | null;
}

// ═══════════════════════════════════════════
// Database Row Types
// ═══════════════════════════════════════════

export interface ReelEstateListingRow {
  id: string;
  user_id: string;
  zillow_url: string | null;
  source_type: 'zillow' | 'manual';
  listing_data: ZillowListingData | null;
  photo_urls: string[];
  image_analysis: ImageAnalysis[] | null;
  selected_indices: number[];
  script_segments: ScriptSegment[] | null;
  clip_predictions: ClipStatus[] | null;
  voiceover_url: string | null;
  voiceover_duration_seconds: number | null;
  render_id: string | null;
  final_video_url: string | null;
  aspect_ratio: string;
  target_duration: number;
  voice_id: string | null;
  status: string;
  error_message: string | null;
  total_credits_used: number;
  created_at: string;
  updated_at: string;
}

export interface ReelEstateCleanupRow {
  id: string;
  user_id: string;
  listing_id: string | null;
  original_url: string;
  preset: string;
  cleanup_prompt: string;
  cleaned_url: string | null;
  status: string;
  error_message: string | null;
  credits_used: number;
  created_at: string;
}

export interface AgentCloneGenerationRow {
  id: string;
  user_id: string;
  agent_photo_url: string;
  background_url: string;
  composite_url: string | null;
  video_url: string | null;
  prompt: string;
  dialogue: string;
  action: string;
  camera_motion: string;
  duration: number;
  aspect_ratio: string;
  status: string;
  prediction_id: string | null;
  error_message: string | null;
  credits_used: number;
  created_at: string;
  updated_at: string;
}
