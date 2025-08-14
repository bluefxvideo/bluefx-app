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

	// Create separate boxes with content-fitted widths
	const renderCaptionWithFittedLineBackgrounds = () => {
		// If no background, use simple rendering
		if (!details.backgroundColor || details.backgroundColor === "transparent") {
			const simpleStyles = {
				...calculateTextStyles(details),
				textShadow: (details as any).textShadowEnabled !== false 
					? "2px 2px 4px rgba(0, 0, 0, 0.8)" 
					: "none",
			};
			
			return (
				<MotionText
					key={id}
					id={id}
					content={displayContent}
					editable={false}
					onChange={handleTextChange}
					onBlur={onTextBlur}
					style={simpleStyles}
				/>
			);
		}

		// For backgrounds, create individual line elements that fit their content
		const textContent = typeof displayContent === 'string' ? displayContent : displayContent?.props?.children || '';
		
		// Base styles for each line
		const lineStyles = {
			display: "inline-block",
			background: details.backgroundColor,
			padding: `${Math.floor(((details as any).padding || 16) * 0.4)}px ${(details as any).padding || 16}px`,
			borderRadius: `${(details as any).borderRadius || 8}px`,
			margin: "2px 0",
			lineHeight: "1.2",
			textShadow: (details as any).textShadowEnabled !== false 
				? "2px 2px 4px rgba(0, 0, 0, 0.8)" 
				: "none",
			fontSize: details.fontSize || "16px",
			fontFamily: details.fontFamily || "Arial",
			color: details.color || "#000000",
			textAlign: details.textAlign || "center",
			// KEY: Make each box fit its content width
			width: "fit-content",
			minWidth: "auto",
		};

		const containerStyles = {
			display: "flex",
			flexDirection: "column" as const,
			alignItems: "center",
			gap: "2px",
		};

		// If it's a complex display content with spans (word highlighting), handle it specially
		if (typeof displayContent !== 'string') {
			// Extract the actual text content from the spans to do proper line breaking
			let textForBreaking = '';
			if (displayContent && displayContent.props && displayContent.props.children) {
				const children = displayContent.props.children;
				if (Array.isArray(children)) {
					textForBreaking = children.map(child => 
						typeof child === 'string' ? child : child.props?.children || ''
					).join('');
				} else {
					textForBreaking = typeof children === 'string' ? children : '';
				}
			}

			// If we got text, split it into lines and recreate the highlighting
			if (textForBreaking) {
				const wordsArray = textForBreaking.split(' ');
				const lines = [];
				let currentLine = [];
				const maxCharactersPerLine = 25;

				for (let i = 0; i < wordsArray.length; i++) {
					const testLine = [...currentLine, wordsArray[i]].join(' ');
					
					if (testLine.length > maxCharactersPerLine && currentLine.length > 0) {
						lines.push(currentLine.join(' '));
						currentLine = [wordsArray[i]];
					} else {
						currentLine.push(wordsArray[i]);
					}
					
					if (i === wordsArray.length - 1) {
						lines.push(currentLine.join(' '));
					}
				}

				// For now, render each line with the original highlighting (simplified)
				return (
					<div style={containerStyles}>
						{lines.map((line, index) => (
							<span key={index} style={lineStyles}>
								{line}
							</span>
						))}
					</div>
				);
			}

			// Fallback: render as single line
			return (
				<div style={containerStyles}>
					<span style={lineStyles}>
						{displayContent}
					</span>
				</div>
			);
		}

		// For simple text, split more naturally to create properly sized lines
		const wordsArray = textContent.split(' ');
		const lines = [];
		let currentLine = [];
		const maxCharactersPerLine = 25; // Character-based limit instead of word-based

		for (let i = 0; i < wordsArray.length; i++) {
			const testLine = [...currentLine, wordsArray[i]].join(' ');
			
			// If adding this word would exceed the character limit, start a new line
			if (testLine.length > maxCharactersPerLine && currentLine.length > 0) {
				lines.push(currentLine.join(' '));
				currentLine = [wordsArray[i]];
			} else {
				currentLine.push(wordsArray[i]);
			}
			
			// If it's the last word, add the remaining line
			if (i === wordsArray.length - 1) {
				lines.push(currentLine.join(' '));
			}
		}

		return (
			<div style={containerStyles}>
				{lines.map((line, index) => (
					<span key={index} style={lineStyles}>
						{line}
					</span>
				))}
			</div>
		);
	};

	const children = renderCaptionWithFittedLineBackgrounds();
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
