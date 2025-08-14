// Copied directly from research/react-video-editor/src/features/editor/control-item/control-item.tsx
import React from "react";
import {
	IAudio,
	IImage,
	IText,
	ITrackItem,
	ITrackItemAndDetails,
	IVideo,
} from "@designcombo/types";
import { useEffect, useState } from "react";
import { LassoSelect } from "lucide-react";
import useEditorStore from "../store/use-editor-store";

// We'll create basic property components for now
const BasicText = ({ trackItem }: { trackItem: ITrackItem & IText }) => {
	const details = trackItem.details;
	return (
		<div className="p-4 space-y-4">
			<h3 className="font-semibold">Text Properties</h3>
			<div>
				<label className="text-sm font-medium">Text</label>
				<div className="mt-1 text-sm text-muted-foreground">{details.text}</div>
			</div>
			<div>
				<label className="text-sm font-medium">Font Size</label>
				<div className="mt-1 text-sm text-muted-foreground">{details.fontSize}px</div>
			</div>
			<div>
				<label className="text-sm font-medium">Color</label>
				<div className="mt-1 text-sm text-muted-foreground">{details.color}</div>
			</div>
		</div>
	);
};

const BasicImage = ({ trackItem }: { trackItem: ITrackItem & IImage }) => {
	const details = trackItem.details;
	return (
		<div className="p-4 space-y-4">
			<h3 className="font-semibold">Image Properties</h3>
			<div>
				<label className="text-sm font-medium">Source</label>
				<div className="mt-1 text-sm text-muted-foreground break-all">{details.src}</div>
			</div>
			<div>
				<label className="text-sm font-medium">Size</label>
				<div className="mt-1 text-sm text-muted-foreground">{details.width} × {details.height}</div>
			</div>
		</div>
	);
};

const BasicVideo = ({ trackItem }: { trackItem: ITrackItem & IVideo }) => {
	const details = trackItem.details;
	return (
		<div className="p-4 space-y-4">
			<h3 className="font-semibold">Video Properties</h3>
			<div>
				<label className="text-sm font-medium">Source</label>
				<div className="mt-1 text-sm text-muted-foreground break-all">{details.src}</div>
			</div>
			<div>
				<label className="text-sm font-medium">Volume</label>
				<div className="mt-1 text-sm text-muted-foreground">{Math.round((details.volume || 1) * 100)}%</div>
			</div>
		</div>
	);
};

const BasicAudio = ({ trackItem }: { trackItem: ITrackItem & IAudio }) => {
	const details = trackItem.details;
	return (
		<div className="p-4 space-y-4">
			<h3 className="font-semibold">Audio Properties</h3>
			<div>
				<label className="text-sm font-medium">Source</label>
				<div className="mt-1 text-sm text-muted-foreground break-all">{details.src}</div>
			</div>
			<div>
				<label className="text-sm font-medium">Volume</label>
				<div className="mt-1 text-sm text-muted-foreground">{Math.round((details.volume || 1) * 100)}%</div>
			</div>
		</div>
	);
};

const Container = ({ children }: { children: React.ReactNode }) => {
	const { activeIds, trackItemsMap, transitionsMap } = useEditorStore();
	const [trackItem, setTrackItem] = useState<ITrackItem | null>(null);

	useEffect(() => {
		console.log('ControlItem activeIds changed:', activeIds);
		console.log('ControlItem trackItemsMap:', Object.keys(trackItemsMap));
		
		if (activeIds.length === 1) {
			const [id] = activeIds;
			const trackItem = trackItemsMap[id];
			if (trackItem) {
				console.log('ControlItem selected item:', trackItem);
				setTrackItem(trackItem);
			} else {
				console.log('ControlItem: item not found in trackItemsMap for id:', id);
				console.log(transitionsMap[id]);
				setTrackItem(null);
			}
		} else {
			setTrackItem(null);
		}
	}, [activeIds, trackItemsMap]);

	return (
		<div className="flex w-[320px] flex-none border-l border-border/80 bg-background">
			{React.cloneElement(children as React.ReactElement<any>, {
				trackItem,
			})}
		</div>
	);
};

const ActiveControlItem = ({
	trackItem,
}: {
	trackItem?: ITrackItemAndDetails;
}) => {
	if (!trackItem) {
		return (
			<div className="pb-32 flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground h-[calc(100vh-58px)]">
				<LassoSelect size={48} />
				<div className="text-center">
					<p className="font-medium">No item selected</p>
					<p className="text-sm text-muted-foreground/70">
						Select an item from the timeline
					</p>
				</div>
			</div>
		);
	}
	
	return (
		<div className="overflow-y-auto">
			{
				{
					text: <BasicText trackItem={trackItem as ITrackItem & IText} />,
					image: <BasicImage trackItem={trackItem as ITrackItem & IImage} />,
					video: <BasicVideo trackItem={trackItem as ITrackItem & IVideo} />,
					audio: <BasicAudio trackItem={trackItem as ITrackItem & IAudio} />,
				}[trackItem.type as "text"]
			}
		</div>
	);
};

export const ResearchControlItem = () => {
	return (
		<Container>
			<ActiveControlItem />
		</Container>
	);
};