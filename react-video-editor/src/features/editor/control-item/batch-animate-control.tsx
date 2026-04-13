import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { dispatch } from "@designcombo/events";
import { ADD_VIDEO } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { IImage, ITrackItem } from "@designcombo/types";
import {
	Film,
	Loader2,
	X,
	Image as ImageIcon,
	Check,
	AlertCircle,
} from "lucide-react";
import {
	useBatchAnimateState,
	type AnimationItem,
} from "../store/use-batch-animate-state";
import { stateManager } from "../store/state-manager-instance";
import useStore from "../store/use-store";

interface BatchAnimateControlProps {
	selectedItems: (ITrackItem & IImage)[];
}

const CAMERA_MOTIONS = [
	{ value: "Slow smooth dolly in on rails. Stabilized camera, no handheld shake, no jitter.", label: "Push In" },
	{ value: "Slow smooth dolly out on rails. Stabilized camera, no handheld shake, no jitter.", label: "Pull Out" },
	{ value: "Slow smooth pan left on rails. Stabilized camera, no handheld shake, no jitter.", label: "Pan Left" },
	{ value: "Slow smooth pan right on rails. Stabilized camera, no handheld shake, no jitter.", label: "Pan Right" },
	{ value: "Slow smooth tilt up on rails. Stabilized camera, no handheld shake, no jitter.", label: "Tilt Up" },
	{ value: "Slow smooth tilt down on rails. Stabilized camera, no handheld shake, no jitter.", label: "Tilt Down" },
	{ value: "Nearly static shot with very subtle movement. Locked camera on tripod, no vibration.", label: "Nearly Static" },
];

const CREDITS_PER_SECOND = 1;

const DURATIONS = [
	{ value: "6", label: "6 seconds" },
	{ value: "8", label: "8 seconds" },
	{ value: "10", label: "10 seconds" },
];

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

// Reorder tracks so caption tracks are at the end of the tracks array
// In Remotion, items rendered last appear on top — so captions need to be last
function reorderCaptionsToTop() {
	try {
		const state = stateManager.getState();
		const { tracks, trackItemsMap } = state;

		const captionTrackIds = new Set<string>();
		tracks.forEach((track) => {
			track.items.forEach((itemId) => {
				const item = trackItemsMap[itemId];
				if (!item) return;
				if (
					(item.type === "text" &&
						(item.details as any)?.isCaptionTrack) ||
					item.type === "caption"
				) {
					captionTrackIds.add(track.id);
				}
			});
		});

		if (captionTrackIds.size === 0) return;

		const captionTracks = tracks.filter((t) =>
			captionTrackIds.has(t.id),
		);
		const otherTracks = tracks.filter(
			(t) => !captionTrackIds.has(t.id),
		);

		stateManager.updateState({
			tracks: [...otherTracks, ...captionTracks],
		});
	} catch (err) {
		console.warn("⚠️ Failed to reorder caption tracks:", err);
	}
}

// ─── Ordered Dispatch Queue ──────────────────────────────────
// Dispatches ADD_VIDEO in original image order, regardless of completion order

async function tryDispatchInOrder(
	settings: { cameraMotion: string; duration: string; prompt: string },
) {
	const store = useBatchAnimateState.getState;

	// Acquire lock to prevent concurrent dispatch attempts
	while (store().addingVideo) {
		await sleep(300);
	}
	store().actions.setAddingVideo(true);

	try {
		// Dispatch all consecutive ready items starting from nextDispatchIndex
		while (true) {
			const { items, nextDispatchIndex, cancelled } = store();
			if (cancelled) break;
			if (nextDispatchIndex >= items.length) break;

			const item = items[nextDispatchIndex];

			// Skip failed items — advance past them
			if (item.status === "failed") {
				store().actions.advanceDispatchIndex();
				continue;
			}

			// If this item is ready (video generated), dispatch it
			if (item.status === "ready" && item.videoUrl) {
				await dispatchOneVideo(item, settings);
				store().actions.advanceDispatchIndex();
				continue;
			}

			// Otherwise this item isn't ready yet — stop and wait
			break;
		}
	} finally {
		store().actions.setAddingVideo(false);
	}
}

async function dispatchOneVideo(
	item: AnimationItem,
	settings: { cameraMotion: string; duration: string; prompt: string },
) {
	const { actions } = useBatchAnimateState.getState();
	const newVideoId = generateId();
	const durationMs = parseInt(settings.duration) * 1000;

	console.log(`🎬 Batch animate: adding video for ${item.itemId}`, {
		videoUrl: item.videoUrl,
		newVideoId,
	});

	dispatch(ADD_VIDEO, {
		payload: {
			id: newVideoId,
			details: { src: item.videoUrl },
			display: {
				from: item.originalFrom,
				to: item.originalFrom + durationMs,
			},
			metadata: {
				animatedFrom: item.imageSrc,
				cameraMotion: settings.cameraMotion,
			},
		},
		options: {
			resourceId: "main",
			scaleMode: "fit",
		},
	});

	// Wait for video to appear in state manager
	let waitAttempts = 0;
	const maxWaitAttempts = 60; // 30 seconds max
	while (
		!stateManager.getState().trackItemsMap[newVideoId] &&
		waitAttempts < maxWaitAttempts
	) {
		await sleep(500);
		waitAttempts++;
	}

	if (stateManager.getState().trackItemsMap[newVideoId]) {
		console.log(`✅ Batch animate: video ${newVideoId} confirmed in state after ${waitAttempts * 500}ms`);
	} else {
		console.warn(`⚠️ Batch animate: video ${newVideoId} NOT found in state after ${maxWaitAttempts * 500}ms, proceeding anyway`);
	}

	actions.updateItem(item.itemId, { status: "done" });
	console.log(`✅ Batch animate: done for ${item.itemId}`);
	(window as any).refreshEditorCredits?.();
}

