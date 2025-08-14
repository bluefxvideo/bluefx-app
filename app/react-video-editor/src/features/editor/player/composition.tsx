import { SequenceItem } from "./sequence-item";
import React, { useEffect, useState } from "react";
import { dispatch, filter, subject } from "@designcombo/events";
import {
	EDIT_OBJECT,
	EDIT_TEMPLATE_ITEM,
	ENTER_EDIT_MODE,
} from "@designcombo/state";
import { groupTrackItems } from "../utils/track-items";
import { calculateTextHeight } from "../utils/text";
import { useCurrentFrame } from "remotion";
import useStore from "../store/use-store";

const Composition = () => {
	const [editableTextId, setEditableTextId] = useState<string | null>(null);
	const {
		trackItemIds,
		trackItemsMap,
		fps,
		sceneMoveableRef,
		size,
		transitionsMap,
		structure,
		activeIds,
	} = useStore();
	const frame = useCurrentFrame();

	const groupedItems = groupTrackItems({
		trackItemIds,
		transitionsMap,
		trackItemsMap: trackItemsMap,
	});
	const mediaItems = Object.values(trackItemsMap).filter((item) => {
		return item.type === "video" || item.type === "audio";
	});

	const handleTextChange = (id: string, _: string) => {
		const elRef = document.querySelector(`.id-${id}`) as HTMLDivElement;
		const textDiv = elRef.firstElementChild?.firstElementChild
			?.firstElementChild as HTMLDivElement;

		const {
			fontFamily,
			fontSize,
			fontWeight,
			letterSpacing,
			lineHeight,
			textShadow,
			webkitTextStroke,
			textTransform,
		} = textDiv.style;
		const { width } = elRef.style;
		if (!elRef.innerText) return;
		const newHeight = calculateTextHeight({
			family: fontFamily,
			fontSize,
			fontWeight,
			letterSpacing,
			lineHeight,
			text: elRef.innerText || "",
			textShadow: textShadow,
			webkitTextStroke,
			width,
			id: id,
			textTransform,
		});
		elRef.style.height = `${newHeight}px`;
		sceneMoveableRef?.current?.moveable.updateRect();
		sceneMoveableRef?.current?.moveable.forceUpdate();
	};

	const onTextBlur = (id: string, _: string) => {
		const elRef = document.querySelector(`.id-${id}`) as HTMLDivElement;
		const textDiv = elRef.firstElementChild?.firstElementChild
			?.firstElementChild as HTMLDivElement;
		const {
			fontFamily,
			fontSize,
			fontWeight,
			letterSpacing,
			lineHeight,
			textShadow,
			webkitTextStroke,
			textTransform,
		} = textDiv.style;
		const { width } = elRef.style;
		if (!elRef.innerText) return;
		const newHeight = calculateTextHeight({
			family: fontFamily,
			fontSize,
			fontWeight,
			letterSpacing,
			lineHeight,
			text: elRef.innerText || "",
			textShadow: textShadow,
			webkitTextStroke,
			width,
			id: id,
			textTransform,
		});
		dispatch(EDIT_OBJECT, {
			payload: {
				[id]: {
					details: {
						height: newHeight,
					},
				},
			},
		});
	};

	//   handle track and track item events - updates
	useEffect(() => {
		const stateEvents = subject.pipe(
			filter(({ key }) => key.startsWith(ENTER_EDIT_MODE)),
		);

		const subscription = stateEvents.subscribe((obj) => {
			if (obj.key === ENTER_EDIT_MODE) {
				if (editableTextId) {
					// get element by  data-text-id={id}
					const element = document.querySelector(
						`[data-text-id="${editableTextId}"]`,
					);
					if (trackItemIds.includes(editableTextId)) {
						dispatch(EDIT_OBJECT, {
							payload: {
								[editableTextId]: {
									details: {
										text: element?.innerHTML || "",
									},
								},
							},
						});
					} else {
						dispatch(EDIT_TEMPLATE_ITEM, {
							payload: {
								[editableTextId]: {
									details: {
										text: element?.textContent || "",
									},
								},
							},
						});
					}
				}
				setEditableTextId(obj.value?.payload.id);
			}
		});
		return () => subscription.unsubscribe();
	}, [editableTextId]);

	// Create a stable list of all items to prevent hook order changes
	const allItems = React.useMemo(() => {
		const items: Array<{ id: string; item: any; key: string }> = [];
		
		groupedItems.forEach((group, index) => {
			if (group.length === 1) {
				const item = trackItemsMap[group[0].id];
				if (item && SequenceItem[item.type]) {
					items.push({
						id: item.id,
						item,
						key: `${item.type}-${item.id}`
					});
				}
			}
		});
		
		return items;
	}, [groupedItems, trackItemsMap]);

	return (
		<>
			{allItems.map(({ id, item, key }) => {
				const itemRenderer = SequenceItem[item.type];
				
				return (
					<React.Fragment key={key}>
						{itemRenderer(item, {
							fps,
							handleTextChange,
							onTextBlur,
							editableTextId,
							frame,
							size,
							isTransition: false,
						})}
					</React.Fragment>
				);
			})}
		</>
	);
};

export default Composition;
