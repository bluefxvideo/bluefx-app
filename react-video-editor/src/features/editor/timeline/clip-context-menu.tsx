import { useEffect, useRef } from "react";
import { Download, Trash2, Copy } from "lucide-react";
import { ITrackItem } from "@designcombo/types";
import { dispatch } from "@designcombo/events";
import { ADD_ITEMS } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";

interface ClipContextMenuProps {
	x: number;
	y: number;
	items: ITrackItem[];
	onClose: () => void;
	onDelete: () => void;
}

/**
 * Floating context menu shown when the user right-clicks a clip on the timeline.
 * Operates on the currently selected items.
 */
export function ClipContextMenu({ x, y, items, onClose, onDelete }: ClipContextMenuProps) {
	const ref = useRef<HTMLDivElement>(null);

	// Close on outside click or escape
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		};
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [onClose]);

	const downloadable = items.filter(
		(it) => (it.type === "video" || it.type === "image" || it.type === "audio") && (it.details as any)?.src,
	);

	const handleDownload = async () => {
		for (const item of downloadable) {
			const src = (item.details as any).src as string;
			try {
				const res = await fetch(src);
				const blob = await res.blob();
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				const ext =
					item.type === "video" ? "mp4" : item.type === "audio" ? "mp3" : "jpg";
				const baseName = (item.name || `${item.type}-${item.id.slice(0, 6)}`).replace(
					/[^a-zA-Z0-9_-]/g,
					"_",
				);
				a.download = `${baseName}.${ext}`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			} catch (err) {
				console.error(`❌ Download failed for ${item.id}:`, err);
			}
		}
		onClose();
	};

	const handleDuplicate = () => {
		// Duplicate each selected item by dispatching ADD_ITEMS with a clone
		const newItems = items.map((it) => ({
			...it,
			id: generateId(),
			display: {
				from: it.display.from + (it.display.to - it.display.from),
				to: it.display.to + (it.display.to - it.display.from),
			},
		}));
		dispatch(ADD_ITEMS, { payload: { trackItems: newItems } });
		onClose();
	};

	if (items.length === 0) return null;

	return (
		<div
			ref={ref}
			style={{ left: x, top: y, position: "fixed", zIndex: 1000 }}
			className="min-w-[180px] rounded-md border border-border bg-popover py-1 shadow-md text-sm"
		>
			{downloadable.length > 0 && (
				<button
					type="button"
					onClick={handleDownload}
					className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left"
				>
					<Download className="h-3.5 w-3.5" />
					Download {downloadable.length > 1 ? `${downloadable.length} clips` : "clip"}
				</button>
			)}
			<button
				type="button"
				onClick={handleDuplicate}
				className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left"
			>
				<Copy className="h-3.5 w-3.5" />
				Duplicate
			</button>
			<div className="my-1 h-px bg-border" />
			<button
				type="button"
				onClick={() => {
					onDelete();
					onClose();
				}}
				className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-destructive"
			>
				<Trash2 className="h-3.5 w-3.5" />
				Delete
			</button>
		</div>
	);
}
