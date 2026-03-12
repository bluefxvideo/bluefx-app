'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getUserCredits } from '@/actions/credit-management';
import {
  startListingProject,
  analyzeListingPhotos,
  generateScript as serverGenerateScript,
  generateClips as serverGenerateClips,
  generateListingVoiceover,
  renderListingVideo,
  checkListingRenderProgress,
  cleanupListingPhoto,
} from '@/actions/tools/reelestate/orchestrator';
import { generateListingClip, pollClipStatus } from '@/actions/tools/reelestate/clip-generator';
import { cleanupPhoto } from '@/actions/tools/reelestate/photo-cleanup';
import { getUserListings } from '@/actions/database/reelestate-database';
import { createClient } from '@/app/supabase/client';
import type {
  ReelEstateProject,
  ListingStatus,
  ZillowListingData,
  ImageAnalysis,
  ScriptSegment,
  ClipStatus,
  CleanupPreset,
  CleanupResult,
  TargetDuration,
  ReelEstateListingRow,
} from '@/types/reelestate';
import { issueToPreset } from '@/types/reelestate';

const INITIAL_PROJECT: ReelEstateProject = {
  listing: null,
  photos: [],
  analyses: [],
  selectedIndices: [],
  script: null,
  clips: [],
  voiceover: null,
  renderId: null,
  renderProgress: null,
  finalVideoUrl: null,
  status: 'idle',
  error: null,
  aspectRatio: '16:9',
  targetDuration: 30,
  voiceId: 'Friendly_Person',
  creditsUsed: 0,
};

interface CleanupQueueItem {
  url: string;
  preset: CleanupPreset;
  customPrompt?: string;
  filename?: string;
}

