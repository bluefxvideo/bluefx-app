import { useEffect } from "react";
import { dispatch } from "@designcombo/events";
import { LAYER_DELETE, HISTORY_UNDO, HISTORY_REDO } from "@designcombo/state";
import useStore from "../store/use-store";

export const useKeyboardShortcuts = () => {
	const { activeIds } = useStore();

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Prevent shortcuts when typing in input fields
			const target = event.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable
			) {
				return;
			}

			// Delete or Backspace - Delete selected items
			if (event.key === "Delete" || event.key === "Backspace") {
				if (activeIds.length > 0) {
					event.preventDefault();
					console.log("🗑️ Delete key pressed - deleting items:", activeIds);
					dispatch(LAYER_DELETE);
				}
			}

			// Cmd/Ctrl + Z - Undo
			if ((event.metaKey || event.ctrlKey) && event.key === "z" && !event.shiftKey) {
				event.preventDefault();
				console.log("↩️ Undo shortcut triggered");
				dispatch(HISTORY_UNDO);
			}

			// Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y - Redo
			if (
				((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "z") ||
				((event.metaKey || event.ctrlKey) && event.key === "y")
			) {
				event.preventDefault();
				console.log("↪️ Redo shortcut triggered");
				dispatch(HISTORY_REDO);
			}
		};

		// Add event listener
		window.addEventListener("keydown", handleKeyDown);

		// Cleanup
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [activeIds]);
};