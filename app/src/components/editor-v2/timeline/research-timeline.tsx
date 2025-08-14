// Copied directly from research/react-video-editor/src/features/editor/timeline/timeline.tsx
import { useEffect, useRef, useState } from "react";
import { timeMsToUnits, unitsToTimeMs } from "@designcombo/timeline";
import CanvasTimeline from "./items/timeline";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { dispatch, filter, subject } from "@designcombo/events";
import {
	TIMELINE_BOUNDING_CHANGED,
	TIMELINE_PREFIX,
} from "@designcombo/timeline";
import { TIMELINE_OFFSET_CANVAS_LEFT, TIMELINE_OFFSET_CANVAS_RIGHT } from "../constants/constants";
import useEditorStore from "../store/use-editor-store";
import StateManager, { REPLACE_MEDIA } from "@designcombo/state";
import { ITrackItem } from "@designcombo/types";
import { useStateManagerEvents } from "../hooks/use-state-manager-events";
import { useCurrentPlayerFrame } from "../hooks/use-current-frame";
import { timeMsToUnits as timelineTimeMsToUnits } from "../utils/timeline";
import ResearchHeader from "./research-header";
import ResearchRuler from "./research-ruler";
import Playhead from "./playhead";

// Import our timeline items
import { AIText, AIImage, AIVideo, AIAudio } from "./items";

CanvasTimeline.registerItems({
	Text: AIText,
	Image: AIImage,
	Audio: AIAudio,
	Video: AIVideo,
});

const EMPTY_SIZE = { width: 0, height: 0 };

