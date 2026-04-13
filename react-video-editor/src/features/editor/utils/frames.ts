export const calculateFrames = (
	display: { from: number; to: number },
	fps: number,
) => {
	const from = (display.from / 1000) * fps;
	// Clamp to minimum 1 frame to prevent Remotion crash on invalid/corrupt items
	const durationInFrames = Math.max(1, Math.round((display.to / 1000) * fps - from));
	return { from: Math.round(from), durationInFrames };
};