// ─── Batch Processing Logic ──────────────────────────────────
// Runs independently of component lifecycle via global store

async function processBatchAnimations() {
	const store = useBatchAnimateState.getState();
	const { items, settings } = store;
	const apiUrl = getApiUrl();

	// Concurrency limiter: process max N at a time
	let activeCount = 0;
	let itemIndex = 0;

	const processNext = async (): Promise<void> => {
		while (itemIndex < items.length) {
			const currentStore = useBatchAnimateState.getState();
			if (currentStore.cancelled) return;

			if (activeCount >= MAX_CONCURRENT) {
				await sleep(1000);
				continue;
			}

			const item = items[itemIndex];
			itemIndex++;
			activeCount++;

			// Don't await — fire and continue to next
			processOneImage(item, settings, apiUrl).finally(() => {
				activeCount--;
			});
		}

		// Wait for remaining to finish
		while (activeCount > 0) {
			await sleep(500);
		}
	};

	await processNext();
}

async function processOneImage(
	item: AnimationItem,
	settings: { cameraMotion: string; duration: string; prompt: string },
	apiUrl: string,
) {
	const { actions } = useBatchAnimateState.getState();

	// Check if cancelled
	if (useBatchAnimateState.getState().cancelled) return;

	actions.updateItem(item.itemId, { status: "processing" });

	try {
		// 1. Create prediction
		const createRes = await fetch(
			`${apiUrl}/api/editor/animate-image`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					image_url: item.imageSrc,
					prompt: `${settings.cameraMotion} ${settings.prompt || "Smooth cinematic footage with subtle camera movement."}`,
					duration: parseInt(settings.duration),
					aspect_ratio: getCanvasAspectRatio(),
					user_id: getUserId(),
					listing_id: getListingId(),
				}),
			},
		);

		const createData = await createRes.json();

		if (!createData.success) {
			const msg = createData.remaining_credits !== undefined
				? `${createData.error} (${createData.remaining_credits} credits remaining)`
				: createData.error || "Failed to start animation";
			throw new Error(msg);
		}

		const predictionId = createData.prediction_id;
		actions.updateItem(item.itemId, {
			status: "polling",
			predictionId,
		});

		// 2. Poll for completion (include listing context for DB persistence)
		const listingId = getListingId();
		let pollUrl = `${apiUrl}/api/editor/animate-image?predictionId=${predictionId}`;
		if (listingId) pollUrl += `&listingId=${listingId}`;
		if (item.imageSrc) pollUrl += `&imageUrl=${encodeURIComponent(item.imageSrc)}`;

		while (true) {
			if (useBatchAnimateState.getState().cancelled) return;

			await sleep(5000);

			const pollRes = await fetch(pollUrl);
			const pollData = await pollRes.json();

			if (pollData.status === "succeeded" && pollData.video_url) {
				// Mark as ready — video generated, waiting for ordered dispatch
				actions.updateItem(item.itemId, {
					videoUrl: pollData.video_url,
					status: "ready",
				});

				// Try to dispatch this and any consecutive ready items in order
				await tryDispatchInOrder(settings);

				return;
			} else if (
				pollData.status === "failed" ||
				pollData.status === "canceled"
			) {
				throw new Error(pollData.error || "Animation failed");
			}
			// Otherwise keep polling
		}
	} catch (err) {
		actions.updateItem(item.itemId, {
			status: "failed",
			error: err instanceof Error ? err.message : "Animation failed",
		});
		console.error(
			`❌ Batch animate failed for ${item.itemId}:`,
			err,
		);

		// A failed item might be blocking the dispatch queue — try to advance past it
		await tryDispatchInOrder(settings);
	}
}

// ─── Component ───────────────────────────────────────────────

