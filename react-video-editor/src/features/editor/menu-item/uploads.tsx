import { ADD_AUDIO, ADD_IMAGE, ADD_VIDEO } from "@designcombo/state";
import { dispatch } from "@designcombo/events";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
	Music,
	Image as ImageIcon,
	Video as VideoIcon,
	Loader2,
	UploadIcon,
	Film,
} from "lucide-react";
import { generateId } from "@designcombo/timeline";
import { Button } from "@/components/ui/button";
import useUploadStore from "../store/use-upload-store";
import useStore from "../store/use-store";
import ModalUpload from "@/components/modal-upload";
import { useMemo, useState, useEffect } from "react";

interface ListingClip {
	prediction_id: string;
	video_url: string;
	image_url: string | null;
	index: number;
	filename?: string;
	created_at: string | null;
}

function formatClipLabel(clip: ListingClip): string {
	// Try filename first (strip extension)
	if (clip.filename) {
		const name = clip.filename.replace(/\.mp4$/i, "");
		// If it's too long, truncate
		if (name.length > 20) return name.substring(0, 18) + "...";
		return name;
	}
	return `Clip ${clip.index + 1}`;
}

function formatClipDate(dateStr: string | null): string {
	if (!dateStr) return "";
	try {
		const d = new Date(dateStr);
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
			" " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
	} catch {
		return "";
	}
}

