import { IImage, IText, ITrackItem } from "@designcombo/types";

export const calculateCropStyles = (
	details: IImage["details"],
	crop: IImage["details"]["crop"],
) => ({
	width: details.width || "100%",
	height: details.height || "auto",
	top: -crop.y || 0,
	left: -crop.x || 0,
	position: "absolute",
	borderRadius: `${Math.min(crop.width, crop.height) * ((details.borderRadius || 0) / 100)}px`,
});

export const calculateMediaStyles = (
	details: ITrackItem["details"],
	crop: ITrackItem["details"]["crop"],
) => {
	return {
		pointerEvents: "none",
		boxShadow: [
			`0 0 0 ${details.borderWidth}px ${details.borderColor}`,
			details.boxShadow
				? `${details.boxShadow.x}px ${details.boxShadow.y}px ${details.boxShadow.blur}px ${details.boxShadow.color}`
				: "",
		]
			.filter(Boolean)
			.join(", "),
		...calculateCropStyles(details, crop),
		overflow: "hidden",
	} as React.CSSProperties;
};

export const calculateTextStyles = (
	details: IText["details"],
): React.CSSProperties => {
	return ({
	position: "relative",
	textDecoration: details.textDecoration || "none",
	WebkitTextStroke: `${details.borderWidth}px ${details.borderColor}`, // Outline/stroke color and thickness
	paintOrder: "stroke fill", // Order of painting
	textShadow: details.boxShadow
		? `${details.boxShadow.x}px ${details.boxShadow.y}px ${details.boxShadow.blur}px ${details.boxShadow.color}`
		: "",
	fontFamily: details.fontFamily || "Arial",
	fontWeight: details.fontWeight || "normal",
	lineHeight: details.lineHeight || "normal",
	letterSpacing: details.letterSpacing || "normal",
	wordSpacing: details.wordSpacing || "normal",
	wordWrap: details.wordWrap || "",
	wordBreak: details.wordBreak || "normal",
	textTransform: details.textTransform || "none",
	fontSize: details.fontSize || "16px",
	textAlign: details.textAlign || "left",
	color: details.color || "#000000",
	backgroundColor: details.backgroundColor || "transparent",
	borderRadius: `${Math.min(details.width, details.height) * ((details.borderRadius || 0) / 100)}px`,
});};

const parsePosition = (value: string | number | undefined): number | string => {
	if (value === undefined || value === null) return 0;
	if (typeof value === "number") return value;
	// Preserve percentage values (e.g. '75%' for caption positioning)
	if (value.includes('%')) return value;
	// Preserve px values as numbers
	const parsed = parseFloat(value);
	return isNaN(parsed) ? 0 : parsed;
};

export const calculateContainerStyles = (
	details: ITrackItem["details"],
	crop: ITrackItem["details"]["crop"] = {},
	overrides: React.CSSProperties = {},
): React.CSSProperties => {
	const hasExplicitPosition = details.top !== undefined || details.left !== undefined;
	return {
		pointerEvents: "auto",
		top: parsePosition(details.top),
		left: parsePosition(details.left),
		// Unset right/bottom when we have explicit positioning to prevent
		// AbsoluteFill defaults (right:0, bottom:0) from fighting with our top/left/width/height
		...(hasExplicitPosition ? { right: "unset", bottom: "unset" } : {}),
		width: crop.width || details.width || "100%",
		height: crop.height || details.height || "auto",
		transform: details.transform || "none",
		opacity: details.opacity !== undefined ? details.opacity / 100 : 1,
		transformOrigin: details.transformOrigin || "center center",
		filter: `brightness(${details.brightness}%) blur(${details.blur}px)`,
		rotate: details.rotate || "0deg",
		...overrides, // Merge overrides into the calculated styles
	};
};
