import { Button } from "@/components/ui/button";
import { useAIVideoEditorStore } from "../store/use-ai-video-editor-store";
import { 
	Play, 
	Pause, 
	SkipBack, 
	SkipForward, 
	ZoomIn, 
	ZoomOut, 
	Trash2,
	Split,
	Copy
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

// Convert frame to time string
const frameToTimeString = (frame: number, fps: number): string => {
	const safeFrame = isNaN(frame) ? 0 : frame;
	const safeFps = isNaN(fps) || fps === 0 ? 30 : fps;
	const totalSeconds = Math.floor(safeFrame / safeFps);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	const frameNumber = safeFrame % safeFps;
	return `${minutes}:${seconds.toString().padStart(2, '0')}:${frameNumber.toString().padStart(2, '0')}`;
};

const AITimelineHeader = () => {
	const {
		composition,
		timeline,
		setCurrentFrame,
		setZoom,
		play,
		pause,
		selectItems,
		clearSelection,
		duplicateSelectedItems,
		deleteSelectedItems,
	} = useAIVideoEditorStore();

	if (!composition) return null;

	const { fps, durationInFrames } = composition.composition;
	const currentTime = frameToTimeString(timeline.currentFrame || 0, fps);
	const totalTime = frameToTimeString(durationInFrames, fps);
	const hasSelectedItems = timeline.selectedItemIds.length > 0;

	const handlePlay = () => {
		if (timeline.isPlaying) {
			pause();
		} else {
			play();
		}
	};

	const handleSkipBack = () => {
		const currentFrame = timeline.currentFrame || 0;
		const newFrame = Math.max(0, currentFrame - fps); // Skip back 1 second
		setCurrentFrame(newFrame);
	};

	const handleSkipForward = () => {
		const currentFrame = timeline.currentFrame || 0;
		const newFrame = Math.min(durationInFrames - 1, currentFrame + fps); // Skip forward 1 second
		setCurrentFrame(newFrame);
	};

	const handleZoomIn = () => {
		const newZoom = Math.min(3, timeline.zoom + 0.1);
		setZoom(newZoom);
	};

	const handleZoomOut = () => {
		const newZoom = Math.max(0.1, timeline.zoom - 0.1);
		setZoom(newZoom);
	};

	const handleZoomChange = (value: number[]) => {
		setZoom(value[0]);
	};

	const handleDelete = () => {
		if (hasSelectedItems) {
			deleteSelectedItems();
		}
	};

	const handleDuplicate = () => {
		if (hasSelectedItems) {
			duplicateSelectedItems();
		}
	};

	const handleSplit = () => {
		// TODO: Implement split functionality
		console.log('Split functionality not yet implemented');
	};

	return (
		<div className="border-b border-border bg-background px-4 py-2">
			<div className="flex items-center justify-between">
				{/* Left side - Playback controls */}
				<div className="flex items-center gap-2">
					{/* Skip Back */}
					<Button
						size="sm"
						variant="ghost"
						onClick={handleSkipBack}
						title="Skip back 1 second"
					>
						<SkipBack className="h-4 w-4" />
					</Button>

					{/* Play/Pause */}
					<Button
						size="sm"
						variant="outline"
						onClick={handlePlay}
						title={timeline.isPlaying ? "Pause" : "Play"}
					>
						{timeline.isPlaying ? (
							<Pause className="h-4 w-4" />
						) : (
							<Play className="h-4 w-4" />
						)}
					</Button>

					{/* Skip Forward */}
					<Button
						size="sm"
						variant="ghost"
						onClick={handleSkipForward}
						title="Skip forward 1 second"
					>
						<SkipForward className="h-4 w-4" />
					</Button>

					{/* Time Display */}
					<div className="ml-2 text-sm text-muted-foreground font-mono">
						{currentTime} / {totalTime}
					</div>
				</div>

				{/* Center - Item controls */}
				<div className="flex items-center gap-2">
					{hasSelectedItems && (
						<>
							{/* Duplicate */}
							<Button
								size="sm"
								variant="ghost"
								onClick={handleDuplicate}
								title="Duplicate selected items"
							>
								<Copy className="h-4 w-4" />
							</Button>

							{/* Split */}
							<Button
								size="sm"
								variant="ghost"
								onClick={handleSplit}
								title="Split at playhead"
							>
								<Split className="h-4 w-4" />
							</Button>

							{/* Delete */}
							<Button
								size="sm"
								variant="ghost"
								onClick={handleDelete}
								title="Delete selected items"
								className="text-destructive hover:text-destructive"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</>
					)}
				</div>

				{/* Right side - Zoom controls */}
				<div className="flex items-center gap-2">
					{/* Zoom Out */}
					<Button
						size="sm"
						variant="ghost"
						onClick={handleZoomOut}
						disabled={timeline.zoom <= 0.1}
						title="Zoom out"
					>
						<ZoomOut className="h-3 w-3" />
					</Button>

					{/* Zoom Slider */}
					<Slider
						value={[timeline.zoom]}
						onValueChange={handleZoomChange}
						min={0.1}
						max={3}
						step={0.1}
						className="w-20"
					/>

					{/* Zoom In */}
					<Button
						size="sm"
						variant="ghost"
						onClick={handleZoomIn}
						disabled={timeline.zoom >= 3}
						title="Zoom in"
					>
						<ZoomIn className="h-3 w-3" />
					</Button>

					{/* Zoom percentage */}
					<span className="text-xs text-muted-foreground min-w-[45px]">
						{Math.round(timeline.zoom * 100)}%
					</span>
				</div>
			</div>

			{/* Selection info */}
			{hasSelectedItems && (
				<div className="mt-2 text-xs text-muted-foreground">
					{timeline.selectedItemIds.length} item{timeline.selectedItemIds.length !== 1 ? 's' : ''} selected
				</div>
			)}
		</div>
	);
};

export default AITimelineHeader;