export function useReelEstate() {
  const [project, setProject] = useState<ReelEstateProject>({ ...INITIAL_PROJECT });
  const [credits, setCredits] = useState(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Photo cleanup state
  const [cleanupResults, setCleanupResults] = useState<CleanupResult[]>([]);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupQueue, setCleanupQueue] = useState<CleanupQueueItem[]>([]);
  const [cleaningIndices, setCleaningIndices] = useState<number[]>([]);

  // History state
  const [listings, setListings] = useState<ReelEstateListingRow[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Clip polling ref
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Auth + Credits ────────────────────────────
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const result = await getUserCredits(user.id);
        if (result.success) setCredits(result.credits || 0);
      }
      setIsLoadingCredits(false);
    };
    init();
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!userId) return;
    const result = await getUserCredits(userId);
    if (result.success) setCredits(result.credits || 0);
  }, [userId]);

  // ─── Helper: Update project state ──────────────
  const updateProject = useCallback((updates: Partial<ReelEstateProject>) => {
    setProject(prev => ({ ...prev, ...updates }));
  }, []);

  // ─── Step 1: Start Project ─────────────────────
  const startProject = useCallback(async (input: {
    zillow_url?: string;
    manual_photos?: string[];
    manual_listing_data?: Partial<ZillowListingData>;
  }) => {
    updateProject({ status: 'scraping', error: null });

    const result = await startListingProject(input);

    if (!result.success) {
      updateProject({ status: 'failed', error: result.error || 'Failed to start project' });
      toast.error(result.error || 'Failed to start project');
      return;
    }

    updateProject({
      id: result.listing_id,
      listing: result.listing || null,
      photos: result.photos || [],
      analyses: [],
      selectedIndices: [],
      script: null,
      clips: [],
      voiceover: null,
      renderId: null,
      renderProgress: null,
      finalVideoUrl: null,
      status: 'idle',
      error: null,
      creditsUsed: 0,
    });

    await refreshCredits();
    toast.success(`Loaded ${result.photos?.length || 0} photos`);
  }, [updateProject, refreshCredits]);

  // ─── Step 2: Analyze Photos ────────────────────
  const analyzePhotos = useCallback(async () => {
    if (!project.id || project.photos.length === 0) return;

    updateProject({ status: 'analyzing', error: null });

    const result = await analyzeListingPhotos(
      project.id,
      project.photos,
      project.listing || undefined,
    );

    if (!result.success) {
      updateProject({ status: 'failed', error: result.error || 'Analysis failed' });
      toast.error(result.error || 'Analysis failed');
      return;
    }

    const usableIndices = result.analyses
      .filter(a => a.is_usable && a.quality_score >= 4)
      .map(a => a.index);

    updateProject({
      analyses: result.analyses,
      selectedIndices: usableIndices,
      status: 'analyzed',
    });

    await refreshCredits();
    toast.success(`Analyzed ${result.analyses.length} photos — ${usableIndices.length} selected`);
  }, [project.id, project.photos, project.listing, updateProject, refreshCredits]);

  // ─── Step 3: Generate Script ───────────────────
  const generateScript = useCallback(async () => {
    if (!project.id || project.selectedIndices.length === 0 || !project.listing) return;

    updateProject({ status: 'scripting', error: null });

    const selectedAnalyses = project.analyses.filter(a =>
      project.selectedIndices.includes(a.index)
    );

    const result = await serverGenerateScript(
      project.id,
      selectedAnalyses,
      project.listing,
      project.targetDuration,
    );

    if (!result.success || !result.script) {
      updateProject({ status: 'analyzed', error: result.error || 'Script generation failed' });
      toast.error(result.error || 'Script generation failed');
      return;
    }

    updateProject({
      script: result.script,
      status: 'script_ready',
    });

    await refreshCredits();
    toast.success(`Script generated — ${result.script.segments.length} segments`);
  }, [project.id, project.selectedIndices, project.listing, project.analyses, project.targetDuration, updateProject, refreshCredits]);

  // ─── Step 4: Generate Voiceover ────────────────
  const generateVoiceover = useCallback(async () => {
    if (!project.id || !project.script || project.selectedIndices.length === 0) return;

    updateProject({ status: 'generating_voiceover', error: null });

    // Combine selected segments into one script
    const selectedSegments = project.script.segments.filter(segment =>
      project.selectedIndices.includes(segment.image_index)
    );

    const fullScript = selectedSegments.map(s => s.voiceover.trim()).join('... ');

    const result = await generateListingVoiceover(project.id!, fullScript, project.voiceId);

    if (!result.success || !result.audio_url) {
      updateProject({ status: 'script_ready', error: result.error || 'Voiceover generation failed' });
      toast.error(result.error || 'Voiceover generation failed');
      return;
    }

    updateProject({
      voiceover: { url: result.audio_url, duration: result.duration || 0 },
      status: 'script_ready',
      error: null,
    });
    await refreshCredits();
    toast.success('Voiceover generated');
  }, [project.id, project.script, project.selectedIndices, project.voiceId, updateProject, refreshCredits]);

  // ─── Step 5: Render Video (Remotion) ─────────────
  const renderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const renderVideo = useCallback(async () => {
    if (!project.id || !project.voiceover || !project.script) return;

    updateProject({ status: 'rendering', error: null, renderProgress: 0, finalVideoUrl: null });

    const result = await renderListingVideo(project.id);

    if (!result.success || !result.renderId) {
      updateProject({ status: 'script_ready', error: result.error || 'Failed to start render' });
      toast.error(result.error || 'Failed to start render');
      return;
    }

    updateProject({ renderId: result.renderId });
    toast.success('Video render started');
  }, [project.id, project.voiceover, project.script, updateProject]);

  // Render progress polling
  const pollRender = useCallback(async () => {
    if (!project.id || !project.renderId) return;

    const result = await checkListingRenderProgress(project.id);

    if (!result.success || result.status === 'failed') {
      updateProject({
        status: 'script_ready',
        error: result.error || 'Render failed',
        renderProgress: null,
        renderId: null,
      });
      toast.error(result.error || 'Video render failed');
      return;
    }

    if (result.status === 'completed' && result.videoUrl) {
      updateProject({
        finalVideoUrl: result.videoUrl,
        status: 'completed',
        renderProgress: 1,
      });
      await refreshCredits();
      toast.success('Video rendered successfully!');
      return;
    }

    // Still in progress
    updateProject({ renderProgress: result.progress });
  }, [project.id, project.renderId, updateProject, refreshCredits]);

  // Auto-poll render every 5s when rendering
  useEffect(() => {
    if (project.status === 'rendering' && project.renderId && !renderPollRef.current) {
      renderPollRef.current = setInterval(pollRender, 5000);
    } else if (project.status !== 'rendering' && renderPollRef.current) {
      clearInterval(renderPollRef.current);
      renderPollRef.current = null;
    }

    return () => {
      if (renderPollRef.current) {
        clearInterval(renderPollRef.current);
        renderPollRef.current = null;
      }
    };
  }, [project.status, project.renderId, pollRender]);

  // ─── Generate Clips (optional, for editor) ──────
  const generateClips = useCallback(async () => {
    if (!project.id || !project.script || project.selectedIndices.length === 0) return;

    updateProject({ status: 'generating_clips', error: null });

    // Only generate clips for currently selected photos
    const selectedSegments = project.script.segments.filter(segment =>
      project.selectedIndices.includes(segment.image_index)
    );

    if (selectedSegments.length === 0) {
      toast.error('No selected photos have script segments');
      return;
    }

    const clipRequests = selectedSegments.map(segment => {
      const analysis = project.analyses.find(a => a.index === segment.image_index);
      return {
        index: segment.index,
        photo_url: project.photos[segment.image_index],
        camera_motion: analysis?.camera_motion || 'none' as const,
        prompt: `Slow, smooth cinematic real estate footage. ${analysis?.description || ''} ${segment.voiceover}`.trim(),
        aspect_ratio: project.aspectRatio,
      };
    });

    const result = await serverGenerateClips(project.id, clipRequests);

    if (!result.success) {
      updateProject({ status: 'script_ready', error: result.error || 'Clip generation failed' });
      toast.error(result.error || 'Clip generation failed');
      return;
    }

    updateProject({ clips: result.clips });
    await refreshCredits();
    toast.success(`Started generating ${result.clips.length} clips`);
  }, [project, updateProject, refreshCredits]);

  // ─── Clip Polling ──────────────────────────────
  const pollClips = useCallback(async () => {
    const activeClips = project.clips.filter(
      c => c.status === 'starting' || c.status === 'processing'
    );
    if (activeClips.length === 0) return;

    const updatedClips = [...project.clips];
    let changed = false;

    for (const clip of activeClips) {
      const result = await pollClipStatus(clip.prediction_id);
      const idx = updatedClips.findIndex(c => c.index === clip.index);
      if (idx !== -1 && result.status !== updatedClips[idx].status) {
        updatedClips[idx] = { ...updatedClips[idx], ...result };
        changed = true;
      }
    }

    if (changed) {
      updateProject({ clips: updatedClips });

      const allDone = updatedClips.every(
        c => c.status === 'succeeded' || c.status === 'failed'
      );
      if (allDone) {
        const succeeded = updatedClips.filter(c => c.status === 'succeeded').length;
        updateProject({ status: succeeded > 0 ? 'completed' : 'failed' });
        toast.success(`${succeeded}/${updatedClips.length} clips generated`);
      }
    }
  }, [project.clips, updateProject]);

  // Auto-poll clips every 5s when generating
  useEffect(() => {
    const hasActiveClips = project.clips.some(
      c => c.status === 'starting' || c.status === 'processing'
    );

    if (hasActiveClips && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(pollClips, 5000);
    } else if (!hasActiveClips && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [project.clips, pollClips]);

  // ─── Regenerate Single Clip ────────────────────
  const regenerateClip = useCallback(async (clipIndex: number) => {
    if (!project.script) return;

    const segment = project.script.segments.find(s => s.index === clipIndex);
    if (!segment) return;

    const analysis = project.analyses.find(a => a.index === segment.image_index);

    // Mark clip as starting
    const updatedClips = project.clips.map(c =>
      c.index === clipIndex ? { ...c, status: 'starting' as const, video_url: undefined, error: undefined } : c
    );
    updateProject({ clips: updatedClips });

    const result = await generateListingClip({
      index: segment.index,
      photo_url: project.photos[segment.image_index],
      camera_motion: analysis?.camera_motion || 'none',
      prompt: `Slow, smooth cinematic real estate footage. ${analysis?.description || ''} ${segment.voiceover}`.trim(),
      aspect_ratio: project.aspectRatio,
    });

    const finalClips = updatedClips.map(c =>
      c.index === clipIndex ? result : c
    );
    updateProject({ clips: finalClips });

    if (result.status === 'failed') {
      toast.error(`Clip ${clipIndex + 1} failed to regenerate`);
    } else {
      toast.success(`Regenerating clip ${clipIndex + 1}...`);
      await refreshCredits();
    }
  }, [project, updateProject, refreshCredits]);

  // ─── Selection & Settings ──────────────────────
  const setSelectedIndices = useCallback((indices: number[]) => {
    updateProject({ selectedIndices: indices });
  }, [updateProject]);

  const updateScriptSegment = useCallback((index: number, voiceover: string) => {
    if (!project.script) return;
    const segments = project.script.segments.map(s =>
      s.index === index ? { ...s, voiceover } : s
    );
    updateProject({
      script: { ...project.script, segments },
    });
  }, [project.script, updateProject]);

  const setAspectRatio = useCallback((ratio: '16:9' | '9:16') => {
    updateProject({ aspectRatio: ratio });
  }, [updateProject]);

  const setTargetDuration = useCallback((duration: TargetDuration) => {
    updateProject({ targetDuration: duration });
  }, [updateProject]);

  const setVoiceId = useCallback((voiceId: string) => {
    updateProject({ voiceId });
  }, [updateProject]);

  // ─── Photo Cleanup ─────────────────────────────
  const addToCleanupQueue = useCallback((item: CleanupQueueItem) => {
    setCleanupQueue(prev => [...prev, item]);
  }, []);

  const removeFromCleanupQueue = useCallback((index: number) => {
    setCleanupQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearCleanupQueue = useCallback(() => {
    setCleanupQueue([]);
  }, []);

  const cleanupPhotos = useCallback(async (items: { url: string; preset: CleanupPreset; customPrompt?: string }[]) => {
    if (items.length === 0) return;

    setIsCleaningUp(true);

    const settled = await Promise.allSettled(
      items.map(item => cleanupPhoto(item.url, item.preset, item.customPrompt))
    );

    const results = settled.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        success: false as const,
        original_url: items[i].url,
        preset: items[i].preset,
        error: 'Failed to process',
      };
    });

    setCleanupResults(prev => [...prev, ...results]);
    setIsCleaningUp(false);
    setCleanupQueue([]);
    await refreshCredits();

    const succeeded = results.filter(r => r.success).length;
    toast.success(`${succeeded}/${results.length} photos cleaned up`);
  }, [refreshCredits]);

  // ─── Inline Photo Cleanup (Video Maker) ────────
  const cleanupInlinePhoto = useCallback(async (photoIndex: number) => {
    const analysis = project.analyses.find(a => a.index === photoIndex);
    if (!analysis || !analysis.cleanup_needed) return;

    const preset = analysis.issues.length > 0
      ? issueToPreset(analysis.issues[0])
      : 'remove_clutter' as CleanupPreset;

    setCleaningIndices(prev => [...prev, photoIndex]);

    const result = await cleanupListingPhoto(
      project.id,
      project.photos[photoIndex],
      preset,
    );

    setCleaningIndices(prev => prev.filter(i => i !== photoIndex));

    if (result.success && result.cleaned_url) {
      // Replace photo URL with cleaned version
      const updatedPhotos = [...project.photos];
      updatedPhotos[photoIndex] = result.cleaned_url;

      // Clear cleanup flags on the analysis
      const updatedAnalyses = project.analyses.map(a =>
        a.index === photoIndex
          ? { ...a, cleanup_needed: false, issues: [] }
          : a
      );

      updateProject({ photos: updatedPhotos, analyses: updatedAnalyses });
      await refreshCredits();
      toast.success(`Photo ${photoIndex + 1} cleaned up`);
    } else {
      toast.error(result.error || `Failed to clean photo ${photoIndex + 1}`);
    }
  }, [project.id, project.photos, project.analyses, updateProject, refreshCredits]);

  // ─── History ───────────────────────────────────
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    const result = await getUserListings();
    if (result.success && result.listings) {
      setListings(result.listings as ReelEstateListingRow[]);
    }
    setIsLoadingHistory(false);
  }, []);

  const loadProject = useCallback((listing: ReelEstateListingRow) => {
    setProject({
      id: listing.id,
      listing: listing.listing_data,
      photos: listing.photo_urls || [],
      analyses: (listing.image_analysis as ImageAnalysis[]) || [],
      selectedIndices: listing.selected_indices || [],
      script: listing.script_segments
        ? {
            segments: listing.script_segments as ScriptSegment[],
            total_duration_seconds: (listing.script_segments as ScriptSegment[]).reduce(
              (acc, s) => acc + s.duration_seconds, 0
            ),
          }
        : null,
      clips: (listing.clip_predictions as ClipStatus[]) || [],
      voiceover: listing.voiceover_url
        ? { url: listing.voiceover_url, duration: listing.voiceover_duration_seconds || 0 }
        : null,
      renderId: listing.render_id || null,
      renderProgress: listing.final_video_url ? 1 : null,
      finalVideoUrl: listing.final_video_url,
      status: listing.status as ListingStatus,
      error: listing.error_message,
      aspectRatio: (listing.aspect_ratio as '16:9' | '9:16') || '16:9',
      targetDuration: (listing.target_duration as TargetDuration) || 30,
      voiceId: listing.voice_id || 'Friendly_Person',
      creditsUsed: listing.total_credits_used || 0,
    });
    toast.success('Project loaded');
  }, []);

  // ─── Derived State ─────────────────────────────
  const isWorking = ['scraping', 'analyzing', 'scripting', 'generating_clips', 'generating_voiceover', 'rendering', 'assembling'].includes(project.status);

  return {
    project,
    credits,
    isLoadingCredits,
    startProject,
    analyzePhotos,
    generateScript,
    generateVoiceover,
    renderVideo,
    generateClips,
    regenerateClip,
    pollClips,
    setSelectedIndices,
    updateScriptSegment,
    setAspectRatio,
    setTargetDuration,
    setVoiceId,
    cleanupPhotos,
    cleanupInlinePhoto,
    cleaningIndices,
    cleanupResults,
    isCleaningUp,
    cleanupQueue,
    addToCleanupQueue,
    removeFromCleanupQueue,
    clearCleanupQueue,
    listings,
    isLoadingHistory,
    loadHistory,
    loadProject,
    isWorking,
  };
}
