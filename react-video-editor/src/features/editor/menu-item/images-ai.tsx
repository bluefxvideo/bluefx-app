import { ScrollArea } from "@/components/ui/scroll-area";
import { dispatch } from "@designcombo/events";
import { generateId } from "@designcombo/timeline";
import Draggable from "@/components/shared/draggable";
import { IImage, ITrackItem } from "@designcombo/types";
import React, { useState, useEffect, useMemo } from "react";
import { useIsDraggingOverTimeline } from "../hooks/is-dragging-over-timeline";
import { ADD_ITEMS } from "@designcombo/state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Sparkles } from "lucide-react";
import { usePexelsImages } from "@/hooks/use-pexels-images";
import { ImageLoading } from "@/components/ui/image-loading";
import { AIImageGeneratorPanel } from "./ai-image-generator";
import useStore from "../store/use-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const ImagesAI = () => {
	const isDraggingOverTimeline = useIsDraggingOverTimeline();
	const [searchQuery, setSearchQuery] = useState("");
	const { activeIds, trackItemsMap } = useStore();

	const {
		images: pexelsImages,
		loading: pexelsLoading,
		error: pexelsError,
		currentPage,
		hasNextPage,
		searchImages,
		loadCuratedImages,
		searchImagesAppend,
		loadCuratedImagesAppend,
		clearImages,
	} = usePexelsImages();

	// Check if selected item is an AI-generated image
	const selectedAIImage = useMemo(() => {
		if (activeIds.length === 1) {
			const item = trackItemsMap[activeIds[0]];
			if (item?.type === 'image' && item.metadata?.aiGenerated) {
				return item;
			}
		}
		return null;
	}, [activeIds, trackItemsMap]);

	// Get all AI-generated images from the timeline
	const aiGeneratedImages = useMemo(() => {
		return Object.values(trackItemsMap).filter(
			(item: ITrackItem) => item.type === 'image' && item.metadata?.aiGenerated
		) as ITrackItem[];
	}, [trackItemsMap]);

	// Load curated images on component mount
	useEffect(() => {
		loadCuratedImages();
	}, [loadCuratedImages]);

	const handleAddImage = (payload: Partial<IImage>) => {
		const id = generateId();
		dispatch(ADD_ITEMS, {
			payload: {
				trackItems: [
					{
						id,
						type: "image",
						display: {
							from: 0,
							to: 5000,
						},
						details: {
							src: payload.details?.src,
						},
						metadata: {},
					},
				],
			},
		});
	};

	const handleSearch = async () => {
		if (!searchQuery.trim()) {
			await loadCuratedImages();
			return;
		}

		try {
			await searchImages(searchQuery);
		} finally {
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	const handleLoadMore = () => {
		if (hasNextPage) {
			if (searchQuery.trim()) {
				searchImagesAppend(searchQuery, currentPage + 1);
			} else {
				loadCuratedImagesAppend(currentPage + 1);
			}
		}
	};

	const handleClearSearch = () => {
		setSearchQuery("");
		clearImages();
		loadCuratedImages();
	};

	// Determine default tab based on context
	const defaultTab = selectedAIImage ? "ai-regenerate" : 
	                  aiGeneratedImages.length > 0 ? "ai-images" : "pexels";

	return (
		<div className="flex flex-1 flex-col">
			<div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
				Photos
			</div>

			<Tabs defaultValue={defaultTab} className="flex-1 flex flex-col">
				<div className="px-4 pb-2">
					<TabsList className="grid w-full grid-cols-2 h-8">
						{selectedAIImage ? (
							<>
								<TabsTrigger value="ai-regenerate" className="text-xs py-1">
									<Sparkles className="mr-1 h-3 w-3" />
									Regenerate
								</TabsTrigger>
								<TabsTrigger value="pexels" className="text-xs py-1">
									<Search className="mr-1 h-3 w-3" />
									Stock
								</TabsTrigger>
							</>
						) : aiGeneratedImages.length > 0 ? (
							<>
								<TabsTrigger value="ai-images" className="text-xs py-1">
									<Sparkles className="mr-1 h-3 w-3" />
									AI Images
								</TabsTrigger>
								<TabsTrigger value="pexels" className="text-xs py-1">
									<Search className="mr-1 h-3 w-3" />
									Stock
								</TabsTrigger>
							</>
						) : (
							<>
								<TabsTrigger value="pexels" className="text-xs py-1 col-span-2">
									<Search className="mr-1 h-3 w-3" />
									Stock Photos
								</TabsTrigger>
							</>
						)}
					</TabsList>
				</div>

				{/* AI Images Tab - Show generated images */}
				{aiGeneratedImages.length > 0 && (
					<TabsContent value="ai-images" className="flex-1 mt-0">
						<ScrollArea className="flex-1 h-[calc(100vh-200px)]">
							<div className="p-4">
								<p className="text-xs text-muted-foreground mb-3">
									Your AI-generated images ({aiGeneratedImages.length})
								</p>
								<div className="masonry-sm">
									{aiGeneratedImages.map((image) => (
										<AIImageItem
											key={image.id}
											image={image}
											shouldDisplayPreview={!isDraggingOverTimeline}
											handleAddImage={handleAddImage}
										/>
									))}
								</div>
							</div>
						</ScrollArea>
					</TabsContent>
				)}

				{/* AI Regenerate Tab - Show regeneration panel */}
				{selectedAIImage && (
					<TabsContent value="ai-regenerate" className="flex-1 mt-0">
						<ScrollArea className="flex-1">
							<div className="h-full">
								<AIImageGeneratorPanel trackItem={selectedAIImage} />
							</div>
						</ScrollArea>
					</TabsContent>
				)}

				{/* Pexels Tab - Stock photos */}
				<TabsContent value="pexels" className="flex-1 mt-0 flex flex-col">
					<div className="flex items-center gap-2 px-4 pb-3">
						<div className="relative flex-1">
							<Input
								placeholder="Search Pexels images..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onKeyPress={handleKeyPress}
								className="pr-10 h-8"
							/>
							<Button
								size="sm"
								variant="ghost"
								className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
								onClick={handleSearch}
								disabled={pexelsLoading}
							>
								{pexelsLoading ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									<Search className="h-3 w-3" />
								)}
							</Button>
						</div>
						{searchQuery && (
							<Button
								size="sm"
								variant="outline"
								onClick={handleClearSearch}
								disabled={pexelsLoading}
								className="h-8 px-2 text-xs"
							>
								Clear
							</Button>
						)}
					</div>

					{pexelsError && (
						<div className="px-4 pb-2">
							<div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
								{pexelsError}
							</div>
						</div>
					)}

					<ScrollArea className="flex-1">
						<div className="masonry-sm px-4 pb-4">
							{pexelsImages.map((image, index) => (
								<ImageItem
									key={image.id || index}
									image={image}
									shouldDisplayPreview={!isDraggingOverTimeline}
									handleAddImage={handleAddImage}
								/>
							))}
						</div>
						{pexelsLoading && <ImageLoading message="Searching for images..." />}
						{hasNextPage && (
							<div className="flex items-center justify-center p-4">
								<Button
									size="sm"
									variant="outline"
									onClick={handleLoadMore}
									disabled={pexelsLoading}
									className="h-8 px-3 text-xs"
								>
									{pexelsLoading ? (
										<>
											<Loader2 className="h-3 w-3 mr-2 animate-spin" />
											Loading...
										</>
									) : (
										"Load More"
									)}
								</Button>
							</div>
						)}
					</ScrollArea>
				</TabsContent>
			</Tabs>
		</div>
	);
};

