import TimelineBase from "@designcombo/timeline";
import Video from "./video";
import { throttle } from "lodash";
import Audio from "./audio";
import { TimelineOptions } from "@designcombo/timeline";
import { ITimelineScaleState } from "@designcombo/types";

class Timeline extends TimelineBase {
	public isShiftKey: boolean = false;
	constructor(
		canvasEl: HTMLCanvasElement,
		options: Partial<TimelineOptions> & {
			scale: ITimelineScaleState;
			duration: number;
			guideLineColor?: string;
		},
	) {
		super(canvasEl, options); // Call the parent class constructor

		// Add shift keyboard listener
		window.addEventListener("keydown", this.handleKeyDown);
		window.addEventListener("keyup", this.handleKeyUp);
	}

	private handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Shift") {
			this.isShiftKey = true;
		}
	};

	private handleKeyUp = (event: KeyboardEvent) => {
		if (event.key === "Shift") {
			this.isShiftKey = false;
		}
	};

	// Override to support shift+click multi-select
	// The base library always replaces selection on click — this adds toggle behavior
	__onMouseDown(e: MouseEvent) {
		if (this.isShiftKey) {
			const scenePoint = this.getScenePoint(e);
			const trackItems = this.getTrackItems();

			// Find which item was clicked
			let clickedItem: (typeof trackItems)[0] | null = null;
			for (const item of trackItems) {
				if (item.containsPoint(scenePoint)) {
					clickedItem = item;
					break;
				}
			}

			if (clickedItem) {
				const currentIds = [...this.activeIds];
				const clickedId = (clickedItem as any).id as string;
				const idx = currentIds.indexOf(clickedId);

				if (idx !== -1) {
					// Already selected → remove from selection
					currentIds.splice(idx, 1);
				} else {
					// Not selected → add to selection
					currentIds.push(clickedId);
				}

				this.setActiveIds(currentIds);
				this.selectTrackItemByIds(currentIds);
				return; // Handled — don't call super
			}
		}

		// Default behavior for non-shift clicks
		super.__onMouseDown(e);
	}

	public purge(): void {
		super.purge();

		// Cleanup event listener for Shift key
		window.removeEventListener("keydown", this.handleKeyDown);
		window.removeEventListener("keyup", this.handleKeyUp);
	}

	public setViewportPos(posX: number, posY: number) {
		const limitedPos = this.getViewportPos(posX, posY);
		const vt = this.viewportTransform;
		vt[4] = limitedPos.x;
		vt[5] = limitedPos.y;
		this.requestRenderAll();
		this.setActiveTrackItemCoords();
		this.onScrollChange();

		this.onScroll?.({
			scrollTop: limitedPos.y,
			scrollLeft: limitedPos.x - this.spacing.left,
		});
	}

	public onScrollChange = throttle(async () => {
		const objects = this.getObjects();
		const viewportTransform = this.viewportTransform;
		const scrollLeft = viewportTransform[4];
		for (const object of objects) {
			if (object instanceof Video || object instanceof Audio) {
				object.onScrollChange({ scrollLeft });
			}
		}
	}, 250);

	public scrollTo({
		scrollLeft,
		scrollTop,
	}: {
		scrollLeft?: number;
		scrollTop?: number;
	}): void {
		const vt = this.viewportTransform; // Create a shallow copy
		let hasChanged = false;

		if (typeof scrollLeft === "number") {
			vt[4] = -scrollLeft + this.spacing.left;
			hasChanged = true;
		}
		if (typeof scrollTop === "number") {
			vt[5] = -scrollTop;
			hasChanged = true;
		}

		if (hasChanged) {
			this.viewportTransform = vt;
			this.getActiveObject()?.setCoords();
			this.onScrollChange();
			this.requestRenderAll();
		}
	}
}

export default Timeline;
