"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Film, Sparkles, X } from "lucide-react";
import useStore from "../store/use-store";
import { IImage, ITrackItem } from "@designcombo/types";
import { useBatchAnimateState } from "../store/use-batch-animate-state";
import { dispatch as editorDispatch } from "@designcombo/events";
import { ADD_VIDEO } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { stateManager } from "../store/state-manager-instance";

const MAX_CONCURRENT = 3;

function getApiUrl(): string {
  const urlParams = new URLSearchParams(window.location.search);
  return (
    urlParams.get("apiUrl") ||
    process.env.NEXT_PUBLIC_API_URL ||
    window.location.origin
  );
}

function getUserId(): string | null {
  return new URLSearchParams(window.location.search).get("userId");
}

function getListingId(): string | null {
  return new URLSearchParams(window.location.search).get("listingId");
}

function getCanvasAspectRatio(): string {
  const { size } = useStore.getState();
  if (size.height > size.width) return "9:16";
  return "16:9";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ensure text overlays (intro/outro/captions) render on top of new video tracks
function reorderTextTracksToTop() {
  try {
    const state = stateManager.getState();
    const { tracks, trackItemsMap } = state;
    const textTrackIds = new Set<string>();
    tracks.forEach((track) => {
      track.items.forEach((itemId) => {
        const item = trackItemsMap[itemId];
        if (!item) return;
        if (item.type === "text" || item.type === "caption" ||
            (item.metadata as any)?.introOverlay || (item.metadata as any)?.outroOverlay) {
          textTrackIds.add(track.id);
        }
      });
    });
    if (textTrackIds.size === 0) return;
    const textTracks = tracks.filter((t) => textTrackIds.has(t.id));
    const otherTracks = tracks.filter((t) => !textTrackIds.has(t.id));
    stateManager.updateState({ tracks: [...otherTracks, ...textTracks] });
  } catch (err) {
    console.warn("⚠️ Failed to reorder text tracks:", err);
  }
}

/**
 * Floating banner that appears above the editor scene for ReelEstate projects.
 * Prompts user to animate all photos into cinematic video clips.
 */
export function AnimateBanner() {
  const { trackItemsMap } = useStore();
  const [dismissed, setDismissed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // Check if this is a ReelEstate project
  const isReelEstate =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("listingId");

  // Count image items on timeline (candidates for animation)
  const imageItems = Object.values(trackItemsMap).filter(
    (item) => item.type === "image",
  ) as (ITrackItem & IImage)[];

  // Don't show if:
  // - Not a ReelEstate project
  // - No images to animate
  // - Banner was dismissed
  // - Already animating
  if (!isReelEstate || imageItems.length === 0 || dismissed) return null;

  const creditCost = imageItems.length * 6; // 6s × 1 credit/s per image

  const handleAnimateAll = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setProgress({ done: 0, total: imageItems.length });

    const apiUrl = getApiUrl();
    const userId = getUserId();
    const aspectRatio = getCanvasAspectRatio();
    const duration = "6";
    const prompt = "Slow smooth dolly in on rails. Stabilized camera, no handheld shake, no jitter. Professional real estate cinematography.";

    let completed = 0;
    let activeCount = 0;
    let itemIndex = 0;

    const processOne = async (item: ITrackItem & IImage) => {
      try {
        const imageSrc = item.details?.src;
        if (!imageSrc) return;

        console.log(`🎬 Animating photo ${completed + 1}/${imageItems.length}: ${imageSrc.substring(0, 60)}...`);

        // 1. Create prediction
        const listingId = getListingId();
        const createRes = await fetch(`${apiUrl}/api/editor/animate-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: imageSrc,
            duration: parseInt(duration),
            prompt,
            aspect_ratio: aspectRatio,
            user_id: userId,
            listing_id: listingId,
          }),
        });

        const createData = await createRes.json();
        if (!createData.success || !createData.prediction_id) {
          console.error(`❌ Failed to start animation for image:`, createData.error);
          return;
        }

        const predictionId = createData.prediction_id;

        // 2. Poll for completion
        let videoUrl: string | null = null;
        let pollUrl = `${apiUrl}/api/editor/animate-image?predictionId=${predictionId}&userId=${userId}`;
        if (listingId) pollUrl += `&listingId=${listingId}`;
        if (imageSrc) pollUrl += `&imageUrl=${encodeURIComponent(imageSrc)}`;
        for (let attempt = 0; attempt < 120; attempt++) {
          await sleep(5000);
          const pollRes = await fetch(pollUrl);
          const pollData = await pollRes.json();

          if (pollData.status === "succeeded" && pollData.video_url) {
            videoUrl = pollData.video_url;
            break;
          }
          if (pollData.status === "failed") {
            console.error(`❌ Animation failed for image:`, pollData.error);
            return;
          }
        }

        if (!videoUrl) {
          console.error("❌ Animation timed out");
          return;
        }

        // 3. Replace image with video on the timeline
        const newVideoId = generateId();
        const durationMs = parseInt(duration) * 1000;
        const originalFrom = item.display?.from || 0;
        const itemToDelete = item.id;

        // Add the video first
        editorDispatch(ADD_VIDEO, {
          payload: {
            id: newVideoId,
            details: { src: videoUrl },
            display: {
              from: originalFrom,
              to: originalFrom + durationMs,
            },
            metadata: {
              animatedFrom: imageSrc,
            },
          },
          options: {
            resourceId: "main",
            scaleMode: "fit",
          },
        });

        // Keep the original image for re-generation
        await sleep(300);

        completed++;
        setProgress({ done: completed, total: imageItems.length });
        console.log(`✅ Animated ${completed}/${imageItems.length}`);
      } catch (err) {
        console.error("❌ Animation error:", err);
      }
    };

    // Process with concurrency limit
    const promises: Promise<void>[] = [];
    for (const item of imageItems) {
      while (activeCount >= MAX_CONCURRENT) {
        await sleep(1000);
      }
      activeCount++;
      const p = processOne(item).finally(() => { activeCount--; });
      promises.push(p);
    }
    await Promise.all(promises);

    setIsAnimating(false);
    setDismissed(true);
    console.log(`🎉 All ${completed} photos animated!`);
    (window as any).refreshEditorCredits?.();
  };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600/95 to-purple-600/95 backdrop-blur-sm shadow-lg shadow-blue-500/20 border border-white/10">
        <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />

        {isAnimating ? (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm font-medium text-white">
              Animating photos... {progress.done}/{progress.total}
            </span>
            <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <span className="text-sm font-medium text-white whitespace-nowrap">
              Bring your photos to life with AI animation
            </span>
            <Button
              size="sm"
              onClick={handleAnimateAll}
              className="bg-white text-blue-700 hover:bg-white/90 h-7 px-3 text-xs font-semibold gap-1.5"
            >
              <Film className="w-3.5 h-3.5" />
              Animate All ({creditCost} credits)
            </Button>
            <button
              onClick={() => setDismissed(true)}
              className="text-white/60 hover:text-white ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
