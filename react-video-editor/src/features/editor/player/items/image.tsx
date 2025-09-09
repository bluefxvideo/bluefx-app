import { IImage } from "@designcombo/types";
import { BaseSequence, SequenceItemOptions } from "../base-sequence";
import { calculateMediaStyles } from "../styles";
import { calculateFrames } from "../../utils/frames";
import { Img } from "remotion";

export default function Image({
	item,
	options,
}: {
	item: IImage;
	options: SequenceItemOptions;
}) {
	const { fps } = options;
	const { details, animations, metadata } = item;
	const crop = details?.crop || {
		x: 0,
		y: 0,
		width: details.width,
		height: details.height,
	};
	const { durationInFrames } = calculateFrames(item.display, fps);

	// Pass Ken Burns config to be applied in the component
	const children = (
		<ImageWithKenBurns 
			item={item}
			details={details}
			crop={crop}
			metadata={metadata}
			durationInFrames={durationInFrames}
		/>
	);

	return BaseSequence({ item, options, children });
}

// Separate component to use hooks properly
import { useCurrentFrame } from "remotion";
import { calculateKenBurnsTransform, KenBurnsConfig } from "../../effects/ken-burns";

function ImageWithKenBurns({ 
	item, 
	details, 
	crop, 
	metadata,
	durationInFrames 
}: { 
	item: IImage;
	details: any;
	crop: any;
	metadata: any;
	durationInFrames: number;
}) {
	const frame = useCurrentFrame();
	
	// Get Ken Burns configuration from metadata
	const kenBurnsConfig: KenBurnsConfig = metadata?.kenBurns || {
		preset: 'none',
		intensity: 20,
		smoothness: 'ease-in-out'
	};
	
	// Calculate Ken Burns transform
	const kenBurnsTransform = calculateKenBurnsTransform(
		frame,
		durationInFrames,
		kenBurnsConfig
	);
	
	// Merge Ken Burns transform with existing styles
	const mediaStyles = {
		...calculateMediaStyles(details, crop),
		// Apply Ken Burns transform if active
		...(kenBurnsConfig.preset !== 'none' && {
			transform: kenBurnsTransform.transform,
			transformOrigin: 'center center'
		})
	};

	return (
		<div style={mediaStyles}>
			{/* image layer */}
			<Img 
				data-id={item.id} 
				src={details.src}
				style={{
					width: '100%',
					height: '100%',
					objectFit: 'cover',
					position: 'absolute',
					top: 0,
					left: 0
				}}
			/>
		</div>
	);
}
