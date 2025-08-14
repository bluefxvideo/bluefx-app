import { useCallback, useEffect, useRef, useState } from "react";
import { debounce } from "lodash";

const PREVIEW_FRAME_WIDTH = 1;
const SECONDARY_FONT = "Inter";
const SMALL_FONT_SIZE = 11;
const TIMELINE_OFFSET_CANVAS_LEFT = 40;

interface AIRulerProps {
	height?: number;
	longLineSize?: number;
	shortLineSize?: number;
	offsetX?: number;
	textOffsetY?: number;
	scrollLeft?: number;
	zoom?: number;
	duration?: number; // in seconds
	textFormat?: (timeValue: number) => string;
	onClick?: (units: number) => void;
	onScroll?: (scrollLeft: number) => void;
}

// Format time in seconds to display format
const formatTimelineUnit = (timeValue: number): string => {
	const totalSeconds = Math.floor(timeValue / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const AITimelineRuler = (props: AIRulerProps) => {
	const {
		height = 40,
		longLineSize = 8,
		shortLineSize = 10,
		offsetX = TIMELINE_OFFSET_CANVAS_LEFT,
		textOffsetY = 17,
		textFormat = formatTimelineUnit,
		scrollLeft = 0,
		zoom = 1,
		duration = 30,
		onClick,
		onScroll,
	} = props;

	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [canvasContext, setCanvasContext] = useState<CanvasRenderingContext2D | null>(null);
	const [canvasSize, setCanvasSize] = useState({
		width: 0,
		height: height,
	});

	// Drag state
	const [isDragging, setIsDragging] = useState(false);
	const [hasDragged, setHasDragged] = useState(false);
	const dragRef = useRef({
		startX: 0,
		startScrollPos: 0,
		isDragging: false,
		hasDragged: false,
	});

	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas) {
			const context = canvas.getContext("2d");
			setCanvasContext(context);
			resize(canvas, context, scrollLeft);
		}
	}, []);

	const handleResize = useCallback(() => {
		resize(canvasRef.current, canvasContext, scrollLeft);
	}, [canvasContext, scrollLeft, zoom]);

	useEffect(() => {
		const resizeHandler = debounce(handleResize, 200);
		window.addEventListener("resize", resizeHandler);

		return () => {
			window.removeEventListener("resize", resizeHandler);
		};
	}, [handleResize]);

	useEffect(() => {
		if (canvasContext) {
			resize(canvasRef.current, canvasContext, scrollLeft);
		}
	}, [canvasContext, scrollLeft, zoom, duration]);

	const resize = (
		canvas: HTMLCanvasElement | null,
		context: CanvasRenderingContext2D | null,
		scrollLeft: number,
	) => {
		if (!canvas || !context) return;

		const offsetParent = canvas.offsetParent as HTMLDivElement;
		const width = offsetParent?.offsetWidth ?? canvas.offsetWidth;
		const height = canvasSize.height;

		canvas.width = width;
		canvas.height = height;

		draw(context, scrollLeft, width, height);
		setCanvasSize({ width, height });
	};

	const draw = (
		context: CanvasRenderingContext2D,
		scrollLeft: number,
		width: number,
		height: number,
	) => {
		const unit = 1000; // 1 second = 1000ms
		const segments = 5; // 5 segments per second (200ms each)
		
		context.clearRect(0, 0, width, height);
		context.save();
		context.strokeStyle = "#71717a";
		context.fillStyle = "#71717a";
		context.lineWidth = 1;
		context.font = `${SMALL_FONT_SIZE}px ${SECONDARY_FONT}`;
		context.textBaseline = "top";

		context.translate(0.5, 0);
		context.beginPath();

		// Calculate zoom-adjusted unit width
		const zoomUnit = unit * zoom * PREVIEW_FRAME_WIDTH * 0.1; // Scale factor for display
		const minRange = Math.floor(scrollLeft / zoomUnit);
		const maxRange = Math.ceil((scrollLeft + width) / zoomUnit);
		const length = maxRange - minRange;

		// Draw text labels (time markers)
		for (let i = 0; i <= length; ++i) {
			const value = i + minRange;

			if (value < 0) continue;

			const startValue = (value * zoomUnit) / zoom;
			const startPos = (startValue - scrollLeft / zoom) * zoom;

			if (startPos < -zoomUnit || startPos >= width + zoomUnit) continue;
			
			// Convert to time in milliseconds for display
			const timeMs = value * unit;
			const text = textFormat(timeMs);

			// Calculate text positioning
			const textWidth = context.measureText(text).width;
			const textOffsetX = -textWidth / 2;

			context.fillText(text, startPos + textOffsetX + offsetX, textOffsetY);
		}

		// Draw ruler tick marks
		for (let i = 0; i <= length; ++i) {
			const value = i + minRange;

			if (value < 0) continue;

			const startValue = value * zoomUnit;
			const startPos = startValue - scrollLeft + offsetX;

			for (let j = 0; j < segments; ++j) {
				const pos = startPos + (j / segments) * zoomUnit;

				if (pos < 0 || pos >= width) continue;

				const lineSize = j % segments ? shortLineSize : longLineSize;

				// Set line color
				if (lineSize === shortLineSize) {
					context.strokeStyle = "#52525b"; // Shorter lines - lighter
				} else {
					context.strokeStyle = "#18181b"; // Major tick marks - darker
				}

				const origin = 18; // Start lines below text
				const [x1, y1] = [pos, origin];
				const [x2, y2] = [x1, y1 + lineSize];

				context.beginPath();
				context.moveTo(x1, y1);
				context.lineTo(x2, y2);
				context.stroke();
			}
		}

		context.restore();
	};

	const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const clickX = event.clientX - rect.left;

		setIsDragging(true);
		setHasDragged(false);

		dragRef.current = {
			startX: clickX,
			startScrollPos: scrollLeft,
			isDragging: true,
			hasDragged: false,
		};

		event.preventDefault();
	};

	const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const touch = event.touches[0];
		const touchX = touch.clientX - rect.left;

		setIsDragging(true);
		setHasDragged(false);

		dragRef.current = {
			startX: touchX,
			startScrollPos: scrollLeft,
			isDragging: true,
			hasDragged: false,
		};

		event.preventDefault();
	};

	const handleMouseMove = useCallback(
		(event: MouseEvent) => {
			if (!dragRef.current.isDragging) return;

			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const currentX = event.clientX - rect.left;
			const deltaX = Math.abs(dragRef.current.startX - currentX);

			if (deltaX > 5) {
				dragRef.current.hasDragged = true;
				setHasDragged(true);

				const newScrollLeft = Math.max(
					0,
					dragRef.current.startScrollPos + (dragRef.current.startX - currentX),
				);

				onScroll?.(newScrollLeft);
			}
		},
		[onScroll],
	);

	const handleTouchMove = useCallback(
		(event: TouchEvent) => {
			if (!dragRef.current.isDragging) return;

			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const touch = event.touches[0];
			const currentX = touch.clientX - rect.left;
			const deltaX = Math.abs(dragRef.current.startX - currentX);

			if (deltaX > 5) {
				dragRef.current.hasDragged = true;
				setHasDragged(true);

				const newScrollLeft = Math.max(
					0,
					dragRef.current.startScrollPos + (dragRef.current.startX - currentX),
				);

				onScroll?.(newScrollLeft);
			}
		},
		[onScroll],
	);

	const handleMouseUp = useCallback(() => {
		if (dragRef.current.isDragging) {
			dragRef.current.isDragging = false;
			dragRef.current.hasDragged = false;
			setIsDragging(false);
			setHasDragged(false);
		}
	}, []);

	const handleTouchEnd = useCallback(() => {
		if (dragRef.current.isDragging) {
			dragRef.current.isDragging = false;
			dragRef.current.hasDragged = false;
			setIsDragging(false);
			setHasDragged(false);
		}
	}, []);

	const handleLocalMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
		const wasDragging = dragRef.current.isDragging;
		const hadDragged = dragRef.current.hasDragged;

		if (wasDragging) {
			dragRef.current.isDragging = false;
			dragRef.current.hasDragged = false;
			setIsDragging(false);
			setHasDragged(false);
		}

		if (!hadDragged) {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const clickX = event.clientX - rect.left;

			// Calculate timeline position
			const totalX = clickX + scrollLeft - TIMELINE_OFFSET_CANVAS_LEFT;

			onClick?.(totalX);
		}
	};

	const handleLocalTouchEnd = (event: React.TouchEvent<HTMLCanvasElement>) => {
		const wasDragging = dragRef.current.isDragging;
		const hadDragged = dragRef.current.hasDragged;

		if (wasDragging) {
			dragRef.current.isDragging = false;
			dragRef.current.hasDragged = false;
			setIsDragging(false);
			setHasDragged(false);
		}

		if (!hadDragged) {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const touch = event.changedTouches[0];
			const touchX = touch.clientX - rect.left;

			// Calculate timeline position
			const totalX = touchX + scrollLeft - TIMELINE_OFFSET_CANVAS_LEFT;

			onClick?.(totalX);
		}
	};

	// Global drag event listeners
	useEffect(() => {
		if (isDragging) {
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			document.addEventListener("touchmove", handleTouchMove, { passive: false });
			document.addEventListener("touchend", handleTouchEnd);

			return () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
				document.removeEventListener("touchmove", handleTouchMove);
				document.removeEventListener("touchend", handleTouchEnd);
			};
		}
	}, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

	return (
		<div
			className="border-t border-border bg-muted"
			style={{
				position: "relative",
				width: "100%",
				height: `${canvasSize.height}px`,
			}}
		>
			<canvas
				onMouseDown={handleMouseDown}
				onMouseUp={handleLocalMouseUp}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleLocalTouchEnd}
				ref={canvasRef}
				height={canvasSize.height}
				style={{
					cursor: isDragging ? "grabbing" : "grab",
					width: "100%",
					display: "block",
					touchAction: "none",
				}}
			/>
		</div>
	);
};

export default AITimelineRuler;