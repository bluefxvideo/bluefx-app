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
  cleanupListingPhoto,
  renderListingVideo,
  checkListingRenderProgress,
} from '@/actions/tools/reelestate/orchestrator';
import { generateListingClip, pollClipStatus } from '@/actions/tools/reelestate/clip-generator';
import { cleanupPhoto } from '@/actions/tools/reelestate/photo-cleanup';
import { getUserListings, updateListing, deleteSavedComposition } from '@/actions/database/reelestate-database';
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
  voiceSpeed: 1.0,
  creditsUsed: 0,
  // Voiceover toggle
  voiceoverEnabled: true,
  // Music & style (simplified flow)
  musicTrackId: null,
  musicUrl: null,
  musicVolume: 0.3,
  introText: null,
  speedRamps: true,
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
      introText: result.listing?.address || null,
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

    const result = await generateListingVoiceover(project.id!, fullScript, project.voiceId, project.voiceSpeed);

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
  }, [project.id, project.script, project.selectedIndices, project.voiceId, project.voiceSpeed, updateProject, refreshCredits]);

  // ─── Regenerate Script / Voiceover ────────────────
  const regenerateScript = useCallback(async () => {
    updateProject({ script: null, voiceover: null });
    await generateScript();
  }, [generateScript, updateProject]);

  const regenerateVoiceover = useCallback(async () => {
    await generateVoiceover();
  }, [generateVoiceover]);

  // ─── Open in Video Editor ───────────────────────
  const openInEditor = useCallback(async () => {
    if (!project.id || !userId || project.selectedIndices.length === 0) {
      console.warn('⚠️ openInEditor guard failed:', { id: project.id, userId, selected: project.selectedIndices.length });
      if (!userId) toast.error('Not signed in — please refresh the page');
      return;
    }

    // Two-phase flow: Phase 1 = generate preview, Phase 2 = open editor
    if (project.voiceoverEnabled) {
      // Phase 1: No script yet — generate script + voiceover for preview, then RETURN
      if (!project.script) {
        updateProject({ status: 'scripting', error: null });
        toast.info('Generating script...');

        const selectedAnalyses = project.analyses.filter(a =>
          project.selectedIndices.includes(a.index)
        );

        const scriptResult = await serverGenerateScript(
          project.id,
          selectedAnalyses,
          project.listing!,
          project.targetDuration,
        );

        if (!scriptResult.success || !scriptResult.script) {
          updateProject({ status: 'analyzed', error: scriptResult.error || 'Script generation failed' });
          toast.error(scriptResult.error || 'Script generation failed');
          return;
        }

        updateProject({ script: scriptResult.script, status: 'script_ready' });
        await refreshCredits();

        // Generate voiceover for the preview
        updateProject({ status: 'generating_voiceover' });
        toast.info('Generating voiceover...');

        const selectedSegments = scriptResult.script.segments.filter(segment =>
          project.selectedIndices.includes(segment.image_index)
        );
        const fullScript = selectedSegments.map(s => s.voiceover.trim()).join('... ');

        const voiceResult = await generateListingVoiceover(project.id, fullScript, project.voiceId, project.voiceSpeed);

        if (!voiceResult.success || !voiceResult.audio_url) {
          updateProject({ status: 'script_ready', error: voiceResult.error || 'Voiceover generation failed' });
          toast.error(voiceResult.error || 'Voiceover generation failed');
          return;
        }

        updateProject({
          voiceover: { url: voiceResult.audio_url, duration: voiceResult.duration || 0 },
          status: 'script_ready',
        });
        await refreshCredits();
        toast.success('Script & voiceover ready — review below, then open the studio');
        return; // Phase 1: show preview in output panel, don't open editor yet
      }

      // Phase 2: Script exists but voiceover missing (e.g. after script regeneration)
      // Auto-generate voiceover and then open editor
      if (!project.voiceover) {
        updateProject({ status: 'generating_voiceover', error: null });
        toast.info('Generating voiceover...');

        const selectedSegments = project.script.segments.filter(segment =>
          project.selectedIndices.includes(segment.image_index)
        );
        const fullScript = selectedSegments.map(s => s.voiceover.trim()).join('... ');

        const voiceResult = await generateListingVoiceover(project.id, fullScript, project.voiceId, project.voiceSpeed);

        if (!voiceResult.success || !voiceResult.audio_url) {
          updateProject({ status: 'script_ready', error: voiceResult.error || 'Voiceover generation failed' });
          toast.error(voiceResult.error || 'Voiceover generation failed');
          return;
        }

        updateProject({
          voiceover: { url: voiceResult.audio_url, duration: voiceResult.duration || 0 },
          status: 'script_ready',
        });
        await refreshCredits();
      }
      // Fall through to open editor (Phase 2)
    }

    // Open editor
    updateProject({ status: 'idle' });

    const editorBaseUrl = process.env.NEXT_PUBLIC_VIDEO_EDITOR_URL || 'https://editor.bluefx.net';
    const apiBaseUrl = window.location.origin;
    const selectedParam = project.selectedIndices.join(',');
    const editorUrl = `${editorBaseUrl}/?listingId=${project.id}&userId=${userId}&apiUrl=${encodeURIComponent(apiBaseUrl)}&aspectRatio=${project.aspectRatio}&selected=${selectedParam}&fresh=true`;

    console.log('🎬 Opening ReelEstate in editor:', editorUrl);

    // Use anchor click — immune to popup blockers unlike window.open
    const link = document.createElement('a');
    link.href = editorUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Opening video editor...');

    // Persist settings + delete stale composition (fire-and-forget)
    deleteSavedComposition(project.id);
    updateListing(project.id, {
      selected_indices: project.selectedIndices,
      aspect_ratio: project.aspectRatio,
      target_duration: project.targetDuration,
      music_url: project.musicUrl || null,
      music_volume: project.musicVolume,
      intro_text: project.introText || null,
    } as any);
  }, [project.id, userId, project.selectedIndices, project.aspectRatio, project.targetDuration, project.musicUrl, project.musicVolume, project.introText, project.voiceoverEnabled, project.script, project.voiceover, project.analyses, project.listing, project.voiceId, project.voiceSpeed, updateProject, refreshCredits]);

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
    updateProject({ selectedIndices: indices, script: null, voiceover: null });
  }, [updateProject]);

  const updateScriptSegment = useCallback((index: number, voiceover: string) => {
    if (!project.script) return;
    const segments = project.script.segments.map(s =>
      s.index === index ? { ...s, voiceover } : s
    );
    updateProject({
      script: { ...project.script, segments },
      voiceover: null, // Clear stale voiceover — text changed
    });
  }, [project.script, updateProject]);

  const deleteScriptSegment = useCallback((index: number) => {
    if (!project.script) return;
    const filtered = project.script.segments
      .filter(s => s.index !== index)
      .map((s, i) => ({ ...s, index: i }));
    const totalDuration = filtered.reduce((acc, s) => acc + s.duration_seconds, 0);
    updateProject({
      script: { segments: filtered, total_duration_seconds: totalDuration },
    });
  }, [project.script, updateProject]);

  const moveScriptSegment = useCallback((index: number, direction: 'up' | 'down') => {
    if (!project.script) return;
    const segments = [...project.script.segments];
    const currentPos = segments.findIndex(s => s.index === index);
    const targetPos = direction === 'up' ? currentPos - 1 : currentPos + 1;
    if (targetPos < 0 || targetPos >= segments.length) return;
    [segments[currentPos], segments[targetPos]] = [segments[targetPos], segments[currentPos]];
    const reindexed = segments.map((s, i) => ({ ...s, index: i }));
    updateProject({
      script: { ...project.script, segments: reindexed },
    });
  }, [project.script, updateProject]);

  const setAspectRatio = useCallback((ratio: '16:9' | '9:16') => {
    updateProject({ aspectRatio: ratio });
    if (project.id) {
      updateListing(project.id, { aspect_ratio: ratio });
      deleteSavedComposition(project.id); // Force fresh editor load with new aspect ratio
    }
  }, [updateProject, project.id]);

  const setTargetDuration = useCallback((duration: TargetDuration) => {
    updateProject({ targetDuration: duration, script: null, voiceover: null });
  }, [updateProject]);

  const setVoiceId = useCallback((voiceId: string) => {
    updateProject({ voiceId, voiceover: null });
  }, [updateProject]);

  const setVoiceSpeed = useCallback((voiceSpeed: number) => {
    updateProject({ voiceSpeed });
  }, [updateProject]);

  // ─── Music & Style (simplified flow) ──────────
  const setMusicTrack = useCallback((trackId: string | null, url: string | null) => {
    updateProject({ musicTrackId: trackId, musicUrl: url });
    if (project.id) {
      updateListing(project.id, { music_url: url });
    }
  }, [updateProject, project.id]);

  const setMusicVolume = useCallback((volume: number) => {
    updateProject({ musicVolume: volume });
    if (project.id) {
      updateListing(project.id, { music_volume: volume });
    }
  }, [updateProject, project.id]);

  const setIntroText = useCallback((text: string | null) => {
    updateProject({ introText: text });
    if (project.id) {
      updateListing(project.id, { intro_text: text });
    }
  }, [updateProject, project.id]);

  const setVoiceoverEnabled = useCallback((enabled: boolean) => {
    updateProject({ voiceoverEnabled: enabled });
  }, [updateProject]);

  const setSpeedRamps = useCallback((enabled: boolean) => {
    updateProject({ speedRamps: enabled });
  }, [updateProject]);

  // ─── Direct Render (simplified flow) ──────────
  const renderVideo = useCallback(async (animate: boolean = true) => {
    if (!project.id) return;
    updateProject({ status: 'rendering', renderProgress: 0, error: null, finalVideoUrl: null });

    try {
      let mediaUrls: Record<number, string> | undefined;

      // Step A: If animate is ON, generate AI video clips first
      if (animate && project.selectedIndices.length > 0) {
        updateProject({ status: 'generating_clips' });

        // Build clip requests from selected photos + AI camera motions
        const clipRequests = project.selectedIndices.map((photoIdx, i) => {
          const analysis = project.analyses.find(a => a.index === photoIdx);
          // Keep camera motion simple — dolly_in is safest, only allow a few variations
          const safeMotions = ['dolly_in', 'dolly_out', 'static'];
          const rawMotion = analysis?.camera_motion || 'dolly_in';
          const camera_motion = safeMotions.includes(rawMotion) ? rawMotion : 'dolly_in';

          return {
            index: i,
            photo_url: project.photos[photoIdx],
            camera_motion: camera_motion as any,
            prompt: analysis?.description || 'Cinematic real estate property walkthrough',
            aspect_ratio: project.aspectRatio,
          };
        });

        // Generate all clips
        const clipResult = await serverGenerateClips(project.id, clipRequests);
        if (!clipResult.success || clipResult.clips.length === 0) {
          updateProject({ status: 'idle', error: clipResult.error || 'Failed to generate clips' });
          toast.error(clipResult.error || 'Failed to animate photos');
          return;
        }

        // Poll until all clips complete
        let clips = clipResult.clips;
        const maxAttempts = 120; // 6 min max (120 × 3s)
        let attempts = 0;

        while (attempts < maxAttempts) {
          const pending = clips.filter(c => c.status !== 'succeeded' && c.status !== 'failed');
          if (pending.length === 0) break;

          await new Promise(r => setTimeout(r, 3000));
          attempts++;

          // Poll each pending clip
          const updated = await Promise.all(
            clips.map(async (clip) => {
              if (clip.status === 'succeeded' || clip.status === 'failed') return clip;
              return pollClipStatus(clip.prediction_id, clip.index);
            })
          );
          clips = updated;

          const done = clips.filter(c => c.status === 'succeeded').length;
          const total = clips.length;
          updateProject({ renderProgress: Math.round((done / total) * 50) }); // 0-50% for clips
        }

        // Collect video URLs from succeeded clips
        const succeededClips = clips.filter(c => c.status === 'succeeded' && c.video_url);
        if (succeededClips.length === 0) {
          updateProject({ status: 'idle', error: 'All clip animations failed' });
          toast.error('Failed to animate photos');
          return;
        }

        mediaUrls = {};
        succeededClips.forEach(clip => {
          mediaUrls![clip.index] = clip.video_url!;
        });

        toast.success(`${succeededClips.length}/${clips.length} photos animated`);
      }

      // Step B: Render final video
      console.log('🎬 Rendering with mediaUrls:', mediaUrls);
      console.log('🎵 Music:', project.musicUrl);
      console.log('📝 Intro:', project.introText);
      updateProject({ status: 'rendering', renderProgress: 50 });

      const result = await renderListingVideo(project.id, {
        mediaUrls,
        musicUrl: project.musicUrl,
        musicVolume: project.musicVolume,
        introText: project.introText,
      });

      if (!result.success) {
        updateProject({ status: 'idle', error: result.error || 'Render failed' });
        toast.error(result.error || 'Render failed');
        return;
      }

      updateProject({ renderId: result.renderId || null });

      // Poll for render progress (50-100%)
      const pollInterval = setInterval(async () => {
        const progress = await checkListingRenderProgress(project.id!);
        console.log('📊 Render poll:', progress.status, progress.progress, progress.error);
        if (!progress.success) {
          console.error('❌ Render poll failed:', progress.error);
          return;
        }

        const renderPct = Math.round(progress.progress * 100);
        updateProject({ renderProgress: 50 + Math.round(renderPct / 2) }); // 50-100%

        if (progress.status === 'completed' && progress.videoUrl) {
          clearInterval(pollInterval);
          updateProject({
            status: 'completed',
            finalVideoUrl: progress.videoUrl,
            renderProgress: 100,
          });
          toast.success('Video created!');
        } else if (progress.status === 'failed') {
          clearInterval(pollInterval);
          updateProject({ status: 'idle', error: progress.error || 'Render failed' });
          toast.error(progress.error || 'Render failed');
        }
      }, 3000);
    } catch (error) {
      console.error('renderVideo error:', error);
      updateProject({ status: 'idle', error: 'Failed to create video' });
      toast.error('Failed to create video');
    }
  }, [project.id, project.selectedIndices, project.analyses, project.photos, project.aspectRatio, project.musicUrl, project.musicVolume, project.introText, updateProject]);

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
      photoIndex,
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
    // Reset active statuses to idle (don't resume stuck renders)
    const rawStatus = listing.status as ListingStatus;
    const safeStatus: ListingStatus = ['rendering', 'generating_clips', 'assembling'].includes(rawStatus)
      ? (listing.final_video_url ? 'completed' : 'idle')
      : rawStatus;

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
      renderProgress: listing.final_video_url ? 100 : null,
      finalVideoUrl: listing.final_video_url,
      status: safeStatus,
      error: null,
      aspectRatio: (listing.aspect_ratio as '16:9' | '9:16') || '16:9',
      targetDuration: (listing.target_duration as TargetDuration) || 30,
      voiceId: listing.voice_id || 'Friendly_Person',
      voiceSpeed: 1.0,
      creditsUsed: listing.total_credits_used || 0,
      // Voiceover
      voiceoverEnabled: true,
      // Music & style
      musicTrackId: null,
      musicUrl: (listing as any).music_url || null,
      musicVolume: (listing as any).music_volume || 0.3,
      introText: (listing as any).intro_text || listing.listing_data?.address || null,
      speedRamps: (listing as any).speed_ramps ?? true,
    });

    toast.success('Project loaded');
  }, []);

  // ─── Derived State ─────────────────────────────
  const isWorking = ['scraping', 'analyzing', 'scripting', 'generating_clips', 'generating_voiceover', 'rendering', 'assembling'].includes(project.status);

  return {
    project,
    userId,
    credits,
    isLoadingCredits,
    startProject,
    analyzePhotos,
    generateScript,
    generateVoiceover,
    regenerateScript,
    regenerateVoiceover,
    openInEditor,
    generateClips,
    regenerateClip,
    pollClips,
    setSelectedIndices,
    updateScriptSegment,
    deleteScriptSegment,
    moveScriptSegment,
    setAspectRatio,
    setTargetDuration,
    setVoiceId,
    setVoiceSpeed,
    cleanupPhotos,
    cleanupInlinePhoto,
    cleaningIndices,
    cleanupResults,
    isCleaningUp,
    cleanupQueue,
    addToCleanupQueue,
    removeFromCleanupQueue,
    clearCleanupQueue,
    setVoiceoverEnabled,
    // Music & style (simplified flow)
    setMusicTrack,
    setMusicVolume,
    setIntroText,
    setSpeedRamps,
    renderVideo,
    listings,
    isLoadingHistory,
    loadHistory,
    loadProject,
    isWorking,
  };
}
