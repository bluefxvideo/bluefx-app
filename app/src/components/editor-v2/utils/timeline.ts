import { PREVIEW_FRAME_WIDTH } from "../constants/constants";

const FRAME_INTERVAL = 1000 / 60; // 60 FPS

/**
 * Convert time in milliseconds to timeline units based on zoom level
 * @param timeMs - Time in milliseconds
 * @param zoom - Current zoom level (default: 1)
 * @returns Position in timeline units
 */
export function timeMsToUnits(timeMs: number, zoom = 1): number {
	const zoomedFrameWidth = PREVIEW_FRAME_WIDTH * zoom;
	const frames = timeMs * (60 / 1000);
	return frames * zoomedFrameWidth;
}

/**
 * Convert timeline units to time in milliseconds based on zoom level
 * @param units - Position in timeline units
 * @param zoom - Current zoom level (default: 1)
 * @returns Time in milliseconds
 */
export function unitsToTimeMs(units: number, zoom = 1): number {
	const zoomedFrameWidth = PREVIEW_FRAME_WIDTH * zoom;
	const frames = units / zoomedFrameWidth;
	return frames * FRAME_INTERVAL;
}

/**
 * Calculate the total timeline width for a given duration
 * @param totalLengthMs - Total timeline duration in milliseconds
 * @param zoom - Current zoom level (default: 1)
 * @returns Timeline width in units
 */
export function calculateTimelineWidth(totalLengthMs: number, zoom = 1): number {
	return timeMsToUnits(totalLengthMs, zoom);
}