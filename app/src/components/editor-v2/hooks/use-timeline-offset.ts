/**
 * Hook to get timeline offset X value
 * For now, using a fixed offset - could be made responsive later
 */
export function useTimelineOffsetX(): number {
	// Fixed offset for now - matches our timeline layout
	return 200; // Approximate width of the left panel
}