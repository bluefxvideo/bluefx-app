import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import React, { useEffect, useState } from "react";
import { IText, ITrackItem } from "@designcombo/types";
import { Subtitles, Palette, Type, Eye, Zap, CornerDownRight } from "lucide-react";

interface ICaptionControlProps {
	baseColor: string;        // Main caption text color
	highlightColor: string;   // Color for highlighted words
	backgroundColor: string;
	fontSize: number;
	opacity: number;
	fontFamily: string;
	textShadow: boolean;      // Enable/disable text shadow
	borderRadius: number;     // Background border radius
	padding: number;          // Background padding
}

const BasicCaption = ({
	trackItem,
}: {
	trackItem: ITrackItem & IText;
}) => {
	const [properties, setProperties] = useState<ICaptionControlProps>({
		baseColor: "#FFFFFF",
		highlightColor: "#00FF88",
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		fontSize: 48,
		opacity: 1,
		fontFamily: "Inter",
		textShadow: true,
		borderRadius: 8,
		padding: 16,
	});

	// Check if this is actually a caption track
	const isCaptionTrack = (trackItem.details as any)?.isCaptionTrack;

	useEffect(() => {
		if (!isCaptionTrack) return;

		// Get actual colors from the track item details
		setProperties({
			baseColor: (trackItem.details as any)?.appearedColor || "#FFFFFF",
			highlightColor: (trackItem.details as any)?.activeColor || "#00FF88",
			backgroundColor: trackItem.details.backgroundColor || "rgba(0, 0, 0, 0.7)",
			fontSize: trackItem.details.fontSize || 48,
			opacity: trackItem.details.opacity || 1,
			fontFamily: trackItem.details.fontFamily || "Inter",
			textShadow: (trackItem.details as any)?.textShadowEnabled !== false,
			borderRadius: (trackItem.details as any)?.borderRadius || 8,
			padding: (trackItem.details as any)?.padding || 16,
		});
	}, [trackItem.id, isCaptionTrack]);

	const handleBaseColorChange = (color: string) => {
		setProperties(prev => ({ ...prev, baseColor: color }));
		
		// Update both track item details AND segment styles
		const updatedSegments = (trackItem.details as any)?.captionSegments?.map((segment: any) => ({
			...segment,
			style: {
				...segment.style,
				appearedColor: color
			}
		}));

		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					details: { 
						appearedColor: color,
						captionSegments: updatedSegments
					}
				}
			}
		});
	};

	const handleHighlightColorChange = (color: string) => {
		setProperties(prev => ({ ...prev, highlightColor: color }));
		
		// Update both track item details AND segment styles
		const updatedSegments = (trackItem.details as any)?.captionSegments?.map((segment: any) => ({
			...segment,
			style: {
				...segment.style,
				activeColor: color
			}
		}));

		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					details: { 
						activeColor: color,
						captionSegments: updatedSegments
					}
				}
			}
		});
	};

	const handleBackgroundColorChange = (color: string) => {
		setProperties(prev => ({ ...prev, backgroundColor: color }));
		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					details: { backgroundColor: color }
				}
			}
		});
	};

	const handleFontSizeChange = (fontSize: number) => {
		setProperties(prev => ({ ...prev, fontSize }));
		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					details: { fontSize }
				}
			}
		});
	};

	const handleOpacityChange = (opacity: number) => {
		setProperties(prev => ({ ...prev, opacity }));
		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					details: { opacity }
				}
			}
		});
	};

	const handleTextShadowToggle = (enabled: boolean) => {
		setProperties(prev => ({ ...prev, textShadow: enabled }));
		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					details: { textShadowEnabled: enabled }
				}
			}
		});
	};

	const handleBorderRadiusChange = (borderRadius: number) => {
		setProperties(prev => ({ ...prev, borderRadius }));
		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					details: { borderRadius }
				}
			}
		});
	};

	const handlePaddingChange = (padding: number) => {
		setProperties(prev => ({ ...prev, padding }));
		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					details: { padding }
				}
			}
		});
	};

	if (!isCaptionTrack) {
		return <div>This is not a caption track</div>;
	}

	return (
		<div className="flex lg:h-[calc(100vh-58px)] flex-1 flex-col overflow-hidden min-h-[340px]">
			<ScrollArea className="h-full">
				<div className="flex flex-col gap-4 px-4 py-4">
					{/* Header */}
					<div className="flex items-center gap-2 pb-2 border-b">
						<Subtitles className="h-4 w-4" />
						<h3 className="font-medium">Caption Styling</h3>
					</div>

					{/* Base Text Color */}
					<Card className="p-4">
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<Type className="h-4 w-4" />
								<h4 className="text-sm font-medium">Base Text Color</h4>
							</div>
							<div className="flex items-center gap-2">
								<input
									type="color"
									value={properties.baseColor}
									onChange={(e) => handleBaseColorChange(e.target.value)}
									className="w-8 h-8 rounded border cursor-pointer"
								/>
								<input
									type="text"
									value={properties.baseColor}
									onChange={(e) => handleBaseColorChange(e.target.value)}
									className="flex-1 text-sm p-2 border rounded"
									placeholder="#FFFFFF"
								/>
							</div>
							<p className="text-xs text-muted-foreground">
								Default color for caption text
							</p>
						</div>
					</Card>

					{/* Highlight Color */}
					<Card className="p-4">
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<Palette className="h-4 w-4" />
								<h4 className="text-sm font-medium">Highlight Color</h4>
							</div>
							<div className="flex items-center gap-2">
								<input
									type="color"
									value={properties.highlightColor}
									onChange={(e) => handleHighlightColorChange(e.target.value)}
									className="w-8 h-8 rounded border cursor-pointer"
								/>
								<input
									type="text"
									value={properties.highlightColor}
									onChange={(e) => handleHighlightColorChange(e.target.value)}
									className="flex-1 text-sm p-2 border rounded"
									placeholder="#00FF88"
								/>
							</div>
							<p className="text-xs text-muted-foreground">
								Color for highlighting current word
							</p>
						</div>
					</Card>

					{/* Background */}
					<Card className="p-4">
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<Palette className="h-4 w-4" />
								<h4 className="text-sm font-medium">Background</h4>
							</div>
							<div className="flex items-center gap-2">
								<input
									type="color"
									value={properties.backgroundColor.includes('rgba') ? '#000000' : properties.backgroundColor}
									onChange={(e) => handleBackgroundColorChange(e.target.value)}
									className="w-8 h-8 rounded border cursor-pointer"
								/>
								<input
									type="text"
									value={properties.backgroundColor}
									onChange={(e) => handleBackgroundColorChange(e.target.value)}
									className="flex-1 text-sm p-2 border rounded"
									placeholder="rgba(0, 0, 0, 0.7)"
								/>
							</div>
							<div className="flex gap-2">
								<Button 
									size="sm" 
									variant="outline" 
									onClick={() => handleBackgroundColorChange('transparent')}
									className="text-xs"
								>
									None
								</Button>
								<Button 
									size="sm" 
									variant="outline" 
									onClick={() => handleBackgroundColorChange('rgba(0, 0, 0, 0.7)')}
									className="text-xs"
								>
									Dark
								</Button>
								<Button 
									size="sm" 
									variant="outline" 
									onClick={() => handleBackgroundColorChange('rgba(255, 255, 255, 0.9)')}
									className="text-xs"
								>
									Light
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								Background behind caption text
							</p>
						</div>
					</Card>

					{/* Font Size */}
					<Card className="p-4">
						<div className="space-y-3">
							<h4 className="text-sm font-medium">Font Size</h4>
							<div className="flex items-center gap-2">
								<input
									type="range"
									min="24"
									max="120"
									value={properties.fontSize}
									onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
									className="flex-1"
								/>
								<span className="text-sm font-mono w-12 text-right">
									{properties.fontSize}px
								</span>
							</div>
						</div>
					</Card>

					{/* Opacity */}
					<Card className="p-4">
						<div className="space-y-3">
							<h4 className="text-sm font-medium">Opacity</h4>
							<div className="flex items-center gap-2">
								<input
									type="range"
									min="0"
									max="1"
									step="0.1"
									value={properties.opacity}
									onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
									className="flex-1"
								/>
								<span className="text-sm font-mono w-12 text-right">
									{Math.round(properties.opacity * 100)}%
								</span>
							</div>
						</div>
					</Card>

					{/* Text Shadow */}
					<Card className="p-4">
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Zap className="h-4 w-4" />
									<h4 className="text-sm font-medium">Text Shadow</h4>
								</div>
								<Button
									size="sm"
									variant={properties.textShadow ? "default" : "outline"}
									onClick={() => handleTextShadowToggle(!properties.textShadow)}
									className="text-xs"
								>
									{properties.textShadow ? "On" : "Off"}
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								Add shadow or stroke to text for better readability
							</p>
						</div>
					</Card>

					{/* Background Padding */}
					<Card className="p-4">
						<div className="space-y-3">
							<h4 className="text-sm font-medium">Background Padding</h4>
							<div className="flex items-center gap-2">
								<input
									type="range"
									min="0"
									max="40"
									value={properties.padding}
									onChange={(e) => handlePaddingChange(parseInt(e.target.value))}
									className="flex-1"
								/>
								<span className="text-sm font-mono w-12 text-right">
									{properties.padding}px
								</span>
							</div>
							<p className="text-xs text-muted-foreground">
								Space around text inside background
							</p>
						</div>
					</Card>

					{/* Border Radius */}
					<Card className="p-4">
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<CornerDownRight className="h-4 w-4" />
								<h4 className="text-sm font-medium">Border Radius</h4>
							</div>
							<div className="flex items-center gap-2">
								<input
									type="range"
									min="0"
									max="20"
									value={properties.borderRadius}
									onChange={(e) => handleBorderRadiusChange(parseInt(e.target.value))}
									className="flex-1"
								/>
								<span className="text-sm font-mono w-12 text-right">
									{properties.borderRadius}px
								</span>
							</div>
							<p className="text-xs text-muted-foreground">
								Rounded corners for background
							</p>
						</div>
					</Card>

					{/* Caption Info */}
					<Card className="p-4 bg-muted/50">
						<div className="space-y-2">
							<h4 className="text-sm font-medium">Caption Info</h4>
							<div className="text-xs text-muted-foreground space-y-1">
								<p>• Segments: {(trackItem.details as any)?.captionSegments?.length || 0}</p>
								<p>• Font: {properties.fontFamily}</p>
								<p>• Type: Caption Track</p>
							</div>
						</div>
					</Card>
				</div>
			</ScrollArea>
		</div>
	);
};

export default BasicCaption;