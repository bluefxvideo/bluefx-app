import { useState, useCallback, useEffect } from "react";
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
import { Film, Loader2 } from "lucide-react";
import useStore from "../store/use-store";
import { stateManager } from "../store/state-manager-instance";

interface AnimateImageControlProps {
	trackItem: ITrackItem & IImage;
}

// ─── Module-level polling registry ──────────────────────────────────────
// Persists across mount/unmount so animations survive when user selects
// a different track item while multiple animations are in flight.

interface AnimationJob {
	predictionId: string;
	imageItemId: string;
	imageSrc: string;
	originalFrom: number;
	durationMs: number;
	cameraMotion: string;
	intervalId: NodeJS.Timeout;
	status: string;
	error: string | null;
}

const activeJobs = new Map<string, AnimationJob>();
// Listeners for UI re-render when a job updates
const jobListeners = new Set<() => void>();

function notifyJobListeners() {
	jobListeners.forEach((fn) => fn());
}

// Reorder tracks so text overlay tracks (captions + intro/outro) are at the end
// In Remotion, items rendered last appear on top — so text needs to be last
function reorderCaptionsToTop() {
	try {
		const state = stateManager.getState();
		const { tracks, trackItemsMap } = state;

		const textTrackIds = new Set<string>();
		tracks.forEach((track) => {
			track.items.forEach((itemId) => {
				const item = trackItemsMap[itemId];
				if (!item) return;
				// Match caption tracks AND intro/outro overlay tracks
				if (
					item.type === "text" ||
					item.type === "caption" ||
					(item.metadata as any)?.introOverlay ||
					(item.metadata as any)?.outroOverlay
				) {
					textTrackIds.add(track.id);
				}
			});
		});

		if (textTrackIds.size === 0) return;

		const textTracks = tracks.filter((t) => textTrackIds.has(t.id));
		const otherTracks = tracks.filter((t) => !textTrackIds.has(t.id));

		stateManager.updateState({
			tracks: [...otherTracks, ...textTracks],
		});
	} catch (err) {
		console.warn("⚠️ Failed to reorder text tracks:", err);
	}
}

// Queue to serialize delete operations so they don't interfere with each other
let deleteQueue: Promise<void> = Promise.resolve();

