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
	const relativeTimeMs = globalTimeMs - trackStartMs;
	
	// Use relative time for caption segments
	const currentTimeMs = relativeTimeMs;
	
	// Find active caption segment
	const activeSegment = captionSegments.find((segment: any) => 
		currentTimeMs >= segment.start && currentTimeMs < segment.end
	);
	
	// Debug logging
	if (frame % 30 === 0 && captionSegments.length > 0) {
		console.log('Caption Text Debug:', {
			currentTimeMs,
			trackStartMs,
			relativeTimeMs,
			firstSegment: captionSegments[0],
			activeSegment: activeSegment ? { text: activeSegment.text.substring(0, 20), start: activeSegment.start, end: activeSegment.end } : null
		});
		
		// Debug word timing if we have an active segment
		if (activeSegment && activeSegment.words?.length > 0) {
			const firstWord = activeSegment.words[0];
			const wordStartMs = firstWord.start * 1000;
			const wordEndMs = firstWord.end * 1000;
			console.log('Word Debug - Time:', currentTimeMs, 'First word:', JSON.stringify({
				word: firstWord.word,
				startSeconds: firstWord.start,
				endSeconds: firstWord.end,
				startMs: wordStartMs,
				endMs: wordEndMs,
				isActive: currentTimeMs >= wordStartMs && currentTimeMs < wordEndMs,
				hasEnded: currentTimeMs >= wordEndMs
			}));
		}
	}
	
	if (!activeSegment) {
		// No active segment - hide caption completely (no background)
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
					backgroundColor: "transparent", // No background when no segment
					padding: "0px", // No padding when no segment
				}}
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
			// Word timing is already in milliseconds from caption generator
			const wordStart = word.start;
			const wordEnd = word.end;
			
			let wordColor;
			if (currentTimeMs >= wordEnd) {
				// Word has been spoken - use appeared color (white)
				wordColor = activeSegment.style?.appearedColor || (details as any).appearedColor || "#FFFFFF";
			} else if (currentTimeMs >= wordStart && currentTimeMs < wordEnd) {
				// Word is currently being spoken - use active color (bright yellow)
				wordColor = activeSegment.style?.activeColor || (details as any).activeColor || "#FFEB3B";
			} else {
				// Word hasn't been spoken yet - use default color (white)
				wordColor = activeSegment.style?.color || details.color || "#FFFFFF";
			}

			return (
				<span 
					key={index} 
					style={{ 
						color: wordColor,
						transition: 'color 0.15s ease',
						textTransform: 'uppercase', // Make text uppercase like in screenshots
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

	// Custom styles for captions - Professional look matching screenshots
	const captionStyles = {
		...calculateTextStyles(details),
		// Apply caption-specific styles with stronger shadow and outline
		textShadow: (details as any).textShadowEnabled !== false 
			? "0 0 15px rgba(0, 0, 0, 1), 0 0 30px rgba(0, 0, 0, 1), 0 0 45px rgba(0, 0, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1)" 
			: "none",
		WebkitTextStroke: "4px black", // Stronger black outline like in screenshots
		paintOrder: "stroke fill", // Stroke behind fill
		backgroundColor: "transparent", // No background box
		padding: "0", // No padding
		borderRadius: "0", // No border radius
		display: "inline-block",
		margin: "0 auto",
		lineHeight: "1.1",
		textAlign: details.textAlign || "center",
		maxWidth: "90%",
		width: "fit-content",
		fontSize: details.fontSize || 80, // Professional caption size
		fontWeight: "900", // Extra bold like in screenshots
		fontFamily: details.fontFamily || "Inter, sans-serif",
		letterSpacing: "-0.02em", // Tighter letter spacing
		textTransform: "uppercase", // All caps like in screenshots
	};

	const children = (
		<MotionText
			key={id}
			id={id}
			content={displayContent}
			editable={false} // Don't allow editing during caption playback
			onChange={handleTextChange}
			onBlur={onTextBlur}
			style={captionStyles}
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
