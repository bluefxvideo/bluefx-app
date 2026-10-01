"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Film, Sparkles, X } from "lucide-react";
import useStore from "../store/use-store";
import { IImage, ITrackItem } from "@designcombo/types";
import {
  clipSecondsForSlot,
  hasAnimatedClip,
  placeAnimatedClip,
} from "../utils/animated-clip";

const MAX_CONCURRENT = 3;
const PROMPT =
  "Slow smooth dolly in on rails. Stabilized camera, no handheld shake, no jitter. Professional real estate cinematography.";

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

/** What one "Animate All" run left behind, shown until the next run or until the banner is closed. */
interface RunResult {
  failed: number;
  total: number;
  refunded: number;
  /** The first reason a photo failed, e.g. not enough credits. */
  reason: string | null;
}

/**
 * Floating banner that appears above the editor scene for ReelEstate projects.
 * Turns every photo that has no clip yet into a video clip. Each clip takes its
 * photo's place on the timeline, so the video keeps its length and every room
 * still plays under its own line.
 */
export function AnimateBanner() {
  const { trackItemsMap } = useStore();
  const [dismissed, setDismissed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  // Check if this is a ReelEstate project
  const isReelEstate =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("listingId");

  const imageItems = Object.values(trackItemsMap).filter(
    (item) => item.type === "image",
  ) as (ITrackItem & IImage)[];

  // Photos that still play as a still picture, in timeline order
  const pending = imageItems
    .filter((item) => item.details?.src && !hasAnimatedClip(item, trackItemsMap))
    .sort((a, b) => a.display.from - b.display.from)
    .map((item) => ({
      item,
      seconds: clipSecondsForSlot(item.display.to - item.display.from),
    }));

  if (!isReelEstate || dismissed) return null;
  if (pending.length === 0 && !isAnimating && !lastRun) return null;

  // 1 credit per second of clip
  const creditCost = pending.reduce((sum, photo) => sum + photo.seconds, 0);

  const handleAnimateAll = async () => {
    if (isAnimating || pending.length === 0) return;
    const photos = pending;
    setIsAnimating(true);
    setLastRun(null);
    setProgress({ done: 0, total: photos.length });

    const apiUrl = getApiUrl();
    const userId = getUserId();
    const listingId = getListingId();
    const aspectRatio = getCanvasAspectRatio();

    let completed = 0;
    let failed = 0;
    let refunded = 0;
    let reason: string | null = null;
    let activeCount = 0;

    const fail = (message: string | undefined, creditsBack = 0) => {
      failed++;
      refunded += creditsBack;
      if (!reason && message) reason = message;
    };

    const processOne = async ({ item, seconds }: (typeof photos)[number]) => {
      try {
        const imageSrc = item.details.src;

        // 1. Create prediction
        const createRes = await fetch(`${apiUrl}/api/editor/animate-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: imageSrc,
            duration: seconds,
            prompt: PROMPT,
            aspect_ratio: aspectRatio,
            user_id: userId,
            listing_id: listingId,
          }),
        });

        const createData = await createRes.json();
        if (!createData.success || !createData.prediction_id) {
          console.error("❌ Failed to start animation for image:", createData.error);
          fail(createData.error);
          return;
        }

        const predictionId = createData.prediction_id;

        // 2. Poll for completion
        let videoUrl: string | null = null;
        let pollUrl = `${apiUrl}/api/editor/animate-image?predictionId=${predictionId}&userId=${userId}`;
        if (listingId) pollUrl += `&listingId=${listingId}`;
        pollUrl += `&imageUrl=${encodeURIComponent(imageSrc)}`;
        for (let attempt = 0; attempt < 120; attempt++) {
          await sleep(5000);
          const pollRes = await fetch(pollUrl);
          const pollData = await pollRes.json();

          if (pollData.status === "succeeded" && pollData.video_url) {
            videoUrl = pollData.video_url;
            break;
          }
          if (pollData.status === "failed") {
            console.error("❌ Animation failed for image:", pollData.error);
            fail(pollData.error, pollData.refunded_credits || 0);
            return;
          }
        }

        if (!videoUrl) {
          console.error("❌ Animation timed out");
          fail("The animation took too long.");
          return;
        }

        // 3. The clip takes the photo's place on the timeline
        const placed = await placeAnimatedClip(
          {
            itemId: item.id,
            src: imageSrc,
            from: item.display.from,
            to: item.display.to,
          },
          videoUrl,
          seconds,
        );
        if (!placed) {
          fail("A clip was made but could not be added to the timeline. Reload the page to see it.");
          return;
        }

        completed++;
        setProgress({ done: completed, total: photos.length });
        console.log(`✅ Animated ${completed}/${photos.length}`);
      } catch (err) {
        console.error("❌ Animation error:", err);
        fail(err instanceof Error ? err.message : undefined);
      }
    };

    // Process with concurrency limit
    const promises: Promise<void>[] = [];
    for (const photo of photos) {
      while (activeCount >= MAX_CONCURRENT) {
        await sleep(1000);
      }
      activeCount++;
      const p = processOne(photo).finally(() => { activeCount--; });
      promises.push(p);
    }
    await Promise.all(promises);

    setIsAnimating(false);
    setLastRun(failed > 0 ? { failed, total: photos.length, refunded, reason } : null);
    console.log(`🎉 ${completed} of ${photos.length} photos animated`);
    (window as any).refreshEditorCredits?.();
  };

  const allPhotos = pending.length === imageItems.length;

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
            <span className="text-sm font-medium text-white">
              {lastRun ? (
                <>
                  {lastRun.failed} of {lastRun.total} photos failed.
                  {lastRun.refunded > 0 && ` ${lastRun.refunded} credits were returned.`}
                  {lastRun.reason && <span className="block text-xs font-normal text-white/80">{lastRun.reason}</span>}
                </>
              ) : (
                <span className="whitespace-nowrap">Bring your photos to life with AI animation</span>
              )}
            </span>
            {pending.length > 0 && (
              <Button
                size="sm"
                onClick={handleAnimateAll}
                className="bg-white text-blue-700 hover:bg-white/90 h-7 px-3 text-xs font-semibold gap-1.5"
              >
                <Film className="w-3.5 h-3.5" />
                {allPhotos ? "Animate All" : `Animate ${pending.length} more`} ({creditCost} credits)
              </Button>
            )}
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
