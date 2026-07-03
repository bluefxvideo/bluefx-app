import React, { useState, cloneElement, ReactElement } from "react";
import { createPortal } from "react-dom";

interface DraggableProps {
	children: ReactElement;
	shouldDisplayPreview?: boolean;
	renderCustomPreview?: ReactElement;
	data?: Record<string, any>;
}

const Draggable: React.FC<DraggableProps> = ({
	children,
	renderCustomPreview,
	data = {},
	shouldDisplayPreview = true,
}) => {
	const [isDragging, setIsDragging] = useState(false);
	const [position, setPosition] = useState({ x: 0, y: 0 });

	const handleDragStart = (e: React.DragEvent<HTMLElement>) => {
		setIsDragging(true);
		e.dataTransfer.setDragImage(new Image(), 0, 0); // Hides default preview
		const json = JSON.stringify(data);
		// The format key doubles as the payload so drop targets can inspect it
		// during dragenter/dragover, when getData() is blocked (HTML5 protected
		// mode). NOTE: browsers lowercase format keys, so this copy must never
		// be the only source of truth — uppercase URL chars would get corrupted.
		e.dataTransfer.setData(json, json);
		// Canonical payload for retrieval on drop (case preserved, immune to
		// browser-injected types like text/uri-list shifting types[] order).
		e.dataTransfer.setData("application/json", json);
		e.dataTransfer.effectAllowed = "move";

		setPosition({
			x: e.clientX,
			y: e.clientY,
		});
	};

	const handleDragEnd = () => {
		setIsDragging(false);
	};

	const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
		e.preventDefault(); // Important: allows drop
		if (isDragging) {
			setPosition({
				x: e.clientX,
				y: e.clientY,
			});
		}
	};

	// Add dragover event listener to document
	React.useEffect(() => {
		const handleDocumentDragOver = (e: DragEvent) => {
			e.preventDefault();
			if (isDragging) {
				setPosition({
					x: e.clientX,
					y: e.clientY,
				});
			}
		};

		if (isDragging) {
			document.addEventListener("dragover", handleDocumentDragOver);
		}

		return () => {
			document.removeEventListener("dragover", handleDocumentDragOver);
		};
	}, [isDragging]);

	const childWithProps = cloneElement(children, {
		draggable: true,
		onDragStart: handleDragStart,
		onDragEnd: handleDragEnd,
		onDragOver: handleDragOver,
		style: {
			...(children.props as any)?.style,
		},
	} as any);

	return (
		<>
			{childWithProps}
			{isDragging && shouldDisplayPreview && renderCustomPreview
				? createPortal(
						<div
							style={{
								position: "fixed",
								left: position.x,
								top: position.y,
								pointerEvents: "none",
								zIndex: 9999,
								transform: "translate(-50%, -50%)", // Center the preview
							}}
						>
							{renderCustomPreview}
						</div>,
						document.body,
					)
				: null}
		</>
	);
};

export default Draggable;
