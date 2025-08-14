// Ruler component based on research/react-video-editor/src/features/editor/timeline/ruler.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
	PREVIEW_FRAME_WIDTH,
	SECONDARY_FONT,
	SMALL_FONT_SIZE,
	TIMELINE_OFFSET_CANVAS_LEFT,
} from "../constants/constants";
import { formatTimelineUnit } from "../utils/format";
import useEditorStore from "../store/use-editor-store";
import { debounce } from "lodash";

interface RulerProps {
	height?: number;
	longLineSize?: number;
	shortLineSize?: number;
	offsetX?: number;
	textOffsetY?: number;
	scrollLeft?: number;
	textFormat?: (scale: number) => string;
	onClick?: (units: number) => void;
	onScroll?: (scrollLeft: number) => void;
}

const ResearchRuler = (props: RulerProps) => {
	const {
		height = 40,
		longLineSize = 8,
		shortLineSize = 10,
		offsetX = TIMELINE_OFFSET_CANVAS_LEFT,
		textOffsetY = 17,
		textFormat = formatTimelineUnit,
		scrollLeft = 0,
		onClick,
		onScroll,
	} = props;
	
	const { scale } = useEditorStore();
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
	}, [canvasContext, scrollLeft]);

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
	}, [canvasContext, scrollLeft, scale]);

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
		const zoom = scale.zoom;
		const unit = scale.unit;
		const segments = scale.segments;
		context.clearRect(0, 0, width, height);
		context.save();
		context.strokeStyle = "#71717a";
		context.fillStyle = "#71717a";
		context.lineWidth = 1;
		context.font = `${SMALL_FONT_SIZE}px ${SECONDARY_FONT}`;
		context.textBaseline = "top";

		context.translate(0.5, 0);
		context.beginPath();

		const zoomUnit = unit * zoom * PREVIEW_FRAME_WIDTH;
		const minRange = Math.floor(scrollLeft / zoomUnit);
		const maxRange = Math.ceil((scrollLeft + width) / zoomUnit);
		const length = maxRange - minRange;

		// Draw text before drawing the lines
		for (let i = 0; i <= length; ++i) {
			const value = i + minRange;

			if (value < 0) continue;

			const startValue = (value * zoomUnit) / zoom;
			const startPos = (startValue - scrollLeft / zoom) * zoom;

			if (startPos < -zoomUnit || startPos >= width + zoomUnit) continue;
			const text = textFormat(startValue);

			// Calculate the textOffsetX value
			const textWidth = context.measureText(text).width;
			const textOffsetX = -textWidth / 2;

			// Adjust textOffsetY so it stays inside the canvas but above the lines
			context.fillText(text, startPos + textOffsetX + offsetX, textOffsetY);
		}

		// Draw long and short lines after the text
		for (let i = 0; i <= length; ++i) {
			const value = i + minRange;

			if (value < 0) continue;

			const startValue = value * zoomUnit;
			const startPos = startValue - scrollLeft + offsetX;

			for (let j = 0; j < segments; ++j) {
				const pos = startPos + (j / segments) * zoomUnit;

				if (pos < 0 || pos >= width) continue;

				const lineSize = j % segments ? shortLineSize : longLineSize;

				// Set color based on line size
				if (lineSize === shortLineSize) {
					context.strokeStyle = "#52525b"; // Gray for short lines
				} else {
					context.strokeStyle = "#18181b"; // Dark for long lines
				}

				const origin = 28; // Start lines lower, below the text

				const [x1, y1] = [pos, origin];
				const [x2, y2] = [x1, y1 + lineSize];

				context.beginPath(); // Begin a new path for each line
				context.moveTo(x1, y1);
				context.lineTo(x2, y2);

				// Draw the line
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

	const handleMouseMove = useCallback(
		(event: MouseEvent) => {
			if (!dragRef.current.isDragging) return;

			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const currentX = event.clientX - rect.left;
			const deltaX = Math.abs(dragRef.current.startX - currentX);

			if (deltaX > 5) {
				if (!dragRef.current.hasDragged) {
					dragRef.current.hasDragged = true;
					setHasDragged(true);
				}

				const newScrollLeft = Math.max(
					0,
					dragRef.current.startScrollPos + (dragRef.current.startX - currentX),
				);

				onScroll?.(newScrollLeft);
			}
		},
		[onScroll]
	);

	const handleMouseUp = useCallback(() => {
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

		// Only handle click if we haven't dragged
		if (!hadDragged) {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const clickX = event.clientX - rect.left;
			const totalX = clickX + scrollLeft - offsetX;

			onClick?.(totalX);
		}
	};

	useEffect(() => {
		if (isDragging) {
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);

			return () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};
		}
	}, [isDragging, handleMouseMove, handleMouseUp]);

	return (
		<div
			className="border-b border-border/40"
			style={{
				position: "relative",
				width: "100%",
				height: `${canvasSize.height}px`,
			}}
		>
			<canvas
				onMouseDown={handleMouseDown}
				onMouseUp={handleLocalMouseUp}
				ref={canvasRef}
				height={canvasSize.height}
				style={{
					cursor: isDragging ? "grabbing" : "grab",
					display: "block",
					width: "100%",
					height: `${height}px`,
				}}
			/>
		</div>
	);
};

export default ResearchRuler;