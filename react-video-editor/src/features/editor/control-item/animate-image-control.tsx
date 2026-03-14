import { useState, useCallback, useRef, useEffect } from "react";
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
import { ADD_VIDEO, LAYER_DELETE } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { IImage, ITrackItem } from "@designcombo/types";
import { Film, Loader2 } from "lucide-react";
import useStore from "../store/use-store";

interface AnimateImageControlProps {
	trackItem: ITrackItem & IImage;
}

// Helper: update activeIds using Zustand static setState (works even after unmount)
function setActiveIds(ids: string[]) {
	useStore.setState({ activeIds: ids });
}

const CAMERA_MOTIONS = [
	{ value: "none", label: "None" },
	{ value: "dolly_in", label: "Dolly In (Zoom In)" },
	{ value: "dolly_out", label: "Dolly Out (Zoom Out)" },
	{ value: "dolly_left", label: "Dolly Left" },
	{ value: "dolly_right", label: "Dolly Right" },
	{ value: "jib_up", label: "Jib Up (Tilt Up)" },
	{ value: "jib_down", label: "Jib Down (Tilt Down)" },
	{ value: "static", label: "Static" },
];

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

export function AnimateImageControl({ trackItem }: AnimateImageControlProps) {
	const [cameraMotion, setCameraMotion] = useState("dolly_in");
	const [duration, setDuration] = useState("6");
	const [prompt, setPrompt] = useState("");
	const [isAnimating, setIsAnimating] = useState(false);
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const pollRef = useRef<NodeJS.Timeout | null>(null);
	const mountedRef = useRef(true);

	// Track mounted state to avoid React state updates after unmount
	// (component unmounts when the image is deleted during swap)
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

	const imageSrc = trackItem.details?.src as string;

	const handleAnimate = useCallback(async () => {
		if (!imageSrc) {
			setError("No image source found");
			return;
		}

		setIsAnimating(true);
		setError("");
		setStatus("Starting animation...");

		const apiUrl = getApiUrl();

		try {
			// Create prediction
			const createRes = await fetch(`${apiUrl}/api/editor/animate-image`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					image_url: imageSrc,
					prompt: prompt || "Smooth cinematic camera movement",
					camera_motion: cameraMotion,
					duration: parseInt(duration),
					aspect_ratio: "16:9",
				}),
			});

			const createData = await createRes.json();

			if (!createData.success) {
				throw new Error(createData.error || "Failed to start animation");
			}

			const predictionId = createData.prediction_id;
			setStatus("Processing... This may take 1-3 minutes");

			// Poll for completion
			const pollForResult = () => {
				pollRef.current = setInterval(async () => {
					try {
						const pollRes = await fetch(
							`${apiUrl}/api/editor/animate-image?predictionId=${predictionId}`,
						);
						const pollData = await pollRes.json();

						if (pollData.status === "succeeded" && pollData.video_url) {
							// Clear polling
							if (pollRef.current) clearInterval(pollRef.current);

							if (mountedRef.current) setStatus("Replacing image with video...");

							// Store the original image's position before any state changes
							const originalFrom = trackItem.display?.from || 0;
							const videoDurationMs = parseInt(duration) * 1000;
							const itemToDelete = trackItem.id;

							// Step 1: Add the new video FIRST (before deleting, so it exists)
							const newVideoId = generateId();
							dispatch(ADD_VIDEO, {
								payload: {
									id: newVideoId,
									details: {
										src: pollData.video_url,
									},
									display: {
										from: originalFrom,
										to: originalFrom + videoDurationMs,
									},
									metadata: {
										animatedFrom: imageSrc,
										cameraMotion,
									},
								},
								options: {
									resourceId: "main",
									scaleMode: "fit",
								},
							});

							// Step 2: Select the original image and delete it
							// Use static setActiveIds (works even after component unmount)
							setTimeout(() => {
								setActiveIds([itemToDelete]);
								setTimeout(() => {
									dispatch(LAYER_DELETE);
									// Select the new video
									setTimeout(() => {
										setActiveIds([newVideoId]);
										if (mountedRef.current) {
											setIsAnimating(false);
											setStatus("");
										}
										console.log(
											"✅ Image animated and replaced with video",
										);
									}, 100);
								}, 100);
							}, 200);
						} else if (
							pollData.status === "failed" ||
							pollData.status === "canceled"
						) {
							if (pollRef.current) clearInterval(pollRef.current);
							throw new Error(
								pollData.error || "Animation failed",
							);
						} else if (mountedRef.current) {
							setStatus(
								`Processing (${pollData.status})... This may take 1-3 minutes`,
							);
						}
					} catch (pollError) {
						if (pollRef.current) clearInterval(pollRef.current);
						if (mountedRef.current) {
							setError(
								pollError instanceof Error
									? pollError.message
									: "Polling failed",
							);
							setIsAnimating(false);
							setStatus("");
						}
					}
				}, 5000);
			};

			pollForResult();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Animation failed");
			setIsAnimating(false);
			setStatus("");
		}
	}, [imageSrc, prompt, cameraMotion, duration, trackItem]);

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
									{d.label}
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
			{error && (
				<p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
					{error}
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
						Animate
					</>
				)}
			</Button>

			<p className="text-xs text-muted-foreground">
				Turns the image into a video clip using AI. Takes 1-3 minutes.
			</p>
		</Card>
	);
}