const ResearchTimeline = ({ stateManager }: { stateManager: StateManager }) => {
	// prevent duplicate scroll events
	const canScrollRef = useRef(false);
	const timelineContainerRef = useRef<HTMLDivElement>(null);
	const [scrollLeft, setScrollLeft] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasElRef = useRef<HTMLCanvasElement>(null);
	const canvasRef = useRef<CanvasTimeline | null>(null);
	const verticalScrollbarVpRef = useRef<HTMLDivElement>(null);
	const horizontalScrollbarVpRef = useRef<HTMLDivElement>(null);
	const { scale, playerRef, fps, duration, setState, timeline } = useEditorStore();
	const currentFrame = useCurrentPlayerFrame(playerRef);
	const [canvasSize, setCanvasSize] = useState(EMPTY_SIZE);
	const [size, setSize] = useState<{ width: number; height: number }>(
		EMPTY_SIZE,
	);

	// Connect StateManager to our store
	useStateManagerEvents(stateManager);

	// Handle playhead auto-scroll during playback
	useEffect(() => {
		if (playerRef?.current) {
			canScrollRef.current = playerRef?.current.isPlaying();
		}
	}, [playerRef?.current?.isPlaying()]);

	// Auto-scroll timeline to follow playhead during playback
	useEffect(() => {
		const position = timelineTimeMsToUnits((currentFrame / fps) * 1000, scale.zoom);
		const canvasEl = canvasElRef.current;
		const horizontalScrollbar = horizontalScrollbarVpRef.current;

		if (!canvasEl || !horizontalScrollbar) return;

		const canvasBoudingX = canvasEl.getBoundingClientRect().x + canvasEl.clientWidth;
		const playHeadPos = position - scrollLeft + 40;
		
		if (playHeadPos >= canvasBoudingX) {
			const scrollDivWidth = horizontalScrollbar.clientWidth;
			const totalScrollWidth = horizontalScrollbar.scrollWidth;
			const currentPosScroll = horizontalScrollbar.scrollLeft;
			const availableScroll = totalScrollWidth - (scrollDivWidth + currentPosScroll);
			const scaleScroll = availableScroll / scrollDivWidth;
			
			if (scaleScroll >= 0) {
				if (scaleScroll > 1) {
					horizontalScrollbar.scrollTo({
						left: currentPosScroll + scrollDivWidth,
					});
				} else {
					horizontalScrollbar.scrollTo({
						left: totalScrollWidth - scrollDivWidth,
					});
				}
			}
		}
	}, [currentFrame]);

	const onScroll = (v: { scrollTop: number; scrollLeft: number }) => {
		if (horizontalScrollbarVpRef.current && verticalScrollbarVpRef.current) {
			verticalScrollbarVpRef.current.scrollTop = -v.scrollTop;
			horizontalScrollbarVpRef.current.scrollLeft = -v.scrollLeft;
			setScrollLeft(-v.scrollLeft);
		}
	};

	const onResizeCanvas = (payload: { width: number; height: number }) => {
		setCanvasSize({
			width: payload.width,
			height: payload.height,
		});
	};

	// Initialize timeline
	useEffect(() => {
		const canvasEl = canvasElRef.current;
		const timelineContainerEl = timelineContainerRef.current;

		if (!canvasEl || !timelineContainerEl) return;

		const containerWidth = timelineContainerEl.clientWidth - 40;
		const containerHeight = Math.max(200, timelineContainerEl.clientHeight - 90);

		console.log('Creating timeline with scale:', scale);
		console.log('Duration:', duration);
		console.log('Container size:', { width: containerWidth, height: containerHeight });
		
		const canvas = new CanvasTimeline(canvasEl, {
			width: containerWidth,
			height: containerHeight,
			bounding: {
				width: containerWidth,
				height: 0,
			},
			selectionColor: "rgba(0, 216, 214, 0.1)",
			selectionBorderColor: "rgba(0, 216, 214, 1.0)",
			onScroll,
			onResizeCanvas,
			scale: { zoom: scale.zoom, unit: scale.unit, segments: scale.segments },
			state: stateManager,
			duration,
			spacing: {
				left: TIMELINE_OFFSET_CANVAS_LEFT,
				right: TIMELINE_OFFSET_CANVAS_RIGHT,
			},
			sizesMap: {
				text: 32,
				audio: 36,
				image: 40,
				video: 40,
				caption: 32,
			},
			itemTypes: [
				"text",
				"image",
				"audio", 
				"video",
				"caption",
				"helper",
				"track",
			],
			acceptsMap: {
				text: ["text", "caption"],
				image: ["image", "video"],
				video: ["video", "image"],
				audio: ["audio"],
				main: ["video", "image", "audio", "text", "caption"],
			},
			guideLineColor: "#ffffff",
		});
		
		console.log('Timeline canvas created:', canvas);

		canvasRef.current = canvas;
		setState({ timeline: canvas });

		setCanvasSize({ width: containerWidth, height: containerHeight });
		setSize({
			width: containerWidth,
			height: 0,
		});

		return () => {
			canvas.purge();
		};
	}, [stateManager, scale, duration]);

	// Handle timeline bounding changes
	useEffect(() => {
		const addEvents = subject.pipe(
			filter(({ key }) => key.startsWith(TIMELINE_PREFIX)),
		);

		const subscription = addEvents.subscribe((obj) => {
			if (obj.key === TIMELINE_BOUNDING_CHANGED) {
				const bounding = obj.value?.payload?.bounding;
				if (bounding) {
					setSize({
						width: bounding.width,
						height: bounding.height,
					});
				}
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	// Handle horizontal scroll
	const handleOnScrollH = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
		const scrollLeft = e.currentTarget.scrollLeft;
		if (canScrollRef.current) {
			const canvas = canvasRef.current;
			if (canvas) {
				canvas.scrollTo({ scrollLeft });
			}
		}
		setScrollLeft(scrollLeft);
	};

	// Handle vertical scroll
	const handleOnScrollV = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
		const scrollTop = e.currentTarget.scrollTop;
		if (canScrollRef.current) {
			const canvas = canvasRef.current;
			if (canvas) {
				canvas.scrollTo({ scrollTop });
			}
		}
	};

	// Handle ruler click for seeking
	const onClickRuler = (units: number) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const time = unitsToTimeMs(units, scale.zoom);
		playerRef?.current?.seekTo((time * fps) / 1000);
	};

	// Handle ruler scroll synchronization
	const onRulerScroll = (newScrollLeft: number) => {
		// Update the timeline canvas scroll position
		const canvas = canvasRef.current;
		if (canvas) {
			canvas.scrollTo({ scrollLeft: newScrollLeft });
		}

		// Update the horizontal scrollbar position
		if (horizontalScrollbarVpRef.current) {
			horizontalScrollbarVpRef.current.scrollLeft = newScrollLeft;
		}

		// Update the local scroll state
		setScrollLeft(newScrollLeft);
	};

	return (
		<div
			ref={timelineContainerRef}
			id="timeline-container"
			className="relative h-full w-full overflow-hidden bg-muted"
		>
			<ResearchHeader />
			<ResearchRuler
				onClick={onClickRuler}
				scrollLeft={scrollLeft}
				onScroll={onRulerScroll}
			/>
			<Playhead scrollLeft={scrollLeft} />
			<div className="flex">
				<div
					style={{ width: TIMELINE_OFFSET_CANVAS_LEFT }}
					className="relative flex-none"
				/>
				<div style={{ height: canvasSize.height }} className="relative flex-1">
					<div
						style={{ height: canvasSize.height }}
						ref={containerRef}
						className="absolute top-0 w-full"
					>
						<canvas id="designcombo-timeline-canvas" ref={canvasElRef} />
					</div>

					{/* Horizontal Scrollbar */}
					<ScrollArea.Root
						type="always"
						style={{
							position: "absolute",
							width: "calc(100vw - 40px)",
							height: "10px",
						}}
						className="ScrollAreaRootH"
						onPointerDown={() => {
							canScrollRef.current = true;
						}}
						onPointerUp={() => {
							canScrollRef.current = false;
						}}
					>
						<ScrollArea.Viewport
							onScroll={handleOnScrollH}
							className="ScrollAreaViewport"
							id="viewportH"
							ref={horizontalScrollbarVpRef}
						>
							<div
								style={{
									width:
										size.width > canvasSize.width
											? size.width + TIMELINE_OFFSET_CANVAS_RIGHT
											: size.width,
								}}
								className="pointer-events-none h-[10px]"
							/>
						</ScrollArea.Viewport>

						<ScrollArea.Scrollbar
							className="ScrollAreaScrollbar"
							orientation="horizontal"
						>
							<ScrollArea.Thumb
								onMouseDown={() => {
									canScrollRef.current = true;
								}}
								onMouseUp={() => {
									canScrollRef.current = false;
								}}
								className="ScrollAreaThumb"
							/>
						</ScrollArea.Scrollbar>
					</ScrollArea.Root>

					{/* Vertical Scrollbar */}
					<ScrollArea.Root
						type="always"
						style={{
							position: "absolute",
							height: canvasSize.height,
							width: "10px",
						}}
						className="ScrollAreaRootV"
					>
						<ScrollArea.Viewport
							onScroll={handleOnScrollV}
							className="ScrollAreaViewport"
							ref={verticalScrollbarVpRef}
						>
							<div
								style={{
									height:
										size.height > canvasSize.height
											? size.height + 40
											: canvasSize.height,
								}}
								className="pointer-events-none w-[10px]"
							/>
						</ScrollArea.Viewport>
						<ScrollArea.Scrollbar
							className="ScrollAreaScrollbar"
							orientation="vertical"
						>
							<ScrollArea.Thumb
								onMouseDown={() => {
									canScrollRef.current = true;
								}}
								onMouseUp={() => {
									canScrollRef.current = false;
								}}
								className="ScrollAreaThumb"
							/>
						</ScrollArea.Scrollbar>
					</ScrollArea.Root>
				</div>
			</div>
		</div>
	);
};

export default ResearchTimeline;