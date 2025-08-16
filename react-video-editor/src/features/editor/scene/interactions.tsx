import { useEffect, useRef, useState } from "react";
import { Selection, Moveable } from "@interactify/toolkit";
import { getIdFromClassName } from "../utils/scene";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import {
	SelectionInfo,
	emptySelection,
	getSelectionByIds,
	getTargetById,
} from "../utils/target";
import useStore from "../store/use-store";
import StateManager from "@designcombo/state";
import { getCurrentTime } from "../utils/time";

let holdGroupPosition: Record<string, any> | null = null;
let dragStartEnd = false;

interface SceneInteractionsProps {
	stateManager: StateManager;
	containerRef: React.RefObject<HTMLDivElement>;
	zoom: number;
	size: { width: number; height: number };
}
export function SceneInteractions({
	stateManager,
	containerRef,
	zoom,
}: SceneInteractionsProps) {
	const [targets, setTargets] = useState<HTMLDivElement[]>([]);
	const [selection, setSelection] = useState<Selection>();
	const { activeIds, setState, trackItemsMap, playerRef, setSceneMoveableRef } =
		useStore();
	const moveableRef = useRef<Moveable>(null);
	const [selectionInfo, setSelectionInfo] =
		useState<SelectionInfo>(emptySelection);

	useEffect(() => {
		const updateTargets = (time?: number) => {
			const currentTime = time || getCurrentTime();
			const { trackItemsMap } = useStore.getState();
			const targetIds = activeIds.filter((id) => {
				return (
					trackItemsMap[id]?.display.from <= currentTime &&
					trackItemsMap[id]?.display.to >= currentTime
				);
			});
			const targets = targetIds.map(
				(id) => getTargetById(id) as HTMLDivElement,
			);
			selection?.setSelectedTargets(targets);
			const selInfo = getSelectionByIds(targetIds);
			setSelectionInfo(selInfo);
			setTargets(selInfo.targets as HTMLDivElement[]);
		};
		const timer = setTimeout(() => {
			updateTargets();
		});

		const onSeeked = (v: any) => {
			setTimeout(() => {
				const { fps } = useStore.getState();
				const seekedTime = (v.detail.frame / fps) * 1000;
				updateTargets(seekedTime);
			});
		};
		playerRef?.current?.addEventListener("seeked", onSeeked);

		return () => {
			playerRef?.current?.removeEventListener("seeked", onSeeked);
			clearTimeout(timer);
		};
	}, [activeIds, playerRef, trackItemsMap]);

	useEffect(() => {
		const selection = new Selection({
			container: containerRef.current,
			boundContainer: true,
			hitRate: 0,
			selectableTargets: [".designcombo-scene-item"],
			selectFromInside: false,
			selectByClick: true,
			toggleContinueSelect: "shift",
		})
			.on("select", (e) => {
				// Filter out audio items from selection
				const filteredSelected = e.selected.filter(
					(el) => !el.className.includes("designcombo-scene-item-type-audio"),
				);

				const ids = filteredSelected.map((el) =>
					getIdFromClassName(el.className),
				);

				setTargets(filteredSelected as HTMLDivElement[]);

				stateManager.updateState(
					{
						activeIds: ids,
					},
					{
						updateHistory: false,
						kind: "layer:selection",
					},
				);
			})
			.on("dragStart", (e) => {
				const target = e.inputEvent.target as HTMLDivElement;
				dragStartEnd = false;

				if (targets.includes(target)) {
					e.stop();
				}
				if (
					target &&
					moveableRef?.current?.moveable.isMoveableElement(target)
				) {
					e.stop();
				}
			})
			.on("dragEnd", () => {
				dragStartEnd = true;
			})
			.on("selectEnd", (e) => {
				const moveable = moveableRef.current;
				if (e.isDragStart) {
					e.inputEvent.preventDefault();
					setTimeout(() => {
						if (!dragStartEnd) {
							moveable?.moveable.dragStart(e.inputEvent);
						}
					});
				} else {
					// Filter out audio items from selection
					const filteredSelected = e.selected.filter(
						(el) => !el.className.includes("designcombo-scene-item-type-audio"),
					) as HTMLDivElement[];

					const ids = filteredSelected.map((el) =>
						getIdFromClassName(el.className),
					);

					stateManager.updateState(
						{
							activeIds: ids,
						},
						{
							updateHistory: false,
							kind: "layer:selection",
						},
					);

					setTargets(filteredSelected);
				}
			});
		setSelection(selection);
		return () => {
			selection.destroy();
		};
	}, []);

	useEffect(() => {
		const activeSelectionSubscription = stateManager.subscribeToActiveIds(
			(newState) => {
				setState(newState);
			},
		);

		return () => {
			activeSelectionSubscription.unsubscribe();
		};
	}, []);

	useEffect(() => {
		moveableRef.current?.moveable.updateRect();
	}, [trackItemsMap]);

	useEffect(() => {
		setSceneMoveableRef(moveableRef as React.RefObject<Moveable>);
	}, [moveableRef]);
	return (
		<Moveable
			ref={moveableRef}
			rotationPosition={"bottom"}
			renderDirections={selectionInfo.controls}
			{...selectionInfo.ables}
			origin={false}
			target={targets}
			zoom={1 / zoom}
			className="designcombo-scene-moveable"
			onDrag={({ target, top, left }) => {
				target.style.top = `${top}px`;
				target.style.left = `${left}px`;
			}}
			onDragEnd={({ target, isDrag }) => {
				if (!isDrag) return;
				const targetId = getIdFromClassName(target.className) as string;

				dispatch(EDIT_OBJECT, {
					payload: {
						[targetId]: {
							details: {
								left: target.style.left,
								top: target.style.top,
							},
						},
					},
				});
			}}
			onScale={({ target, transform, direction }) => {
				const [xControl, yControl] = direction;

				const moveX = xControl === -1;
				const moveY = yControl === -1;

				const scaleRegex = /scale\(([^)]+)\)/;
				const match = target.style.transform.match(scaleRegex);
				if (!match) return;

				//get current scale
				const [scaleX, scaleY] = match[1]
					.split(",")
					.map((value) => Number.parseFloat(value.trim()));

				//get new Scale
				const match2 = transform.match(scaleRegex);
				if (!match2) return;
				const [newScaleX, newScaleY] = match2[1]
					.split(",")
					.map((value) => Number.parseFloat(value.trim()));

				const currentWidth = target.clientWidth * scaleX;
				const currentHeight = target.clientHeight * scaleY;

				const newWidth = target.clientWidth * newScaleX;
				const newHeight = target.clientHeight * newScaleY;

				target.style.transform = transform;

				//Move element to initial Left position
				const diffX = currentWidth - newWidth;
				let newLeft = Number.parseFloat(target.style.left) - diffX / 2;

				const diffY = currentHeight - newHeight;
				let newTop = Number.parseFloat(target.style.top) - diffY / 2;

				if (moveX) {
					newLeft += diffX;
				}
				if (moveY) {
					newTop += diffY;
				}
				target.style.left = `${newLeft}px`;
				target.style.top = `${newTop}px`;
			}}
			onScaleEnd={({ target }) => {
				if (!target.style.transform) return;
				const targetId = getIdFromClassName(target.className) as string;

				dispatch(EDIT_OBJECT, {
					payload: {
						[targetId]: {
							details: {
								transform: target.style.transform,
								left: Number.parseFloat(target.style.left),
								top: Number.parseFloat(target.style.top),
							},
						},
					},
				});
			}}
			onRotate={({ target, transform }) => {
				target.style.transform = transform;
			}}
			onRotateEnd={({ target }) => {
				if (!target.style.transform) return;
				const targetId = getIdFromClassName(target.className) as string;
				dispatch(EDIT_OBJECT, {
					payload: {
						[targetId]: {
							details: {
								transform: target.style.transform,
							},
						},
					},
				});
			}}
			onDragGroup={({ events }) => {
				holdGroupPosition = {};
				for (let i = 0; i < events.length; i++) {
					const event = events[i];
					const id = getIdFromClassName(event.target.className);
					const trackItem = trackItemsMap[id];
					const left =
						Number.parseFloat(trackItem?.details.left as string) +
						event.beforeTranslate[0];
					const top =
						Number.parseFloat(trackItem?.details.top as string) +
						event.beforeTranslate[1];
					event.target.style.left = `${left}px`;
					event.target.style.top = `${top}px`;
					holdGroupPosition[id] = {
						left: left,
						top: top,
					};
				}
			}}
			onResize={({
				target,
				width: nextWidth,
				height: nextHeight,
				direction,
			}) => {
				const targetId = getIdFromClassName(target.className) as string;
				const trackItem = trackItemsMap[targetId];
				const isCaptionTrack = trackItem?.details && (trackItem.details as any).isCaptionTrack;

				// For caption tracks, handle resizing by scaling font size proportionally
				if (isCaptionTrack) {
					const currentWidth = target.clientWidth;
					const currentHeight = target.clientHeight;

					// Calculate scale factor - use the average of both dimensions for more natural scaling
					const scaleX = nextWidth / currentWidth;
					const scaleY = nextHeight / currentHeight;
					const scale = (scaleX + scaleY) / 2; // Use average for more natural scaling

					// Update target dimensions
					target.style.width = `${nextWidth}px`;
					target.style.height = `${nextHeight}px`;

					// Update animation div if it exists
					const animationDiv = target.firstElementChild
						?.firstElementChild as HTMLDivElement | null;
					if (animationDiv) {
						animationDiv.style.width = `${nextWidth}px`;
						animationDiv.style.height = `${nextHeight}px`;
					}

					// Find and scale the caption text element - try multiple selectors
					let textElement = target.querySelector('[data-text-id]') as HTMLDivElement | null;
					
					// If not found, try finding by class name
					if (!textElement) {
						textElement = target.querySelector('.designcombo_textLayer') as HTMLDivElement | null;
					}
					
					// If still not found, try finding any div with text content
					if (!textElement) {
						const allDivs = target.querySelectorAll('div');
						for (const div of allDivs) {
							if (div.textContent && div.textContent.trim().length > 0) {
								textElement = div as HTMLDivElement;
								break;
							}
						}
					}

					if (textElement) {
						const currentFontSize = Number.parseFloat(
							getComputedStyle(textElement).fontSize,
						);
						const newFontSize = Math.max(12, currentFontSize * scale); // Minimum 12px font size
						textElement.style.fontSize = `${newFontSize}px`;
						
						// Also ensure the text element fills the container
						textElement.style.width = `100%`;
						textElement.style.height = `100%`;
					}
					return;
				}

				// Regular text handling (non-captions)
				if (direction[1] === 1) {
					const currentWidth = target.clientWidth;
					const currentHeight = target.clientHeight;

					// Get new width and height
					const scaleY = nextHeight / currentHeight;
					const scale = scaleY;

					// Update target dimensions
					target.style.width = `${currentWidth * scale}px`;
					target.style.height = `${currentHeight * scale}px`;

					// Find the text element with a more robust selector
					const textElement = target.querySelector('[data-text-id]') as HTMLDivElement | null;
					if (textElement) {
						const currentFontSize = Number.parseFloat(
							getComputedStyle(textElement).fontSize,
						);
						textElement.style.fontSize = `${currentFontSize * scale}px`;
						textElement.style.width = `${currentWidth * scale}px`;
						textElement.style.height = `${currentHeight * scale}px`;
					}

					// Also update any nested animation div if it exists
					const animationDiv = target.firstElementChild
						?.firstElementChild as HTMLDivElement | null;
					if (animationDiv) {
						animationDiv.style.width = `${currentWidth * scale}px`;
						animationDiv.style.height = `${currentHeight * scale}px`;
					}
				} else {
					target.style.width = `${nextWidth}px`;
					target.style.height = `${nextHeight}px`;

					// Find the text element with a more robust selector
					const textElement = target.querySelector('[data-text-id]') as HTMLDivElement | null;
					if (textElement) {
						textElement.style.width = `${nextWidth}px`;
						textElement.style.height = `${nextHeight}px`;
					}

					// Also update any nested animation div if it exists
					const animationDiv = target.firstElementChild
						?.firstElementChild as HTMLDivElement | null;
					if (animationDiv) {
						animationDiv.style.width = `${nextWidth}px`;
						animationDiv.style.height = `${nextHeight}px`;
					}
				}
			}}
			onResizeEnd={({ target }) => {
				const targetId = getIdFromClassName(target.className) as string;
				const trackItem = trackItemsMap[targetId];
				const isCaptionTrack = trackItem?.details && (trackItem.details as any).isCaptionTrack;

				if (isCaptionTrack) {
					// For captions, update width, height, and fontSize
					let textElement = target.querySelector('[data-text-id]') as HTMLDivElement | null;
					
					// If not found, try finding by class name
					if (!textElement) {
						textElement = target.querySelector('.designcombo_textLayer') as HTMLDivElement | null;
					}
					
					// If still not found, try finding any div with text content
					if (!textElement) {
						const allDivs = target.querySelectorAll('div');
						for (const div of allDivs) {
							if (div.textContent && div.textContent.trim().length > 0) {
								textElement = div as HTMLDivElement;
								break;
							}
						}
					}
					
					const fontSize = textElement ? Number.parseFloat(textElement.style.fontSize) : undefined;
					
					const payload: any = {
						width: Number.parseFloat(target.style.width),
						height: Number.parseFloat(target.style.height),
					};
					
					// Include fontSize if we successfully found and scaled it
					if (fontSize && !isNaN(fontSize)) {
						payload.fontSize = fontSize;
					}
					
					dispatch(EDIT_OBJECT, {
						payload: {
							[targetId]: {
								details: payload,
							},
						},
					});
				} else {
					// For regular text, update fontSize as well
					const textElement = target.querySelector('[data-text-id]') as HTMLDivElement | null;
					const fontSize = textElement ? Number.parseFloat(textElement.style.fontSize) : undefined;
					
					const payload: any = {
						width: Number.parseFloat(target.style.width),
						height: Number.parseFloat(target.style.height),
					};
					
					// Only include fontSize if we successfully found it
					if (fontSize && !isNaN(fontSize)) {
						payload.fontSize = fontSize;
					}
					
					dispatch(EDIT_OBJECT, {
						payload: {
							[targetId]: {
								details: payload,
							},
						},
					});
				}
			}}
			onDragGroupEnd={() => {
				if (holdGroupPosition) {
					const payload: Record<string, Partial<any>> = {};
					for (const id of Object.keys(holdGroupPosition)) {
						const left = holdGroupPosition[id].left;
						const top = holdGroupPosition[id].top;
						payload[id] = {
							details: {
								top: `${top}px`,
								left: `${left}px`,
							},
						};
					}
					dispatch(EDIT_OBJECT, {
						payload: payload,
					});
					holdGroupPosition = null;
				}
			}}
		/>
	);
}
