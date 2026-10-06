'use client';

import { useCallback } from 'react';
import type { FreeVideoEvent } from '@/types/free-video';

const ENDPOINT = '/api/free-video/event';
const VISITOR_KEY = 'fv_vid';
/** The same shape the API accepts for ref (FREE_VIDEO_REF_PATTERN), at least 1 character. */
const REF_PATTERN = /^[\w.-]{1,60}$/;

/** Used when localStorage is missing or blocked (private mode): one id per page load. */
let memoryVisitorId: string | null = null;

function newVisitorId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // An old browser without randomUUID: fall through.
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

/** The visitor id kept in localStorage 'fv_vid'. Every storage read and write is guarded. */
function visitorId(): string {
  try {
    const saved = window.localStorage.getItem(VISITOR_KEY);
    if (saved && saved.length <= 40) return saved;
    const id = newVisitorId();
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    memoryVisitorId ??= newVisitorId();
    return memoryVisitorId;
  }
}

/** The newsletter or campaign tag of the current address (?ref= or ?utm_campaign=), when it is a clean one. */
export function refTagFromUrl(): string | undefined {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = (params.get('ref') || params.get('utm_campaign') || '').trim();
    return REF_PATTERN.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

interface FreeVideoBeaconOptions {
  /** No events at all (the dev preview page). */
  disabled?: boolean;
}

/**
 * Fire-and-forget page events for the free video ad funnel (landing_view, form_start, video_play,
 * video_complete, download). Sends navigator.sendBeacon to /api/free-video/event, with fetch
 * keepalive as the fallback. Never throws and never waits; a failed event is simply lost.
 */
export function useFreeVideoBeacon(token?: string, { disabled = false }: FreeVideoBeaconOptions = {}) {
  return useCallback(
    (event: FreeVideoEvent) => {
      if (disabled || typeof window === 'undefined') return;
      try {
        const ref = refTagFromUrl();
        const body = JSON.stringify({ e: event, v: visitorId(), ...(token ? { t: token } : {}), ...(ref ? { ref } : {}) });
        if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
        void fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
          credentials: 'same-origin',
        }).catch(() => undefined);
      } catch {
        // Measurement must never break the page.
      }
    },
    [token, disabled]
  );
}
