import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import { IImage, ITrackItem } from "@designcombo/types";
import { Paintbrush, Loader2, Undo2, Plus, X, ImageIcon } from "lucide-react";

interface EditImageControlProps {
	trackItem: ITrackItem & IImage;
}

function getApiUrl(): string {
	const urlParams = new URLSearchParams(window.location.search);
	return (
		urlParams.get("apiUrl") ||
		process.env.NEXT_PUBLIC_API_URL ||
		window.location.origin
	);
}

export function EditImageControl({ trackItem }: EditImageControlProps) {
	const [prompt, setPrompt] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [error, setError] = useState("");
	const [originalSrc, setOriginalSrc] = useState<string | null>(
		(trackItem.metadata as any)?.originalSrc || null,
	);
	const [referenceImages, setReferenceImages] = useState<string[]>([]);
	const [newRefUrl, setNewRefUrl] = useState("");

	const imageSrc = trackItem.details?.src as string;

	const handleAddRef = useCallback(() => {
		const url = newRefUrl.trim();
		if (!url) return;
		setReferenceImages((prev) => [...prev, url]);
		setNewRefUrl("");
	}, [newRefUrl]);

	const handleRemoveRef = useCallback((index: number) => {
		setReferenceImages((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const handleEditImage = useCallback(async () => {
		if (!imageSrc || !prompt.trim()) {
			setError("Please enter a prompt describing what to change");
			return;
		}

		setIsEditing(true);
		setError("");

		const apiUrl = getApiUrl();

		try {
			const res = await fetch(`${apiUrl}/api/editor/edit-image`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					image_url: imageSrc,
					prompt: prompt.trim(),
					reference_images:
						referenceImages.length > 0 ? referenceImages : undefined,
				}),
			});

			const data = await res.json();

			if (!data.success || !data.image_url) {
				throw new Error(data.error || "Image editing failed");
			}

			// Store original URL for undo (only if not already stored)
			if (!originalSrc) {
				setOriginalSrc(imageSrc);
			}

			// Update image source in the editor
			dispatch(EDIT_OBJECT, {
				payload: {
					[trackItem.id]: {
						details: {
							src: data.image_url,
						},
						metadata: {
							...(trackItem.metadata || {}),
							originalSrc: originalSrc || imageSrc,
							lastEditPrompt: prompt.trim(),
						},
					},
				},
			});

			console.log("✅ Image edited successfully");
			setPrompt("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Edit failed");
		} finally {
			setIsEditing(false);
		}
	}, [imageSrc, prompt, trackItem, originalSrc, referenceImages]);

	const handleRevert = useCallback(() => {
		if (!originalSrc) return;

		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					details: {
						src: originalSrc,
					},
					metadata: {
						...(trackItem.metadata || {}),
						originalSrc: undefined,
						lastEditPrompt: undefined,
					},
				},
			},
		});

		setOriginalSrc(null);
		console.log("↩️ Reverted to original image");
	}, [originalSrc, trackItem]);

	return (
		<Card className="p-4 space-y-4">
			<div className="flex items-center gap-2">
				<Paintbrush className="h-4 w-4 text-green-500" />
				<h3 className="font-semibold text-sm">Edit Image</h3>
			</div>

			<div className="space-y-3">
				{/* Prompt */}
				<div className="space-y-2">
					<Label htmlFor="edit-prompt" className="text-xs">
						What should change?
					</Label>
					<Textarea
						id="edit-prompt"
						placeholder="e.g. Make the sky blue, remove the car, brighten the room..."
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						className="h-20 text-xs resize-none"
						disabled={isEditing}
					/>
				</div>

				{/* Reference Images */}
				<div className="space-y-2">
					<Label className="text-xs flex items-center gap-1">
						<ImageIcon className="h-3 w-3" />
						Reference Images (optional)
					</Label>

					{/* Existing refs */}
					{referenceImages.map((url, i) => (
						<div
							key={i}
							className="flex items-center gap-1 bg-muted/50 rounded px-2 py-1"
						>
							<span className="text-xs truncate flex-1">{url}</span>
							<button
								type="button"
								onClick={() => handleRemoveRef(i)}
								className="text-muted-foreground hover:text-destructive shrink-0"
								disabled={isEditing}
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}

					{/* Add new ref */}
					<div className="flex gap-1">
						<Input
							placeholder="Paste image URL..."
							value={newRefUrl}
							onChange={(e) => setNewRefUrl(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleAddRef();
								}
							}}
							className="h-7 text-xs flex-1"
							disabled={isEditing}
						/>
						<Button
							variant="outline"
							size="icon"
							className="h-7 w-7 shrink-0"
							onClick={handleAddRef}
							disabled={isEditing || !newRefUrl.trim()}
						>
							<Plus className="h-3 w-3" />
						</Button>
					</div>
				</div>
			</div>

			{/* Error */}
			{error && (
				<p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
					{error}
				</p>
			)}

			{/* Edit Button */}
			<Button
				onClick={handleEditImage}
				disabled={isEditing || !imageSrc || !prompt.trim()}
				className="w-full"
				size="sm"
			>
				{isEditing ? (
					<>
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						Editing (~5-10s)...
					</>
				) : (
					<>
						<Paintbrush className="h-4 w-4 mr-2" />
						Edit Image
					</>
				)}
			</Button>

			{/* Revert Button */}
			{originalSrc && (
				<Button
					onClick={handleRevert}
					variant="outline"
					size="sm"
					className="w-full"
					disabled={isEditing}
				>
					<Undo2 className="h-4 w-4 mr-2" />
					Revert to Original
				</Button>
			)}

			<p className="text-xs text-muted-foreground">
				Modify or clean up the image with AI. Add reference images to guide
				the style or content.
			</p>
		</Card>
	);
}
