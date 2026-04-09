/**
 * Pre-curated music library for Real Estate videos.
 * Tracks are generated via Google Lyra 3 Pro and stored in Supabase Storage.
 * Free for all users — no per-use credit cost.
 */

export interface MusicTrack {
  id: string;
  title: string;
  genre: MusicGenre;
  duration: number; // seconds
  url: string; // Supabase Storage public URL
}

export const MUSIC_GENRES = ['upbeat', 'calm', 'elegant', 'modern', 'dramatic'] as const;
export type MusicGenre = typeof MUSIC_GENRES[number];

export const GENRE_LABELS: Record<MusicGenre, string> = {
  upbeat: 'Upbeat',
  calm: 'Calm',
  elegant: 'Elegant',
  modern: 'Modern',
  dramatic: 'Dramatic',
};

// TODO: Replace placeholder URLs with actual Lyra 3 Pro generated tracks uploaded to Supabase Storage
// Upload path: music-library/{genre}/{track-name}.mp3
const SUPABASE_STORAGE_BASE = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/music-library';

export const MUSIC_LIBRARY: MusicTrack[] = [
  // Upbeat
  { id: 'upbeat-1', title: 'Sunny Horizons', genre: 'upbeat', duration: 60, url: `${SUPABASE_STORAGE_BASE}/upbeat/sunny-horizons.mp3` },
  { id: 'upbeat-2', title: 'Open House Energy', genre: 'upbeat', duration: 45, url: `${SUPABASE_STORAGE_BASE}/upbeat/open-house-energy.mp3` },
  { id: 'upbeat-3', title: 'Welcome Home', genre: 'upbeat', duration: 60, url: `${SUPABASE_STORAGE_BASE}/upbeat/welcome-home.mp3` },
  { id: 'upbeat-4', title: 'Fresh Start', genre: 'upbeat', duration: 30, url: `${SUPABASE_STORAGE_BASE}/upbeat/fresh-start.mp3` },
  { id: 'upbeat-5', title: 'Golden Days', genre: 'upbeat', duration: 45, url: `${SUPABASE_STORAGE_BASE}/upbeat/golden-days.mp3` },

  // Calm
  { id: 'calm-1', title: 'Gentle Breeze', genre: 'calm', duration: 60, url: `${SUPABASE_STORAGE_BASE}/calm/gentle-breeze.mp3` },
  { id: 'calm-2', title: 'Peaceful Living', genre: 'calm', duration: 45, url: `${SUPABASE_STORAGE_BASE}/calm/peaceful-living.mp3` },
  { id: 'calm-3', title: 'Quiet Moments', genre: 'calm', duration: 60, url: `${SUPABASE_STORAGE_BASE}/calm/quiet-moments.mp3` },
  { id: 'calm-4', title: 'Morning Light', genre: 'calm', duration: 30, url: `${SUPABASE_STORAGE_BASE}/calm/morning-light.mp3` },
  { id: 'calm-5', title: 'Soft Landing', genre: 'calm', duration: 45, url: `${SUPABASE_STORAGE_BASE}/calm/soft-landing.mp3` },

  // Elegant
  { id: 'elegant-1', title: 'Luxury Estate', genre: 'elegant', duration: 60, url: `${SUPABASE_STORAGE_BASE}/elegant/luxury-estate.mp3` },
  { id: 'elegant-2', title: 'Grand Opening', genre: 'elegant', duration: 45, url: `${SUPABASE_STORAGE_BASE}/elegant/grand-opening.mp3` },
  { id: 'elegant-3', title: 'Timeless Beauty', genre: 'elegant', duration: 60, url: `${SUPABASE_STORAGE_BASE}/elegant/timeless-beauty.mp3` },
  { id: 'elegant-4', title: 'Crystal Clear', genre: 'elegant', duration: 30, url: `${SUPABASE_STORAGE_BASE}/elegant/crystal-clear.mp3` },
  { id: 'elegant-5', title: 'Fine Living', genre: 'elegant', duration: 45, url: `${SUPABASE_STORAGE_BASE}/elegant/fine-living.mp3` },

  // Modern
  { id: 'modern-1', title: 'Urban Pulse', genre: 'modern', duration: 60, url: `${SUPABASE_STORAGE_BASE}/modern/urban-pulse.mp3` },
  { id: 'modern-2', title: 'Downtown Vibes', genre: 'modern', duration: 45, url: `${SUPABASE_STORAGE_BASE}/modern/downtown-vibes.mp3` },
  { id: 'modern-3', title: 'New Chapter', genre: 'modern', duration: 60, url: `${SUPABASE_STORAGE_BASE}/modern/new-chapter.mp3` },
  { id: 'modern-4', title: 'Clean Lines', genre: 'modern', duration: 30, url: `${SUPABASE_STORAGE_BASE}/modern/clean-lines.mp3` },
  { id: 'modern-5', title: 'Metro Life', genre: 'modern', duration: 45, url: `${SUPABASE_STORAGE_BASE}/modern/metro-life.mp3` },

  // Dramatic
  { id: 'dramatic-1', title: 'Dream Home', genre: 'dramatic', duration: 60, url: `${SUPABASE_STORAGE_BASE}/dramatic/dream-home.mp3` },
  { id: 'dramatic-2', title: 'Reveal', genre: 'dramatic', duration: 45, url: `${SUPABASE_STORAGE_BASE}/dramatic/reveal.mp3` },
  { id: 'dramatic-3', title: 'First Impression', genre: 'dramatic', duration: 60, url: `${SUPABASE_STORAGE_BASE}/dramatic/first-impression.mp3` },
  { id: 'dramatic-4', title: 'Stunning Views', genre: 'dramatic', duration: 30, url: `${SUPABASE_STORAGE_BASE}/dramatic/stunning-views.mp3` },
  { id: 'dramatic-5', title: 'Showtime', genre: 'dramatic', duration: 45, url: `${SUPABASE_STORAGE_BASE}/dramatic/showtime.mp3` },
];

export function getTracksByGenre(genre: MusicGenre): MusicTrack[] {
  return MUSIC_LIBRARY.filter(t => t.genre === genre);
}

export function getTrackById(id: string): MusicTrack | undefined {
  return MUSIC_LIBRARY.find(t => t.id === id);
}
