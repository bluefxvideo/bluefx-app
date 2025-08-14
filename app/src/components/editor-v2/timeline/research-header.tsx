// Simplified Header component based on research/react-video-editor/src/features/editor/timeline/header.tsx
import { Button } from "@/components/ui/button";
import { dispatch } from "@designcombo/events";
import {
	ACTIVE_SPLIT,
	LAYER_CLONE,
	LAYER_DELETE,
	TIMELINE_SCALE_CHANGED,
} from "@designcombo/state";
import { SquareSplitHorizontal, Trash, ZoomIn, ZoomOut, Play, Pause } from "lucide-react";
import useEditorStore from "../store/use-editor-store";
import { useState, useEffect } from "react";

const ResearchHeader = () => {
	const [playing, setPlaying] = useState(false);
	const { duration, fps, scale, playerRef, activeIds } = useEditorStore();

	const doActiveDelete = () => {
		dispatch(LAYER_DELETE);
	};

	const doActiveSplit = () => {
		dispatch(ACTIVE_SPLIT, {
			payload: {},
			options: {
				time: 0, // TODO: Get current time
			},
		});
	};

	const doClone = () => {
		dispatch(LAYER_CLONE);
	};

	const handlePlay = () => {
		console.log('Play button clicked, playerRef:', playerRef);
		if (playerRef?.current) {
			console.log('Player found, current playing state:', playing);
			if (playing) {
				playerRef.current.pause();
			} else {
				playerRef.current.play();
			}
		} else {
			console.log('No playerRef available');
		}
	};

	const onZoomOut = () => {
		const newScale = {
			...scale,
			zoom: Math.max(scale.zoom * 0.8, 0.1),
		};
		dispatch(TIMELINE_SCALE_CHANGED, {
			payload: { scale: newScale },
		});
	};

	const onZoomIn = () => {
		const newScale = {
			...scale,
			zoom: Math.min(scale.zoom * 1.2, 5),
		};
		dispatch(TIMELINE_SCALE_CHANGED, {
			payload: { scale: newScale },
		});
	};

	useEffect(() => {
		const player = playerRef?.current;
		if (!player) return;

		const handlePlayEvent = () => setPlaying(true);
		const handlePauseEvent = () => setPlaying(false);

		player.addEventListener("play", handlePlayEvent);
		player.addEventListener("pause", handlePauseEvent);

		return () => {
			player.removeEventListener("play", handlePlayEvent);
			player.removeEventListener("pause", handlePauseEvent);
		};
	}, [playerRef]);

	return (
		<div className="relative h-12 flex-none border-b border-border/40">
			<div className="absolute h-12 w-full flex items-center">
				<div className="h-9 w-full grid grid-cols-3 items-center">
					{/* Left side - Actions */}
					<div className="flex px-2">
						<Button
							disabled={!activeIds.length}
							onClick={doActiveDelete}
							variant="ghost"
							size="sm"
							className="flex items-center gap-1 px-2"
						>
							<Trash size={14} />
							<span>Delete</span>
						</Button>

						<Button
							disabled={!activeIds.length}
							onClick={doActiveSplit}
							variant="ghost"
							size="sm"
							className="flex items-center gap-1 px-2"
						>
							<SquareSplitHorizontal size={14} />
							<span>Split</span>
						</Button>

						<Button
							disabled={!activeIds.length}
							onClick={doClone}
							variant="ghost"
							size="sm"
							className="flex items-center gap-1 px-2"
						>
							<SquareSplitHorizontal size={14} />
							<span>Clone</span>
						</Button>
					</div>

					{/* Center - Play controls and time */}
					<div className="flex items-center justify-center">
						<Button
							onClick={handlePlay}
							variant="ghost"
							size="icon"
						>
							{playing ? <Pause size={14} /> : <Play size={14} />}
						</Button>
						
						<div className="text-xs font-light flex items-center px-4">
							<span className="font-medium text-foreground">
								00:00
							</span>
							<span className="px-1">|</span>
							<span className="text-muted-foreground">
								{Math.floor(duration / 1000)}s
							</span>
						</div>
					</div>

					{/* Right side - Zoom controls */}
					<div className="flex items-center justify-end pr-2">
						<div className="flex border-l border-border/40 pl-4">
							<Button size="icon" variant="ghost" onClick={onZoomOut}>
								<ZoomOut size={16} />
							</Button>
							<div className="flex items-center px-2 text-xs text-muted-foreground">
								{Math.round(scale.zoom * 100)}%
							</div>
							<Button size="icon" variant="ghost" onClick={onZoomIn}>
								<ZoomIn size={16} />
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ResearchHeader;