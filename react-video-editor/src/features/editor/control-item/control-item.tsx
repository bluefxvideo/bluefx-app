import React from "react";
import {
	IAudio,
	IImage,
	IText,
	ITrackItem,
	ITrackItemAndDetails,
	IVideo,
} from "@designcombo/types";
import { useEffect } from "react";
import BasicText from "./basic-text";
import BasicCaption from "./basic-caption";
import BasicImage from "./basic-image";
import BasicVideo from "./basic-video";
import BasicAudio from "./basic-audio";
import useStore from "../store/use-store";
import useLayoutStore from "../store/use-layout-store";
import { LassoSelect } from "lucide-react";

const Container = ({ children }: { children: React.ReactNode }) => {
	const { activeIds, trackItemsMap } = useStore();
	const { setTrackItem: setLayoutTrackItem } = useLayoutStore();

	// Derive trackItem directly during render — no useState/useEffect delay.
	// This ensures BasicText always receives the CURRENT trackItem from the store,
	// not a stale one from a previous render cycle.
	let trackItem: ITrackItem | null = null;
	let multipleSelection = false;

	if (activeIds.length === 1) {
		trackItem = trackItemsMap[activeIds[0]] || null;
	} else if (activeIds.length > 1) {
		trackItem = trackItemsMap[activeIds[0]] || null;
		multipleSelection = true;
	}

	useEffect(() => {
		setLayoutTrackItem(trackItem);
	}, [trackItem?.id, trackItem?.details]);

	return (
		<div className="flex w-[272px] flex-none border-l border-border/80 bg-muted hidden lg:flex lg:flex-col overflow-hidden h-[calc(100vh-48px)]">
			{React.cloneElement(children as React.ReactElement<any>, {
				trackItem,
				multipleSelection,
				selectedCount: activeIds.length,
			})}
		</div>
	);
};

const ActiveControlItem = ({
	trackItem,
	multipleSelection,
	selectedCount,
}: {
	trackItem?: ITrackItemAndDetails;
	multipleSelection?: boolean;
	selectedCount?: number;
}) => {
	if (!trackItem) {
		return (
			<div className="pb-32 flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground h-[calc(100vh-58px)]">
				<LassoSelect />
				<span className="text-zinc-500">No item selected</span>
			</div>
		);
	}

	// Show multi-selection controls for images and videos
	if (multipleSelection && (trackItem.type === "image" || trackItem.type === "video")) {
		return (
			<div className="flex flex-1 flex-col min-h-0">
				<div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
					{selectedCount} {trackItem.type}s selected
				</div>
				<div className="flex-1 min-h-0 overflow-auto px-4 py-4">
					{trackItem.type === "image" && <BasicImage trackItem={trackItem as ITrackItem & IImage} />}
					{trackItem.type === "video" && <BasicVideo trackItem={trackItem as ITrackItem & IVideo} />}
				</div>
			</div>
		);
	}

	// Check if this is a caption track (text item with isCaptionTrack flag)
	const isCaptionTrack = trackItem.type === "text" && (trackItem.details as any)?.isCaptionTrack;

	if (isCaptionTrack) {
		return <BasicCaption trackItem={trackItem as ITrackItem & IText} />;
	}

	return (
		<>
			{
				{
					text: <BasicText trackItem={trackItem as ITrackItem & IText} />,
					image: <BasicImage trackItem={trackItem as ITrackItem & IImage} />,
					video: <BasicVideo trackItem={trackItem as ITrackItem & IVideo} />,
					audio: <BasicAudio trackItem={trackItem as ITrackItem & IAudio} />,
				}[trackItem.type as "text"]
			}
		</>
	);
};

export const ControlItem = () => {
	return (
		<Container>
			<ActiveControlItem />
		</Container>
	);
};
