'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getUserCredits } from '@/actions/credit-management';
import { createClient } from '@/app/supabase/client';
import {
  generateAgentComposite,
  startAgentAnimation,
  pollAgentAnimation,
} from '@/actions/tools/reelestate/agent-clone';
import {
  getAgentCloneGenerations,
  deleteAgentCloneGeneration,
} from '@/actions/database/agent-clone-database';
import type { AgentCloneShot, AgentCloneGenerationRow, AgentCloneCameraMotion, AgentCloneDuration } from '@/types/reelestate';

const MAX_SHOTS = 14;

export function useAgentClone() {
  const [agentPhotoUrl, setAgentPhotoUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [shots, setShots] = useState<AgentCloneShot[]>([]);
  const [credits, setCredits] = useState(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<AgentCloneGenerationRow[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep a ref to latest shots so async callbacks never read stale closures
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

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

  // ─── Shot Management ───────────────────────────

  const addShot = useCallback((backgroundUrl: string) => {
    if (shots.length >= MAX_SHOTS) {
      toast.error(`Maximum ${MAX_SHOTS} shots reached`);
      return null;
    }
    if (!agentPhotoUrl) {
      toast.error('Upload your photo first');
      return null;
    }

    const newShot: AgentCloneShot = {
      id: crypto.randomUUID(),
      generationId: null,
      agentPhotoUrl,
      backgroundUrl,
      compositeUrl: null,
      videoUrl: null,
      predictionId: null,
      status: 'idle',
      prompt: '',
      dialogue: '',
      action: '',
      cameraMotion: 'dolly_in',
      duration: 6,
      error: null,
    };

    setShots(prev => [...prev, newShot]);
    return newShot.id;
  }, [shots.length, agentPhotoUrl]);

  const updateShot = useCallback((id: string, updates: Partial<AgentCloneShot>) => {
    setShots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const removeShot = useCallback((id: string) => {
    setShots(prev => prev.filter(s => s.id !== id));
  }, []);

  // ─── Create + Generate Composite (NB2) ─────────
  // Combined function that creates a shot and immediately generates the composite.
  // Avoids the stale-closure bug where addShot + generateComposite in the same
  // event handler can't find the new shot because React hasn't re-rendered yet.

  const createAndGenerate = useCallback(async (backgroundUrl: string, prompt: string) => {
    if (!agentPhotoUrl) {
      toast.error('Upload your photo first');
      return;
    }

    const id = crypto.randomUUID();
    const newShot: AgentCloneShot = {
      id,
      generationId: null,
      agentPhotoUrl,
      backgroundUrl,
      compositeUrl: null,
      videoUrl: null,
      predictionId: null,
      status: 'compositing',
      prompt,
      dialogue: '',
      action: '',
      cameraMotion: 'dolly_in',
      duration: 6,
      error: null,
    };

    setShots(prev => [...prev, newShot]);

    const result = await generateAgentComposite(
      agentPhotoUrl,
      backgroundUrl,
      prompt,
      aspectRatio,
    );

    if (!result.success || !result.compositeUrl) {
      updateShot(id, { status: 'failed', error: result.error || 'Composite failed' });
      toast.error(result.error || 'Composite generation failed');
      return;
    }

    updateShot(id, {
      status: 'composite_ready',
      compositeUrl: result.compositeUrl,
      generationId: result.generationId || null,
    });
    await refreshCredits();
    toast.success('Composite generated');
  }, [agentPhotoUrl, aspectRatio, updateShot, refreshCredits]);

  // Regenerate an existing shot's composite (shot already exists in state)
  const regenerateComposite = useCallback(async (shotId: string, prompt: string) => {
    const shot = shotsRef.current.find(s => s.id === shotId);
    if (!shot) return;

    updateShot(shotId, { status: 'compositing', prompt, compositeUrl: null, videoUrl: null, error: null });

    const result = await generateAgentComposite(
      shot.agentPhotoUrl,
      shot.backgroundUrl,
      prompt,
      aspectRatio,
    );

    if (!result.success || !result.compositeUrl) {
      updateShot(shotId, { status: 'failed', error: result.error || 'Composite failed' });
      toast.error(result.error || 'Composite generation failed');
      return;
    }

    updateShot(shotId, {
      status: 'composite_ready',
      compositeUrl: result.compositeUrl,
      generationId: result.generationId || null,
    });
    await refreshCredits();
    toast.success('Composite generated');
  }, [aspectRatio, updateShot, refreshCredits]);

  // ─── Animate Shot (LTX) ────────────────────────

  const animateShot = useCallback(async (shotId: string) => {
    const shot = shotsRef.current.find(s => s.id === shotId);
    if (!shot || !shot.compositeUrl) return;

    updateShot(shotId, { status: 'animating', error: null, videoUrl: null });

    const result = await startAgentAnimation(
      shot.compositeUrl,
      shot.prompt,
      shot.dialogue,
      shot.action,
      shot.cameraMotion,
      shot.duration,
      aspectRatio,
      shot.generationId || undefined,
    );

    if (!result.success || !result.predictionId) {
      updateShot(shotId, { status: 'composite_ready', error: result.error || 'Animation failed' });
      toast.error(result.error || 'Animation failed to start');
      return;
    }

    updateShot(shotId, { predictionId: result.predictionId });
    await refreshCredits();
    toast.success('Animation started');
  }, [aspectRatio, updateShot, refreshCredits]);

  // ─── Poll Active Animations ────────────────────

  const pollActiveShots = useCallback(async () => {
    const animating = shotsRef.current.filter(s => s.status === 'animating' && s.predictionId);
    if (animating.length === 0) return;

    for (const shot of animating) {
      const result = await pollAgentAnimation(shot.predictionId!, shot.generationId || undefined);

      if (result.status === 'succeeded' && result.videoUrl) {
        updateShot(shot.id, { status: 'ready', videoUrl: result.videoUrl });
        toast.success('Video clip ready');
      } else if (result.status === 'failed') {
        // Revert to composite_ready so user can retry animation without regenerating
        updateShot(shot.id, { status: 'composite_ready', error: result.error || 'Animation failed' });
        toast.error(result.error || 'Animation failed');
      }
      // Otherwise still processing — do nothing
    }
  }, [updateShot]);

  // Auto-poll every 5s when animating
  useEffect(() => {
    const hasAnimating = shots.some(s => s.status === 'animating');

    if (hasAnimating && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(pollActiveShots, 5000);
    } else if (!hasAnimating && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [shots, pollActiveShots]);

  // ─── History ───────────────────────────────────

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    const result = await getAgentCloneGenerations();
    if (result.success && result.generations) {
      setHistory(result.generations);
    }
    setIsLoadingHistory(false);
  }, []);

  const deleteHistoryItem = useCallback(async (generationId: string) => {
    if (!userId) return;
    const result = await deleteAgentCloneGeneration(generationId, userId);
    if (result.success) {
      setHistory(prev => prev.filter(g => g.id !== generationId));
      toast.success('Generation deleted');
    } else {
      toast.error('Failed to delete');
    }
  }, [userId]);

  // ─── Derived State ─────────────────────────────

  const isWorking = shots.some(s => s.status === 'compositing' || s.status === 'animating');

  return {
    agentPhotoUrl,
    setAgentPhotoUrl,
    aspectRatio,
    setAspectRatio,
    shots,
    credits,
    isLoadingCredits,
    userId,
    addShot,
    updateShot,
    removeShot,
    createAndGenerate,
    regenerateComposite,
    animateShot,
    isWorking,
    history,
    isLoadingHistory,
    loadHistory,
    deleteHistoryItem,
  };
}
