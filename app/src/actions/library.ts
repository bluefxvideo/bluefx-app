'use server';

/**
 * My Library — unified view of everything the user has created, across all
 * tools. Reads the existing per-tool tables in parallel and normalizes into a
 * single feed (no new tables/migrations needed).
 */

import { createClient } from '@/app/supabase/server';

export type LibraryItemType = 'video' | 'image' | 'logo' | 'thumbnail' | 'music' | 'voice' | 'avatar';

export interface LibraryItem {
  id: string;
  type: LibraryItemType;
  title: string;
  /** Primary media URL (video/audio/image). Empty string for drafts. */
  url: string;
  thumbnail_url?: string | null;
  /** Route of the tool that made it (for "open in tool"). */
  tool_route: string;
  tool_name: string;
  created_at: string;
  /** Generated but not yet rendered/exported — open in the tool to finish. */
  draft?: boolean;
}

const IMAGE_TYPE_BY_MODEL: Record<string, { type: LibraryItemType; tool: string; route: string }> = {
  'image-maker': { type: 'image', tool: 'Image Maker', route: '/dashboard/image-maker/history' },
  'nano-banana': { type: 'image', tool: 'Image Maker', route: '/dashboard/image-maker/history' },
  'logo-generator': { type: 'logo', tool: 'Logo Maker', route: '/dashboard/logo-generator/history' },
};

/**
 * Cheap creation milestones for the dashboard checklist — head-only counts,
 * no row data transferred.
 */
export async function getCreationMilestones(): Promise<{
  success: boolean;
  hasImage?: boolean;
  hasVideo?: boolean;
  hasAudio?: boolean;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false };

    const count = (table: string, urlCol: string) =>
      supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not(urlCol, 'is', null)
        .limit(1);

    const [imgs, vids, s2v, music, voice] = await Promise.all([
      count('generated_images', 'image_urls'),
      count('cinematographer_videos', 'final_video_url'),
      count('script_to_video_history', 'video_url'),
      count('music_history', 'audio_url'),
      count('generated_voices', 'audio_url'),
    ]);

    return {
      success: true,
      hasImage: (imgs.count || 0) > 0,
      hasVideo: (vids.count || 0) > 0 || (s2v.count || 0) > 0,
      hasAudio: (music.count || 0) > 0 || (voice.count || 0) > 0,
    };
  } catch {
    return { success: false };
  }
}

export async function getLibraryItems(): Promise<{ success: boolean; items?: LibraryItem[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not signed in.' };

    const LIMIT = 60; // per source; merged feed is sorted + capped below

    const [videos, images, music, avatars, scriptVideos, swaps, voices] = await Promise.all([
      supabase
        .from('cinematographer_videos')
        .select('id, project_name, final_video_url, created_at')
        .eq('user_id', user.id)
        .not('final_video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(LIMIT),
      supabase
        .from('generated_images')
        .select('id, prompt, image_urls, thumbnail_urls, model_name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(LIMIT),
      supabase
        .from('music_history')
        .select('id, track_title, audio_url, created_at')
        .eq('user_id', user.id)
        .not('audio_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(LIMIT),
      supabase
        .from('avatar_videos')
        .select('id, video_url, thumbnail_url, action_prompt, created_at')
        .eq('user_id', user.id)
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(LIMIT),
      // NOTE: no video_url filter — generation marks rows 'completed' with a
      // NULL video_url until the user renders/exports in the editor. Those
      // drafts must still show in the library (as "finish in editor" cards),
      // otherwise a finished-looking video silently never appears here.
      supabase
        .from('script_to_video_history')
        .select('id, script_title, video_url, thumbnail_url, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(LIMIT),
      supabase
        .from('video_swap_jobs')
        .select('id, result_video_url, thumbnail_url, created_at')
        .eq('user_id', user.id)
        .not('result_video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(LIMIT),
      supabase
        .from('generated_voices')
        .select('id, voice_name, script_text, audio_url, created_at')
        .eq('user_id', user.id)
        .not('audio_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(LIMIT),
    ]);

    const items: LibraryItem[] = [];

    for (const v of videos.data || []) {
      items.push({
        id: `cin_${v.id}`, type: 'video',
        title: v.project_name || 'Video',
        url: v.final_video_url!, created_at: v.created_at,
        tool_name: 'Video Maker', tool_route: '/dashboard/ai-cinematographer/history',
      });
    }
    for (const img of images.data || []) {
      const urls: string[] = img.image_urls || [];
      if (!urls.length) continue;
      const meta = IMAGE_TYPE_BY_MODEL[img.model_name as string] ||
        { type: 'thumbnail' as LibraryItemType, tool: 'Thumbnail Maker', route: '/dashboard/thumbnail-machine/history' };
      items.push({
        id: `img_${img.id}`, type: meta.type,
        title: (img.prompt || 'Image').slice(0, 80),
        url: urls[0], thumbnail_url: (img.thumbnail_urls || [])[0] || urls[0],
        created_at: img.created_at, tool_name: meta.tool, tool_route: meta.route,
      });
    }
    for (const m of music.data || []) {
      items.push({
        id: `mus_${m.id}`, type: 'music',
        title: m.track_title || 'Music track',
        url: m.audio_url!, created_at: m.created_at,
        tool_name: 'Music', tool_route: '/dashboard/music-maker',
      });
    }
    for (const a of avatars.data || []) {
      items.push({
        id: `ava_${a.id}`, type: 'avatar',
        title: (a.action_prompt || 'Avatar video').slice(0, 80),
        url: a.video_url!, thumbnail_url: a.thumbnail_url,
        created_at: a.created_at, tool_name: 'AI Avatar', tool_route: '/dashboard/talking-avatar/history',
      });
    }
    for (const s of scriptVideos.data || []) {
      items.push({
        id: `s2v_${s.id}`, type: 'video',
        title: s.script_title || 'Script video',
        url: s.video_url || '', thumbnail_url: s.thumbnail_url,
        created_at: s.created_at, tool_name: 'Script to Video', tool_route: '/dashboard/script-to-video/history',
        draft: !s.video_url,
      });
    }
    for (const sw of swaps.data || []) {
      items.push({
        id: `swp_${sw.id}`, type: 'video',
        title: 'Video swap',
        url: sw.result_video_url!, thumbnail_url: sw.thumbnail_url,
        created_at: sw.created_at, tool_name: 'Video Swap', tool_route: '/dashboard/video-swap',
      });
    }
    for (const vo of voices.data || []) {
      items.push({
        id: `vox_${vo.id}`, type: 'voice',
        title: vo.voice_name || (vo.script_text || 'Voice over').slice(0, 80),
        url: vo.audio_url!, created_at: vo.created_at,
        tool_name: 'Voice', tool_route: '/dashboard/voice-over/history',
      });
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { success: true, items: items.slice(0, 200) };
  } catch (error) {
    console.error('getLibraryItems error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load library.' };
  }
}
