import { create } from "zustand";

export interface AnimationItem {
	itemId: string;
	imageSrc: string;
	originalFrom: number;
	status: "pending" | "processing" | "polling" | "done" | "failed";
	predictionId?: string;
	videoUrl?: string;
	error?: string;
}

export interface BatchAnimateSettings {
	cameraMotion: string;
	duration: string;
	prompt: string;
}

interface BatchAnimateState {
	isActive: boolean;
	items: AnimationItem[];
	settings: BatchAnimateSettings;
	cancelled: boolean;
	/** Lock to serialize ADD_VIDEO dispatches (prevents concurrent dispatch issues) */
	addingVideo: boolean;
	actions: {
		startBatch: (
			items: AnimationItem[],
			settings: BatchAnimateSettings,
		) => void;
		updateItem: (
			itemId: string,
			update: Partial<AnimationItem>,
		) => void;
		cancelAll: () => void;
		reset: () => void;
		setAddingVideo: (value: boolean) => void;
	};
}

export const useBatchAnimateState = create<BatchAnimateState>((set, get) => ({
	isActive: false,
	items: [],
	settings: { cameraMotion: "dolly_in", duration: "6", prompt: "" },
	cancelled: false,
	addingVideo: false,
	actions: {
		startBatch: (items, settings) =>
			set({
				isActive: true,
				items,
				settings,
				cancelled: false,
				addingVideo: false,
			}),

		updateItem: (itemId, update) =>
			set((state) => {
				const items = state.items.map((item) =>
					item.itemId === itemId ? { ...item, ...update } : item,
				);
				// Auto-complete: if all items are done or failed, mark inactive
				const allFinished = items.every(
					(i) => i.status === "done" || i.status === "failed",
				);
				return {
					items,
					isActive: allFinished ? false : state.isActive,
				};
			}),

		cancelAll: () =>
			set((state) => ({
				cancelled: true,
				isActive: false,
				addingVideo: false,
				// Keep completed items as done, mark pending/processing as failed
				items: state.items.map((item) =>
					item.status === "done"
						? item
						: { ...item, status: "failed" as const, error: "Cancelled" },
				),
			})),

		reset: () =>
			set({
				isActive: false,
				items: [],
				settings: { cameraMotion: "dolly_in", duration: "6", prompt: "" },
				cancelled: false,
				addingVideo: false,
			}),

		setAddingVideo: (value: boolean) => set({ addingVideo: value }),
	},
}));
