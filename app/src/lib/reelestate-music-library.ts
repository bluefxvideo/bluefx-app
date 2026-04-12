/**
 * Pre-curated music library for Real Estate videos.
 * Tracks generated via Google Lyria 3 Pro, stored in Supabase Storage.
 * Free for all users — no per-use credit cost.
 */

export interface MusicTrack {
  id: string;
  title: string;
  genre: MusicGenre;
  duration: number; // seconds
  url: string;
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

const SB = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/music-library';

export const MUSIC_LIBRARY: MusicTrack[] = [
  // Upbeat (5 tracks)
  { id: 'upbeat-1', title: 'Sunny Horizons', genre: 'upbeat', duration: 60, url: `${SB}/upbeat/upbeat-1.mp3` },
  { id: 'upbeat-2', title: 'Open House Energy', genre: 'upbeat', duration: 45, url: `${SB}/upbeat/upbeat-2.mp3` },
  { id: 'upbeat-3', title: 'Welcome Home', genre: 'upbeat', duration: 45, url: `${SB}/upbeat/upbeat-3.mp3` },
  { id: 'upbeat-4', title: 'Fresh Start', genre: 'upbeat', duration: 30, url: `${SB}/upbeat/upbeat-4.mp3` },
  { id: 'upbeat-5', title: 'Golden Days', genre: 'upbeat', duration: 45, url: `${SB}/upbeat/upbeat-5.mp3` },

  // Calm (5 tracks)
  { id: 'calm-1', title: 'Gentle Breeze', genre: 'calm', duration: 60, url: `${SB}/calm/calm-1.mp3` },
  { id: 'calm-2', title: 'Peaceful Living', genre: 'calm', duration: 45, url: `${SB}/calm/calm-2.mp3` },
  { id: 'calm-3', title: 'Quiet Moments', genre: 'calm', duration: 45, url: `${SB}/calm/calm-3.mp3` },
  { id: 'calm-4', title: 'Morning Light', genre: 'calm', duration: 30, url: `${SB}/calm/calm-4.mp3` },
  { id: 'calm-5', title: 'Soft Landing', genre: 'calm', duration: 45, url: `${SB}/calm/calm-5.mp3` },

  // Elegant (5 tracks)
  { id: 'elegant-1', title: 'Luxury Estate', genre: 'elegant', duration: 60, url: `${SB}/elegant/elegant-1.mp3` },
  { id: 'elegant-2', title: 'Grand Opening', genre: 'elegant', duration: 45, url: `${SB}/elegant/elegant-2.mp3` },
  { id: 'elegant-3', title: 'Timeless Beauty', genre: 'elegant', duration: 60, url: `${SB}/elegant/elegant-3.mp3` },
  { id: 'elegant-4', title: 'Crystal Clear', genre: 'elegant', duration: 30, url: `${SB}/elegant/elegant-4.mp3` },
  { id: 'elegant-5', title: 'Fine Living', genre: 'elegant', duration: 45, url: `${SB}/elegant/elegant-5.mp3` },

  // Modern (5 tracks)
  { id: 'modern-1', title: 'Urban Pulse', genre: 'modern', duration: 60, url: `${SB}/modern/modern-1.mp3` },
  { id: 'modern-2', title: 'Downtown Vibes', genre: 'modern', duration: 45, url: `${SB}/modern/modern-2.mp3` },
  { id: 'modern-3', title: 'New Chapter', genre: 'modern', duration: 60, url: `${SB}/modern/modern-3.mp3` },
  { id: 'modern-4', title: 'Clean Lines', genre: 'modern', duration: 45, url: `${SB}/modern/modern-4.mp3` },
  { id: 'modern-5', title: 'Metro Life', genre: 'modern', duration: 45, url: `${SB}/modern/modern-5.mp3` },

  // Dramatic (5 tracks)
  { id: 'dramatic-1', title: 'Dream Home', genre: 'dramatic', duration: 60, url: `${SB}/dramatic/dramatic-1.mp3` },
  { id: 'dramatic-2', title: 'Reveal', genre: 'dramatic', duration: 45, url: `${SB}/dramatic/dramatic-2.mp3` },
  { id: 'dramatic-3', title: 'First Impression', genre: 'dramatic', duration: 60, url: `${SB}/dramatic/dramatic-3.mp3` },
  { id: 'dramatic-4', title: 'Stunning Views', genre: 'dramatic', duration: 45, url: `${SB}/dramatic/dramatic-4.mp3` },
  { id: 'dramatic-5', title: 'Showtime', genre: 'dramatic', duration: 45, url: `${SB}/dramatic/dramatic-5.mp3` },
];

export function getTracksByGenre(genre: MusicGenre): MusicTrack[] {
  return MUSIC_LIBRARY.filter(t => t.genre === genre);
}

export function getTrackById(id: string): MusicTrack | undefined {
  return MUSIC_LIBRARY.find(t => t.id === id);
}