// Component for AI-generated images
const AIImageItem = ({
	handleAddImage,
	image,
	shouldDisplayPreview,
}: {
	handleAddImage: (payload: Partial<IImage>) => void;
	image: ITrackItem;
	shouldDisplayPreview: boolean;
}) => {
	const style = React.useMemo(
		() => ({
			backgroundImage: `url(${image.details?.src})`,
			backgroundSize: "cover",
			width: "80px",
			height: "80px",
		}),
		[image.details?.src],
	);

	return (
		<Draggable
			data={{
				...image,
				preview: image.details?.src
			}}
			renderCustomPreview={<div style={style} />}
			shouldDisplayPreview={shouldDisplayPreview}
		>
			<div
				onClick={() =>
					handleAddImage({
						id: generateId(),
						details: {
							src: image.details?.src,
						},
					} as IImage)
				}
				className="relative flex w-full items-center justify-center overflow-hidden bg-background pb-2 cursor-pointer group"
			>
				<img
					draggable={false}
					src={image.details?.src}
					className="h-full w-full rounded-md object-cover"
					alt={image.metadata?.prompt || "AI generated image"}
				/>
				<div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
					<div className="absolute bottom-1 left-1 right-1">
						<p className="text-[10px] text-white/90 line-clamp-2">
							{image.metadata?.segmentText || "AI Generated"}
						</p>
					</div>
				</div>
				<div className="absolute top-1 right-1">
					<Sparkles className="h-3 w-3 text-white drop-shadow" />
				</div>
			</div>
		</Draggable>
	);
};

// Original Pexels image component
const ImageItem = ({
	handleAddImage,
	image,
	shouldDisplayPreview,
}: {
	handleAddImage: (payload: Partial<IImage>) => void;
	image: Partial<IImage>;
	shouldDisplayPreview: boolean;
}) => {
	const style = React.useMemo(
		() => ({
			backgroundImage: `url(${image.preview})`,
			backgroundSize: "cover",
			width: "80px",
			height: "80px",
		}),
		[image.preview],
	);

	return (
		<Draggable
			data={image}
			renderCustomPreview={<div style={style} />}
			shouldDisplayPreview={shouldDisplayPreview}
		>
			<div
				onClick={() =>
					handleAddImage({
						id: generateId(),
						details: {
							src: image.details?.src,
						},
					} as IImage)
				}
				className="flex w-full items-center justify-center overflow-hidden bg-background pb-2 cursor-pointer"
			>
				<img
					draggable={false}
					src={image.preview}
					className="h-full w-full rounded-md object-cover"
					alt="Visual content"
				/>
			</div>
		</Draggable>
	);
};