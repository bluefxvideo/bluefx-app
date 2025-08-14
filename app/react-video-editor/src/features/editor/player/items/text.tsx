import { IText } from "@designcombo/types";
import { BaseSequence, SequenceItemOptions } from "../base-sequence";
import { calculateTextStyles } from "../styles";
import MotionText from "../motion-text";
import { useCurrentFrame } from "remotion";

// Separate component for caption text to isolate hooks
function CaptionText({ item, options }: { item: IText; options: SequenceItemOptions }) {
	const { handleTextChange, onTextBlur, fps } = options;
	const { id, details } = item as IText;
	const frame = useCurrentFrame();
	const captionSegments = (details as any).captionSegments || [];

	const currentTimeMs = (frame * 1000) / fps;
	
	// Find active caption segment
	const activeSegment = captionSegments.find((segment: any) => 
		currentTimeMs >= segment.start && currentTimeMs < segment.end
	);
	
	if (!activeSegment) {
		// No active segment - hide caption
		const children = (
			<MotionText
				key={id}
				id={id}
				content=""
				editable={false}
				onChange={handleTextChange}
				onBlur={onTextBlur}
				style={calculateTextStyles(details)}
			/>
		);
		return BaseSequence({ item, options, children });
	}

	// Word-level highlighting logic
	const words = activeSegment.words || [];
	let displayContent;

	if (words.length > 0) {
		// Create word-by-word highlighted content
		const highlightedWords = words.map((word: any, index: number) => {
			const wordStart = word.start;
			const wordEnd = word.end;
			
			let wordColor;
			if (currentTimeMs >= wordEnd) {
				// Word has been spoken - use appeared color
				wordColor = activeSegment.style?.appearedColor || (details as any).appearedColor || "#FFFFFF";
			} else if (currentTimeMs >= wordStart && currentTimeMs < wordEnd) {
				// Word is currently being spoken - use active color
				wordColor = activeSegment.style?.activeColor || (details as any).activeColor || "#00FF88";
			} else {
				// Word hasn't been spoken yet - use default color
				wordColor = activeSegment.style?.color || details.color || "#E0E0E0";
			}

			return (
				<span 
					key={index} 
					style={{ 
						color: wordColor,
						transition: 'color 0.1s ease'
					}}
				>
					{word.word}
					{index < words.length - 1 ? " " : ""}
				</span>
			);
		});

		displayContent = <span>{highlightedWords}</span>;
	} else {
		// Fallback to segment text if no word-level data
		displayContent = activeSegment.text;
	}

	const children = (
		<MotionText
			key={id}
			id={id}
			content={displayContent}
			editable={false} // Don't allow editing during caption playback
			onChange={handleTextChange}
			onBlur={onTextBlur}
			style={calculateTextStyles(details)}
		/>
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
