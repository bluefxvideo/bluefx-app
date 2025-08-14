import Timeline from "@designcombo/timeline";
import {
	IComposition,
	ISize,
	ITimelineScaleState,
	ITimelineScrollState,
	ITrack,
	ITrackItem,
	ITransition,
	ItemStructure,
} from "@designcombo/types";
import { PlayerRef } from "@remotion/player";
import { create } from "zustand";

interface IEditorStore {
	duration: number;
	fps: number;
	scale: ITimelineScaleState;
	scroll: ITimelineScrollState;
	size: ISize;
	tracks: ITrack[];
	trackItemIds: string[];
	transitionIds: string[];
	transitionsMap: Record<string, ITransition>;
	trackItemsMap: Record<string, ITrackItem>;
	structure: ItemStructure[];
	activeIds: string[];
	timeline: Timeline | null;
	setTimeline: (timeline: Timeline) => void;
	setScale: (scale: ITimelineScaleState) => void;
	setScroll: (scroll: ITimelineScrollState) => void;
	playerRef: React.RefObject<PlayerRef> | null;
	setPlayerRef: (playerRef: React.RefObject<PlayerRef> | null) => void;

	setState: (state: any) => Promise<void>;
	compositions: Partial<IComposition>[];
	setCompositions: (compositions: Partial<IComposition>[]) => void;

	background: {
		type: "color" | "image";
		value: string;
	};
	viewTimeline: boolean;
	setViewTimeline: (viewTimeline: boolean) => void;
}

const useEditorStore = create<IEditorStore>((set) => ({
	compositions: [],
	structure: [],
	setCompositions: (compositions) => set({ compositions }),
	size: {
		width: 1920,
		height: 1080,
	},

	background: {
		type: "color",
		value: "transparent",
	},
	viewTimeline: true,
	setViewTimeline: (viewTimeline) => set({ viewTimeline }),

	timeline: null,
	duration: 30000, // 30 seconds
	fps: 30,
	scale: {
		// 1x distance (second 0 to second 5, 5 segments).
		index: 7,
		unit: 300,
		zoom: 1 / 300,
		segments: 5,
	},
	scroll: {
		left: 0,
		top: 0,
	},
	playerRef: null,

	activeIds: [],
	tracks: [],
	trackItemIds: [],
	transitionIds: [],
	transitionsMap: {},
	trackItemsMap: {},

	setTimeline: (timeline: Timeline) =>
		set(() => ({
			timeline: timeline,
		})),
	setScale: (scale: ITimelineScaleState) =>
		set(() => ({
			scale: scale,
		})),
	setScroll: (scroll: ITimelineScrollState) =>
		set(() => ({
			scroll: scroll,
		})),
	setState: async (state) => {
		console.log('Store setState called with:', state);
		return set((currentState) => ({ ...currentState, ...state }));
	},
	setPlayerRef: (playerRef: React.RefObject<PlayerRef> | null) =>
		set({ playerRef }),
}));

export default useEditorStore;