export const Uploads = () => {
	const { setShowUploadModal, uploads, pendingUploads, activeUploads } =
		useUploadStore();
	const { trackItemsMap } = useStore();

	// Fetch saved listing clips from DB (survives reload)
	const [listingClips, setListingClips] = useState<ListingClip[]>([]);
	const [loadingClips, setLoadingClips] = useState(false);

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const listingId = urlParams.get("listingId");
		const userId = urlParams.get("userId");
		const apiUrl = urlParams.get("apiUrl") || window.location.origin;

		if (!listingId || !userId) return;

		setLoadingClips(true);
		fetch(`${apiUrl}/api/editor/listing-clips?listingId=${listingId}&userId=${userId}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success && data.clips) {
					setListingClips(data.clips);
					console.log(`✅ Loaded ${data.clips.length} saved listing clips`);
				}
			})
			.catch((err) => console.error("❌ Failed to load listing clips:", err))
			.finally(() => setLoadingClips(false));
	}, []);

	// Group completed uploads by type
	const videos = uploads.filter(
		(upload) => upload.type?.startsWith("video/") || upload.type === "video",
	);
	const images = uploads.filter(
		(upload) => upload.type?.startsWith("image/") || upload.type === "image",
	);
	const audios = uploads.filter(
		(upload) => upload.type?.startsWith("audio/") || upload.type === "audio",
	);

	const handleAddVideo = (video: any) => {
		const srcVideo = video.metadata?.uploadedUrl || video.url;

		dispatch(ADD_VIDEO, {
			payload: {
				id: generateId(),
				details: {
					src: srcVideo,
				},
				metadata: {
					previewUrl:
						"https://cdn.designcombo.dev/caption_previews/static_preset1.webp",
				},
			},
			options: {
				resourceId: "main",
				scaleMode: "fit",
			},
		});
	};

	const handleAddImage = (image: any) => {
		const srcImage = image.metadata?.uploadedUrl || image.url;

		dispatch(ADD_IMAGE, {
			payload: {
				id: generateId(),
				type: "image",
				display: {
					from: 0,
					to: 5000,
				},
				details: {
					src: srcImage,
				},
				metadata: {},
			},
			options: {},
		});
	};

	const handleAddAudio = (audio: any) => {
		const srcAudio = audio.metadata?.uploadedUrl || audio.url;
		dispatch(ADD_AUDIO, {
			payload: {
				id: generateId(),
				type: "audio",
				details: {
					src: srcAudio,
				},
				metadata: {},
			},
			options: {},
		});
	};

	// Collect project assets from current editor state (listing photos + generated clips)
	const projectImages = useMemo(() => {
		return Object.values(trackItemsMap).filter(
			(item) => item.type === "image" && item.details?.src
		);
	}, [trackItemsMap]);

	const projectClips = useMemo(() => {
		return Object.values(trackItemsMap).filter(
			(item) => item.type === "video" && item.details?.src
		);
	}, [trackItemsMap]);

	const handleAddProjectImage = (src: string) => {
		dispatch(ADD_IMAGE, {
			payload: {
				id: generateId(),
				type: "image",
				display: { from: 0, to: 5000 },
				details: { src },
				metadata: {},
			},
			options: {},
		});
	};

	const handleAddProjectClip = (src: string) => {
		dispatch(ADD_VIDEO, {
			payload: {
				id: generateId(),
				details: { src },
				metadata: {},
			},
			options: { resourceId: "main", scaleMode: "fit" },
		});
	};

	const UploadPrompt = () => (
		<div className="flex items-center justify-center px-4">
			<Button
				className="w-full cursor-pointer"
				onClick={() => setShowUploadModal(true)}
			>
				<UploadIcon className="w-4 h-4" />
				<span className="ml-2">Upload</span>
			</Button>
		</div>
	);

	return (
		<div className="flex flex-1 flex-col">
			<div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
				Your uploads
			</div>
			<ModalUpload />
			<UploadPrompt />

			{/* Saved Listing Clips — persisted in DB, survive reloads */}
			{listingClips.length > 0 && (
				<div className="flex flex-col gap-2 px-4 pt-4 pb-3 mt-2 border-t border-b border-border">
					<div className="flex items-center gap-2 mb-2">
						<Film className="w-4 h-4 text-purple-400" />
						<span className="font-medium text-sm">Saved Clips ({listingClips.length})</span>
					</div>
					<ScrollArea className="max-h-64">
						<div className="flex flex-col gap-2">
							{listingClips.map((clip) => (
								<div
									key={clip.prediction_id}
									className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-md p-1.5 transition-colors"
									onClick={() => handleAddProjectClip(clip.video_url)}
								>
									<Card className="w-14 h-14 shrink-0 overflow-hidden relative">
										<video
											src={clip.video_url}
											className="w-full h-full object-cover"
											muted
											preload="metadata"
										/>
										<div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
											<span className="text-white text-xs">+ Add</span>
										</div>
									</Card>
									<div className="flex flex-col gap-0.5 min-w-0">
										<span className="text-xs font-medium truncate" title={clip.filename || `Clip ${clip.index + 1}`}>
											{formatClipLabel(clip)}
										</span>
										{clip.created_at && (
											<span className="text-[10px] text-muted-foreground">
												{formatClipDate(clip.created_at)}
											</span>
										)}
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
				</div>
			)}

			{loadingClips && (
				<div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
					<Loader2 className="w-3 h-3 animate-spin" />
					Loading saved clips...
				</div>
			)}

			{/* Project Assets — listing photos & generated clips */}
			{(projectClips.length > 0 || projectImages.length > 0) && (
				<div className="flex flex-col gap-4 px-4 pt-4 pb-3 mt-1 border-b border-border">
					{projectClips.length > 0 && (
						<div>
							<div className="flex items-center gap-2 mb-2">
								<Film className="w-4 h-4 text-blue-400" />
								<span className="font-medium text-sm">Generated Clips ({projectClips.length})</span>
							</div>
							<ScrollArea className="max-h-40">
								<div className="grid grid-cols-3 gap-2">
									{projectClips.map((clip) => (
										<div key={clip.id} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleAddProjectClip(clip.details.src)}>
											<Card className="w-16 h-16 overflow-hidden relative">
												<video src={clip.details.src} className="w-full h-full object-cover" muted preload="metadata" />
												<div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
													<span className="text-white text-xs">+ Add</span>
												</div>
											</Card>
										</div>
									))}
								</div>
							</ScrollArea>
						</div>
					)}
					{projectImages.length > 0 && (
						<div>
							<div className="flex items-center gap-2 mb-2">
								<ImageIcon className="w-4 h-4 text-green-400" />
								<span className="font-medium text-sm">Listing Photos ({projectImages.length})</span>
							</div>
							<ScrollArea className="max-h-40">
								<div className="grid grid-cols-3 gap-2">
									{projectImages.map((img) => (
										<div key={img.id} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleAddProjectImage(img.details.src)}>
											<Card className="w-16 h-16 overflow-hidden relative">
												<img src={img.details.src} alt="" className="w-full h-full object-cover" />
												<div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
													<span className="text-white text-xs">+ Add</span>
												</div>
											</Card>
										</div>
									))}
								</div>
							</ScrollArea>
						</div>
					)}
				</div>
			)}

			{/* Uploads in Progress Section */}
			{(pendingUploads.length > 0 || activeUploads.length > 0) && (
				<div className="p-4">
					<div className="font-medium text-sm mb-2 flex items-center gap-2">
						<Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
						Uploads in Progress
					</div>
					<div className="flex flex-col gap-2">
						{pendingUploads.map((upload) => (
							<div key={upload.id} className="flex items-center gap-2">
								<span className="truncate text-xs flex-1">
									{upload.file?.name || upload.url || "Unknown"}
								</span>
								<span className="text-xs text-muted-foreground">Pending</span>
							</div>
						))}
						{activeUploads.map((upload) => (
							<div key={upload.id} className="flex items-center gap-2">
								<span className="truncate text-xs flex-1">
									{upload.file?.name || upload.url || "Unknown"}
								</span>
								<div className="flex items-center gap-1">
									<Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
									<span className="text-xs">{upload.progress ?? 0}%</span>
									<span className="text-xs text-muted-foreground ml-2">
										{upload.status}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			<div className="flex flex-col gap-10 p-4">
				{/* Videos Section */}
				{videos.length > 0 && (
					<div>
						<div className="flex items-center gap-2 mb-2">
							<VideoIcon className="w-4 h-4 text-muted-foreground" />
							<span className="font-medium text-sm">Videos</span>
						</div>
						<ScrollArea className="max-h-32">
							<div className="grid grid-cols-3 gap-2 max-w-full">
								{videos.map((video, idx) => {
									const vidSrc = video.metadata?.uploadedUrl || video.url;
									const vidName = video.fileName || video.file?.name || "Video";
									return (
										<div
											className="flex items-center gap-2 flex-col w-full"
											key={video.id || idx}
										>
											<Card
												className="w-16 h-16 flex items-center justify-center overflow-hidden relative cursor-pointer"
												onClick={() => handleAddVideo(video)}
											>
												{vidSrc ? (
													<video
														src={vidSrc}
														className="w-full h-full object-cover"
														muted
														preload="metadata"
													/>
												) : (
													<VideoIcon className="w-8 h-8 text-muted-foreground" />
												)}
											</Card>
											<div className="text-xs text-muted-foreground truncate w-full text-center" title={vidName}>
												{vidName}
											</div>
										</div>
									);
								})}
							</div>
						</ScrollArea>
					</div>
				)}

				{/* Images Section */}
				{images.length > 0 && (
					<div>
						<div className="flex items-center gap-2 mb-2">
							<ImageIcon className="w-4 h-4 text-muted-foreground" />
							<span className="font-medium text-sm">Images</span>
						</div>
						<ScrollArea className="max-h-32">
							<div className="grid grid-cols-3 gap-2 max-w-full">
								{images.map((image, idx) => {
									const imgSrc = image.metadata?.uploadedUrl || image.url;
									const imgName = image.fileName || image.file?.name || "Image";
									return (
										<div
											className="flex items-center gap-2 flex-col w-full"
											key={image.id || idx}
										>
											<Card
												className="w-16 h-16 flex items-center justify-center overflow-hidden relative cursor-pointer"
												onClick={() => handleAddImage(image)}
											>
												{imgSrc ? (
													<img
														src={imgSrc}
														alt={imgName}
														className="w-full h-full object-cover"
													/>
												) : (
													<ImageIcon className="w-8 h-8 text-muted-foreground" />
												)}
											</Card>
											<div className="text-xs text-muted-foreground truncate w-full text-center" title={imgName}>
												{imgName}
											</div>
										</div>
									);
								})}
							</div>
						</ScrollArea>
					</div>
				)}

				{/* Audios Section */}
				{audios.length > 0 && (
					<div>
						<div className="flex items-center gap-2 mb-2">
							<Music className="w-4 h-4 text-muted-foreground" />
							<span className="font-medium text-sm">Audios</span>
						</div>
						<ScrollArea className="max-h-32">
							<div className="grid grid-cols-3 gap-2 max-w-full">
								{audios.map((audio, idx) => (
									<div
										className="flex items-center gap-2 flex-col w-full"
										key={audio.id || idx}
									>
										<Card
											className="w-16 h-16 flex items-center justify-center overflow-hidden relative cursor-pointer"
											onClick={() => handleAddAudio(audio)}
										>
											<Music className="w-8 h-8 text-muted-foreground" />
										</Card>
										<div className="text-xs text-muted-foreground truncate w-full text-center">
											{audio.file?.name || audio.url || "Audio"}
										</div>
									</div>
								))}
							</div>
						</ScrollArea>
					</div>
				)}
			</div>
		</div>
	);
};