function queueDeleteAndReplace(job: AnimationJob, videoUrl: string) {
	deleteQueue = deleteQueue.then(
		() =>
			new Promise<void>((resolve) => {
				const newVideoId = generateId();

				// Step 1: Add the new video
				dispatch(ADD_VIDEO, {
					payload: {
						id: newVideoId,
						details: { src: videoUrl },
						display: {
							from: job.originalFrom,
							to: job.originalFrom + job.durationMs,
						},
						metadata: {
							animatedFrom: job.imageSrc,
							cameraMotion: job.cameraMotion,
						},
					},
					options: {
						resourceId: "main",
						scaleMode: "fit",
					},
				});

				// Step 2: Select the new video (keep the original image for re-generation)
				setTimeout(() => {
					useStore.setState({ activeIds: [newVideoId] });
					console.log(
						"✅ Image animated — video added, original image kept:",
						job.imageItemId,
					);
					(window as any).refreshEditorCredits?.();
					resolve();
				}, 300);
			}),
	);
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

/**
 * Start polling for a job. This runs at module level and survives unmount.
 */
function startPolling(
	apiUrl: string,
	predictionId: string,
	imageItemId: string,
	imageSrc: string,
	originalFrom: number,
	durationMs: number,
	cameraMotion: string,
) {
	// If already polling (has a real intervalId), don't double-poll
	const existing = activeJobs.get(imageItemId);
	if (existing && existing.predictionId !== "pending") return;

	const job: AnimationJob = {
		predictionId,
		imageItemId,
		imageSrc,
		originalFrom,
		durationMs,
		cameraMotion,
		intervalId: null as any,
		status: "Processing... This may take 1-3 minutes",
		error: null,
	};

	// Build poll URL with listing context for DB persistence
	const listingId = getListingId();
	let pollUrl = `${apiUrl}/api/editor/animate-image?predictionId=${predictionId}`;
	if (listingId) pollUrl += `&listingId=${listingId}`;
	if (imageSrc) pollUrl += `&imageUrl=${encodeURIComponent(imageSrc)}`;

	const intervalId = setInterval(async () => {
		try {
			const pollRes = await fetch(pollUrl);
			const pollData = await pollRes.json();

			if (pollData.status === "succeeded" && pollData.video_url) {
				clearInterval(job.intervalId);
				job.status = "Replacing image with video...";
				notifyJobListeners();

				// Queue the delete+replace so concurrent completions don't clash
				queueDeleteAndReplace(job, pollData.video_url);

				// Clean up job after replacement is queued
				setTimeout(() => {
					activeJobs.delete(imageItemId);
					notifyJobListeners();
				}, 1000);
			} else if (
				pollData.status === "failed" ||
				pollData.status === "canceled"
			) {
				clearInterval(job.intervalId);
				job.status = "";
				job.error = pollData.error || "Animation failed";
				notifyJobListeners();
				// Keep job around briefly so UI can show error
				setTimeout(() => {
					activeJobs.delete(imageItemId);
					notifyJobListeners();
				}, 10000);
			} else {
				job.status = `Processing (${pollData.status})... This may take 1-3 minutes`;
				notifyJobListeners();
			}
		} catch (pollError) {
			clearInterval(job.intervalId);
			job.status = "";
			job.error =
				pollError instanceof Error ? pollError.message : "Polling failed";
			notifyJobListeners();
			setTimeout(() => {
				activeJobs.delete(imageItemId);
				notifyJobListeners();
			}, 10000);
		}
	}, 5000);

	job.intervalId = intervalId;
	activeJobs.set(imageItemId, job);
	notifyJobListeners();
}

export function AnimateImageControl({ trackItem }: AnimateImageControlProps) {
	const [cameraMotion, setCameraMotion] = useState("Slow smooth dolly in on rails. Stabilized camera, no handheld shake, no jitter.");
	const [duration, setDuration] = useState("6");
	const [prompt, setPrompt] = useState("");
	const [error, setError] = useState("");
	// Force re-render when module-level jobs change
	const [, setTick] = useState(0);

	useEffect(() => {
		const listener = () => setTick((t) => t + 1);
		jobListeners.add(listener);
		return () => {
			jobListeners.delete(listener);
		};
	}, []);

	const imageSrc = trackItem.details?.src as string;
	const existingJob = activeJobs.get(trackItem.id);
	const isAnimating = !!existingJob;
	const status = existingJob?.status || "";
	const jobError = existingJob?.error || "";

	const handleAnimate = useCallback(async () => {
		if (!imageSrc) {
			setError("No image source found");
			return;
		}

		if (activeJobs.has(trackItem.id)) return; // Already animating

		setError("");

		// Immediately show "Starting..." state before the API call
		const placeholderJob: AnimationJob = {
			predictionId: "pending",
			imageItemId: trackItem.id,
			imageSrc,
			originalFrom: trackItem.display?.from || 0,
			durationMs: parseInt(duration) * 1000,
			cameraMotion,
			intervalId: null as any,
			status: "Starting animation...",
			error: null,
		};
		activeJobs.set(trackItem.id, placeholderJob);
		notifyJobListeners();

		const apiUrl = getApiUrl();

		try {
			// Create prediction
			const createRes = await fetch(`${apiUrl}/api/editor/animate-image`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					image_url: imageSrc,
					prompt: `${cameraMotion} ${prompt || "Smooth cinematic footage with subtle camera movement."}`,
					duration: parseInt(duration),
					aspect_ratio: getCanvasAspectRatio(),
					user_id: getUserId(),
					listing_id: getListingId(),
				}),
			});

			const createData = await createRes.json();

			if (!createData.success) {
				const msg = createData.remaining_credits !== undefined
					? `${createData.error} (${createData.remaining_credits} credits remaining)`
					: createData.error || "Failed to start animation";
				throw new Error(msg);
			}

			const predictionId = createData.prediction_id;
			const originalFrom = trackItem.display?.from || 0;
			const videoDurationMs = parseInt(duration) * 1000;

			// Start module-level polling (survives unmount)
			startPolling(
				apiUrl,
				predictionId,
				trackItem.id,
				imageSrc,
				originalFrom,
				videoDurationMs,
				cameraMotion,
			);
		} catch (err) {
			// Clean up the placeholder job on failure
			activeJobs.delete(trackItem.id);
			notifyJobListeners();
			setError(err instanceof Error ? err.message : "Animation failed");
		}
	}, [imageSrc, prompt, cameraMotion, duration, trackItem]);

	const displayError = error || jobError;

	return (
		<Card className="p-4 space-y-4">
			<div className="flex items-center gap-2">
				<Film className="h-4 w-4 text-blue-500" />
				<h3 className="font-semibold text-sm">Animate Image</h3>
			</div>

			<div className="space-y-3">
				{/* Camera Motion */}
				<div className="space-y-2">
					<Label htmlFor="camera-motion" className="text-xs">
						Camera Motion
					</Label>
					<Select
						value={cameraMotion}
						onValueChange={setCameraMotion}
						disabled={isAnimating}
					>
						<SelectTrigger id="camera-motion" className="h-8">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{CAMERA_MOTIONS.map((motion) => (
								<SelectItem key={motion.value} value={motion.value}>
									{motion.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Duration */}
				<div className="space-y-2">
					<Label htmlFor="anim-duration" className="text-xs">
						Duration
					</Label>
					<Select
						value={duration}
						onValueChange={setDuration}
						disabled={isAnimating}
					>
						<SelectTrigger id="anim-duration" className="h-8">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{DURATIONS.map((d) => (
								<SelectItem key={d.value} value={d.value}>
									{d.label} ({parseInt(d.value) * CREDITS_PER_SECOND} credits)
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Optional Prompt */}
				<div className="space-y-2">
					<Label htmlFor="anim-prompt" className="text-xs">
						Prompt (optional)
					</Label>
					<Textarea
						id="anim-prompt"
						placeholder="Describe the motion or scene..."
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						className="h-16 text-xs resize-none"
						disabled={isAnimating}
					/>
				</div>
			</div>

			{/* Error */}
			{displayError && (
				<p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
					{displayError}
				</p>
			)}

			{/* Status */}
			{status && (
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<Loader2 className="h-3 w-3 animate-spin" />
					<span>{status}</span>
				</div>
			)}

			{/* Animate Button */}
			<Button
				onClick={handleAnimate}
				disabled={isAnimating || !imageSrc}
				className="w-full"
				size="sm"
			>
				{isAnimating ? (
					<>
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						Animating...
					</>
				) : (
					<>
						<Film className="h-4 w-4 mr-2" />
						Animate ({parseInt(duration) * CREDITS_PER_SECOND} credits)
					</>
				)}
			</Button>

			<p className="text-xs text-muted-foreground">
				Turns the image into a video clip using AI. Takes 1-3 minutes. Costs 1 credit per second.
			</p>
		</Card>
	);
}
