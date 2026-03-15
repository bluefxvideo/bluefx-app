import { IImage } from "@designcombo/types";
import { BaseSequence, SequenceItemOptions } from "../base-sequence";
import { calculateMediaStyles } from "../styles";
import { calculateFrames } from "../../utils/frames";
import { Img, useCurrentFrame, interpolate, Easing } from "remotion";
import { calculateKenBurnsTransform, KenBurnsConfig } from "../../effects/ken-burns";

export default function Image({
	item,
	options,
}: {
	item: IImage;
	options: SequenceItemOptions;
}) {
	const { fps, fadeInFrames = 0 } = options;
	const { details, metadata } = item;
	const crop = details?.crop || {
		x: 0,
		y: 0,
		width: details.width,
		height: details.height,
	};
	const { durationInFrames } = calculateFrames(item.display, fps);

	const children = (
		<ImageWithKenBurns
			item={item}
			details={details}
			crop={crop}
			metadata={metadata}
			durationInFrames={durationInFrames}
			fadeInFrames={fadeInFrames}
		/>
	);

	return BaseSequence({ item, options, children });
}

function ImageWithKenBurns({
	item,
	details,
	crop,
	metadata,
	durationInFrames,
	fadeInFrames = 0,
}: {
	item: IImage;
	details: any;
	crop: any;
	metadata: any;
	durationInFrames: number;
	fadeInFrames?: number;
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

	// Crossfade: fade in over the first N frames
	let opacity = 1;
	if (fadeInFrames > 0 && frame < fadeInFrames) {
		opacity = interpolate(frame, [0, fadeInFrames], [0, 1], {
			extrapolateRight: 'clamp',
			easing: Easing.ease,
		});
	}

	// Merge Ken Burns transform with existing styles
	const mediaStyles = calculateMediaStyles(details, crop);
	const hasKenBurns = kenBurnsConfig.preset !== 'none';

	return (
		<div style={{ ...mediaStyles, overflow: 'hidden', opacity }}>
			<Img
				data-id={item.id}
				src={details.src}
				style={{
					width: '100%',
					height: '100%',
					objectFit: 'cover',
					position: 'absolute',
					top: 0,
					left: 0,
					...(hasKenBurns && {
						transform: kenBurnsTransform.transform,
						transformOrigin: 'center center',
					}),
				}}
			/>
		</div>
	);
}