export function BatchAnimateControl({
	selectedItems,
}: BatchAnimateControlProps) {
	const [cameraMotion, setCameraMotion] = useState("Slow smooth dolly in on rails. Stabilized camera, no handheld shake, no jitter.");
	const [duration, setDuration] = useState("6");
	const [prompt, setPrompt] = useState("");

	const { isActive, items, actions } = useBatchAnimateState();

	const imageItems = selectedItems.filter(
		(item) => item.type === "image" && item.details?.src,
	);

	const doneCount = items.filter((i) => i.status === "done").length;
	const failedCount = items.filter((i) => i.status === "failed").length;
	const totalCount = items.length;
	const progressPercent =
		totalCount > 0 ? ((doneCount + failedCount) / totalCount) * 100 : 0;

	const handleAnimateAll = useCallback(() => {
		if (imageItems.length === 0) return;

		const animationItems: AnimationItem[] = imageItems.map((item) => ({
			itemId: item.id,
			imageSrc: item.details?.src as string,
			originalFrom: item.display?.from || 0,
			status: "pending" as const,
		}));

		actions.startBatch(animationItems, {
			cameraMotion,
			duration,
			prompt,
		});

		// Fire off processing (runs independently via global store)
		processBatchAnimations();
	}, [imageItems, cameraMotion, duration, prompt, actions]);

	if (imageItems.length === 0 && !isActive) return null;

	return (
		<Card className="p-4 space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Film className="h-4 w-4 text-blue-500" />
					<h3 className="font-semibold text-sm">Animate All</h3>
				</div>
				<div className="flex items-center gap-1 text-xs text-muted-foreground">
					<ImageIcon className="h-3 w-3" />
					<span>
						{isActive ? `${totalCount} images` : `${imageItems.length} images`}
					</span>
				</div>
			</div>

			{/* Configuration (only when not active) */}
			{!isActive && (
				<div className="space-y-3">
					<div className="space-y-2">
						<Label
							htmlFor="batch-camera-motion"
							className="text-xs"
						>
							Camera Motion
						</Label>
						<Select
							value={cameraMotion}
							onValueChange={setCameraMotion}
						>
							<SelectTrigger
								id="batch-camera-motion"
								className="h-8"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{CAMERA_MOTIONS.map((motion) => (
									<SelectItem
										key={motion.value}
										value={motion.value}
									>
										{motion.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label
							htmlFor="batch-anim-duration"
							className="text-xs"
						>
							Duration
						</Label>
						<Select
							value={duration}
							onValueChange={setDuration}
						>
							<SelectTrigger
								id="batch-anim-duration"
								className="h-8"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DURATIONS.map((d) => (
									<SelectItem
										key={d.value}
										value={d.value}
									>
										{d.label} ({parseInt(d.value) * CREDITS_PER_SECOND} credits)
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label
							htmlFor="batch-anim-prompt"
							className="text-xs"
						>
							Prompt (optional)
						</Label>
						<Textarea
							id="batch-anim-prompt"
							placeholder="Describe the motion or scene..."
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							className="h-16 text-xs resize-none"
						/>
					</div>
				</div>
			)}

			{/* Progress (when active) */}
			{isActive && (
				<div className="space-y-3">
					{/* Progress bar */}
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<Loader2 className="h-3 w-3 animate-spin" />
							<span>
								{doneCount}/{totalCount} animated
								{failedCount > 0 &&
									` (${failedCount} failed)`}
							</span>
						</div>
						<div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
							<div
								className="h-full bg-blue-500 rounded-full transition-all duration-500"
								style={{ width: `${progressPercent}%` }}
							/>
						</div>
					</div>

					{/* Per-item status list */}
					<div className="space-y-1 max-h-32 overflow-y-auto">
						{items.map((item, idx) => (
							<div
								key={item.itemId}
								className="flex items-center gap-2 text-xs"
							>
								{item.status === "done" ? (
									<Check className="h-3 w-3 text-green-500 shrink-0" />
								) : item.status === "failed" ? (
									<AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
								) : item.status === "ready" ? (
									<div className="h-3 w-3 rounded-full bg-blue-400 shrink-0" />
								) : item.status === "pending" ? (
									<div className="h-3 w-3 rounded-full border border-muted-foreground/30 shrink-0" />
								) : (
									<Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
								)}
								<span className="truncate text-muted-foreground">
									Image {idx + 1}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Completed state */}
			{!isActive && items.length > 0 && doneCount > 0 && (
				<div className="flex items-center gap-2 text-xs text-green-500">
					<Check className="h-3 w-3" />
					<span>
						{doneCount === totalCount
							? `All ${totalCount} images animated`
							: `${doneCount}/${totalCount} animated`}
					</span>
				</div>
			)}

			{/* Buttons */}
			{isActive ? (
				<Button
					onClick={actions.cancelAll}
					variant="destructive"
					size="sm"
					className="w-full"
				>
					<X className="h-4 w-4 mr-2" />
					Cancel
				</Button>
			) : (
				<Button
					onClick={handleAnimateAll}
					disabled={imageItems.length === 0}
					className="w-full"
					size="sm"
				>
					Animate All ({imageItems.length * parseInt(duration) * CREDITS_PER_SECOND} credits)
				</Button>
			)}

			{!isActive && (
				<p className="text-xs text-muted-foreground">
					Turns all {imageItems.length} images into video clips
					(max {MAX_CONCURRENT} at a time). Takes 1-3 minutes per
					image. Costs 1 credit per second.
				</p>
			)}
		</Card>
	);
}
