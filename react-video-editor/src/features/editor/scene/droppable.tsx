import { dispatch } from "@designcombo/events";
import { ADD_AUDIO, ADD_IMAGE, ADD_VIDEO } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import React, { useCallback, useState } from "react";

enum AcceptedDropTypes {
	IMAGE = "image",
	VIDEO = "video",
	AUDIO = "audio",
}

interface DraggedData {
	type: AcceptedDropTypes;
	[key: string]: any;
}

/**
 * Find our drag payload among the DataTransfer types. The Draggable encodes
 * the payload into the format key itself (readable during dragenter, when
 * getData() is blocked). Scan ALL types instead of trusting types[0] — the
 * browser injects extra types (text/uri-list, text/html) when dragging <img>
 * elements, and their order is not guaranteed. That fragile types[0] read is
 * what made every few drops silently fail.
 */
const parseDraggedTypes = (dt: DataTransfer | null): DraggedData | null => {
	if (!dt) return null;
	for (const t of Array.from(dt.types)) {
		if (!t.startsWith("{")) continue; // not our JSON-shaped key
		try {
			const parsed = JSON.parse(t);
			if (parsed && Object.values(AcceptedDropTypes).includes(parsed.type)) {
				return parsed as DraggedData;
			}
		} catch {
			// Not our payload — keep scanning
		}
	}
	return null;
};

interface DroppableAreaProps {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
	onDragStateChange?: (isDragging: boolean) => void;
	id?: string;
}

const useDragAndDrop = (onDragStateChange?: (isDragging: boolean) => void) => {
	const [isPointerInside, setIsPointerInside] = useState(false);
	const [isDraggingOver, setIsDraggingOver] = useState(false);

	const handleDrop = useCallback((draggedData: DraggedData) => {
		const payload = { ...draggedData, id: generateId() };
		switch (draggedData.type) {
			case AcceptedDropTypes.IMAGE:
				dispatch(ADD_IMAGE, { payload });
				break;
			case AcceptedDropTypes.VIDEO:
				dispatch(ADD_VIDEO, { payload });
				break;
			case AcceptedDropTypes.AUDIO:
				dispatch(ADD_AUDIO, { payload });
				break;
		}
	}, []);

	const onDragEnter = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			const draggedData = parseDraggedTypes(e.dataTransfer);
			if (!draggedData) return;
			setIsDraggingOver(true);
			setIsPointerInside(true);
			onDragStateChange?.(true);
		},
		[onDragStateChange],
	);

	const onDragOver = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			if (isPointerInside) {
				setIsDraggingOver(true);
				onDragStateChange?.(true);
			}
		},
		[isPointerInside, onDragStateChange],
	);

	const onDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (!isDraggingOver) return;
			e.preventDefault();
			setIsDraggingOver(false);
			onDragStateChange?.(false);

			try {
				// Prefer the canonical application/json entry (case-preserved);
				// fall back to the payload encoded in the format key (legacy —
				// beware: browsers lowercase format keys).
				let draggedData: DraggedData | null = null;
				const raw = e.dataTransfer?.getData("application/json");
				if (raw) {
					try {
						draggedData = JSON.parse(raw);
					} catch {
						// fall through to legacy path
					}
				}
				if (!draggedData) {
					draggedData = parseDraggedTypes(e.dataTransfer);
				}
				if (!draggedData || !Object.values(AcceptedDropTypes).includes(draggedData.type)) {
					console.warn("Drop ignored — no recognizable drag payload", e.dataTransfer?.types);
					return;
				}
				handleDrop(draggedData);
			} catch (error) {
				console.error("Error parsing dropped data:", error);
			}
		},
		[isDraggingOver, onDragStateChange, handleDrop],
	);

	const onDragLeave = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			if (!e.currentTarget.contains(e.relatedTarget as Node)) {
				setIsDraggingOver(false);
				setIsPointerInside(false);
				onDragStateChange?.(false);
			}
		},
		[onDragStateChange],
	);

	return { onDragEnter, onDragOver, onDrop, onDragLeave, isDraggingOver };
};

export const DroppableArea: React.FC<DroppableAreaProps> = ({
	children,
	className,
	style,
	onDragStateChange,
	id,
}) => {
	const { onDragEnter, onDragOver, onDrop, onDragLeave } =
		useDragAndDrop(onDragStateChange);

	return (
		<div
			id={id}
			onDragEnter={onDragEnter}
			onDrop={onDrop}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			className={className}
			style={style}
			role="region"
			aria-label="Droppable area for images, videos, and audio"
		>
			{children}
		</div>
	);
};
