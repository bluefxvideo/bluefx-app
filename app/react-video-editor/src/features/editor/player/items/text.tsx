import { IText } from "@designcombo/types";
import { BaseSequence, SequenceItemOptions } from "../base-sequence";
import { calculateTextStyles } from "../styles";
import MotionText from "../motion-text";
import { useCurrentFrame } from "remotion";

// Separate component for caption text to isolate hooks
function CaptionText({ item, options }: { item: IText; options: SequenceItemOptions }) {
	const { handleTextChange, onTextBlur, fps, editableTextId } = options;
	const { id, details } = item as IText;
	const frame = useCurrentFrame();
	const captionMetadata = (item as any).caption_metadata;

	let displayText = details.text;
	const currentTimeMs = (frame * 1000) / fps;
	
	// Find active caption segment
	const activeSegment = captionMetadata?.segments?.find((segment: any) => 
		currentTimeMs >= segment.start && currentTimeMs < segment.end
	);
	
	if (activeSegment) {
		displayText = activeSegment.text;
	} else {
		displayText = "";
	}

	const children = (
		<MotionText
			key={id}
			id={id}
			content={displayText}
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

	// Check if this is a caption track (has itemSubtype: "caption")
	const itemSubtype = (item as any).itemSubtype;

	// Use separate component for captions to isolate useCurrentFrame hook
	if (itemSubtype === "caption") {
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
