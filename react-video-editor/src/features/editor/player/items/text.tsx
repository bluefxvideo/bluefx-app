import { IText } from "@designcombo/types";
import { BaseSequence, SequenceItemOptions } from "../base-sequence";
import { calculateTextStyles } from "../styles";
import MotionText from "../motion-text";
import { useCurrentFrame } from "remotion";

// Separate component for caption text to isolate hooks
function CaptionText({ item, options }: { item: IText; options: SequenceItemOptions }) {
	const { handleTextChange, onTextBlur, fps } = options;
	const { id, details, display } = item as IText;
	const frame = useCurrentFrame();
	const captionSegments = (details as any).captionSegments || [];

	// Calculate relative time based on the text track's position in timeline
	const trackStartMs = display?.from || 0;
	const globalTimeMs = (frame * 1000) / fps;
	const currentTimeMs = globalTimeMs - trackStartMs;

	// Find active caption segment
	const activeSegment = captionSegments.find((segment: any) =>
		currentTimeMs >= segment.start && currentTimeMs < segment.end
	);

	if (!activeSegment) {
		const children = (
			<MotionText
				key={id}
				id={id}
				content=""
				editable={false}
				onChange={handleTextChange}
				onBlur={onTextBlur}
				style={{
					...calculateTextStyles(details),
					backgroundColor: "transparent",
					padding: "0px",
				}}
			/>
		);
		return BaseSequence({ item, options, children });
	}

	// Word-level highlighting
	const words = activeSegment.words || [];
	const fontSize = details.fontSize || 80;

	const wordElements = words.length > 0
		? words.map((word: any, index: number) => {
			let wordColor;
			if (currentTimeMs >= word.end) {
				wordColor = activeSegment.style?.appearedColor || (details as any).appearedColor || "#FFFFFF";
			} else if (currentTimeMs >= word.start && currentTimeMs < word.end) {
				wordColor = activeSegment.style?.activeColor || (details as any).activeColor || "#FACC15";
			} else {
				wordColor = activeSegment.style?.color || details.color || "#FFFFFF";
			}
			return (
				<span key={index} style={{ color: wordColor }}>
					{word.word}{index < words.length - 1 ? " " : ""}
				</span>
			);
		})
		: null;

	// Render caption directly (bypass MotionText which forces width:100%)
	const children = (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<div
				style={{
					backgroundColor: details.backgroundColor || "rgba(0, 0, 0, 0.75)",
					padding: `${fontSize * 0.25}px ${fontSize * 0.55}px`,
					borderRadius: `${fontSize * 0.25}px`,
					lineHeight: "1.3",
					textAlign: "center" as const,
					fontSize: fontSize,
					fontWeight: "800",
					fontFamily: details.fontFamily || "Inter, sans-serif",
					letterSpacing: "0.02em",
					wordSpacing: "0.08em",
					color: details.color || "#FFFFFF",
					maxWidth: "95%",
				}}
			>
				{wordElements ? <span>{wordElements}</span> : activeSegment.text}
			</div>
		</div>
	);
	return BaseSequence({ item, options, children });
}

export default function Text({
	item,
	options,
}: {
	item: IText;
	options: SequenceItemOptions;
}) {
	const { handleTextChange, onTextBlur, editableTextId } = options;
	const { id, details } = item as IText;

	// Check if this is a caption track (stored in details)
	const isCaptionTrack = !!(details as any).isCaptionTrack;
	const captionSegments = (details as any).captionSegments;
	
	// Use separate component for captions to isolate useCurrentFrame hook
	if (isCaptionTrack) {
		return <CaptionText item={item} options={options} />;
	}

	// Regular text rendering (no hooks issues)
	const children = (
		<MotionText
			key={id}
			id={id}
			content={details.text}
			editable={editableTextId === id}
			onChange={handleTextChange}
			onBlur={onTextBlur}
			style={calculateTextStyles(details)}
		/>
	);
	return BaseSequence({ item, options, children });
}
