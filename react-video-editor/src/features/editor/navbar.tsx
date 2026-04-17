import { useCallback, useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { dispatch } from "@designcombo/events";
import { HISTORY_UNDO, HISTORY_REDO, DESIGN_RESIZE } from "@designcombo/state";
import { Icons } from "@/components/shared/icons";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	ChevronDown,
	Download,
	ProportionsIcon,
	ShareIcon,
	Play,
	Pause,
	SkipBack,
	SkipForward,
	Save,
	Undo,
	Redo,
	Settings,
	Sparkles,
	Loader2,
	Check,
	ArrowLeft,
	X
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type StateManager from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import type { IDesign } from "@designcombo/types";
import { useDownloadState } from "./store/use-download-state";
import { useBatchAnimateState } from "./store/use-batch-animate-state";
import DownloadProgressModal from "./download-progress-modal";
import AutosizeInput from "@/components/ui/autosize-input";
import { debounce } from "lodash";
import {
	useIsLargeScreen,
	useIsMediumScreen,
	useIsSmallScreen,
} from "@/hooks/use-media-query";

import { LogoIcons } from "@/components/shared/logos";
import Link from "next/link";
import { saveComposition, AutoSaveManager } from "./utils/save-composition";
import { Coins } from "lucide-react";
import useStore from "./store/use-store";
import { downloadFCPXMLProject, downloadFCPXMLOnly } from "@/utils/editor-to-fcpxml-converter";

export default function Navbar({
	user,
	stateManager,
	setProjectName,
	projectName,
}: {
	user: any | null;
	stateManager: StateManager;
	setProjectName: (name: string) => void;
	projectName: string;
}) {
	const [title, setTitle] = useState(projectName);
	const [isSaving, setIsSaving] = useState(false);
	const [lastSaved, setLastSaved] = useState<Date | null>(null);
	const isLargeScreen = useIsLargeScreen();
	const isMediumScreen = useIsMediumScreen();
	const isSmallScreen = useIsSmallScreen();
	const autoSaveManagerRef = useRef<AutoSaveManager | null>(null);

	// Get URL parameters for save functionality
	const getUrlParams = () => {
		const urlParams = new URLSearchParams(window.location.search);
		return {
			userId: urlParams.get('userId') || '',
			videoId: urlParams.get('videoId') || urlParams.get('listingId') || urlParams.get('storyboardId') || '',
			apiUrl: urlParams.get('apiUrl') || window.location.origin
		};
	};

	const handleSave = async () => {
		const { userId, videoId, apiUrl } = getUrlParams();
		
		if (!userId) {
			console.error("Cannot save: No user ID found");
			return;
		}
		
		setIsSaving(true);
		
		try {
			const result = await saveComposition(stateManager, {
				userId,
				videoId,
				apiUrl,
				metadata: {
					projectName: title,
					manual_save: true
				}
			});
			
			if (result.success) {
				setLastSaved(new Date());
				console.log("✅ Composition saved successfully");
			} else {
				throw new Error(result.error);
			}
		} catch (error) {
			console.error("❌ Save failed:", error);
		} finally {
			setIsSaving(false);
		}
	};

	// Initialize auto-save if we have user context
	useEffect(() => {
		const { userId, videoId, apiUrl } = getUrlParams();
		
		if (userId) {
			// Create auto-save manager
			autoSaveManagerRef.current = new AutoSaveManager(stateManager, {
				userId,
				videoId,
				apiUrl,
				metadata: {
					projectName: title
				}
			});
			
			// Expose to window for global access
			(window as any).autoSaveManager = autoSaveManagerRef.current;
			
			// Subscribe to state changes for auto-save
			const handleStateChange = () => {
				autoSaveManagerRef.current?.triggerAutoSave();
			};

			const sub1 = stateManager.subscribeToState(handleStateChange);
			const sub2 = stateManager.subscribeToAddOrRemoveItems(handleStateChange);
			const sub3 = stateManager.subscribeToUpdateItemDetails(handleStateChange);

			return () => {
				autoSaveManagerRef.current?.destroy();
				(window as any).autoSaveManager = null;
				sub1.unsubscribe();
				sub2.unsubscribe();
				sub3.unsubscribe();
			};
		}
	}, [stateManager, title]);

	const handleUndo = () => {
		dispatch(HISTORY_UNDO);
	};

	const handleRedo = () => {
		dispatch(HISTORY_REDO);
	};

	const handleCreateProject = async () => {};

	// Create a debounced function for setting the project name
	const debouncedSetProjectName = useCallback(
		debounce((name: string) => {
			console.log("Debounced setProjectName:", name);
			setProjectName(name);
		}, 2000), // 2 seconds delay
		[],
	);

	// Update the debounced function whenever the title changes
	useEffect(() => {
		debouncedSetProjectName(title);
	}, [title, debouncedSetProjectName]);

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setTitle(e.target.value);
	};

	// Handle back navigation to main app
	const handleBackToApp = () => {
		const { apiUrl } = getUrlParams();
		const mainAppUrl = apiUrl || window.location.origin;
		// Detect which flow this came from by checking URL params
		const urlParams = new URLSearchParams(window.location.search);
		const isReelEstate = urlParams.has('listingId');
		const isStoryboard = urlParams.has('storyboardId');
		const targetPath = isReelEstate
			? '/dashboard/reelestate'
			: isStoryboard
				? '/dashboard/ai-cinematographer'
				: '/dashboard/script-to-video';
		window.location.href = `${mainAppUrl}${targetPath}`;
	};

	return (
		<nav className="flex h-14 items-center justify-between border-b border-border/80 bg-background px-[10px]">
			<DownloadProgressModal />

			{/* Left Section - Project Info */}
			<div className="flex items-center gap-[10px]">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleBackToApp}
					className="text-muted-foreground hover:text-foreground"
					title={(() => {
						const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
						if (params.has('listingId')) return 'Back to ReelEstate';
						if (params.has('storyboardId')) return 'Back to Storyboard';
						return 'Back to BlueFX';
					})()}
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>

				<div className="h-6 w-px bg-border/80" />

				<div className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-cyan-500">
						<Sparkles className="h-4 w-4 text-white" />
					</div>
					<span className="text-sm font-semibold">BlueFX Editor</span>
				</div>

				<div className="h-6 w-px bg-border/80" />

				<div className="flex items-center gap-2">
					<Input
						value={title}
						onChange={handleTitleChange}
						className="h-8 w-48 border-0 bg-transparent text-sm font-medium focus-visible:bg-muted focus-visible:ring-1"
						placeholder="Project name..."
					/>
				</div>
			</div>
			
			{/* Center Section - Playback Controls (placeholder for now) */}
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled
				>
					<SkipBack className="h-4 w-4" />
				</Button>
				
				<Button
					variant="outline"
					size="sm"
					className="h-9 w-9"
					disabled
				>
					<Play className="h-4 w-4" />
				</Button>
				
				<Button
					variant="outline"
					size="sm"
					disabled
				>
					<SkipForward className="h-4 w-4" />
				</Button>
			</div>
			
			{/* Right Section - Actions */}
			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleUndo}
					className="text-muted-foreground"
				>
					<Undo className="h-4 w-4" />
				</Button>
				
				<Button
					variant="ghost"
					size="sm"
					onClick={handleRedo}
					className="text-muted-foreground"
				>
					<Redo className="h-4 w-4" />
				</Button>
				
				<div className="h-6 w-px bg-border/80" />
				
				<Button
					variant="ghost"
					size="sm"
					onClick={handleSave}
					disabled={isSaving}
					className={cn(
						"text-muted-foreground hover:text-foreground",
						lastSaved && "text-green-600 hover:text-green-700"
					)}
					title={lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : "Save composition"}
				>
					{isSaving ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : lastSaved ? (
						<Check className="h-4 w-4" />
					) : (
						<Save className="h-4 w-4" />
					)}
				</Button>
				
				<CreditDisplay />

				<DownloadPopover stateManager={stateManager} />

				<CheckActiveExportButton />

				<BatchAnimateIndicator />

				<Button
					variant="ghost"
					size="sm"
					className="text-muted-foreground"
				>
					<Settings className="h-4 w-4" />
				</Button>
			</div>
		</nav>
	);
}

// Button to check and reopen active exports
const CheckActiveExportButton = () => {
	const { activeRenderVideoId, exporting, actions } = useDownloadState();
	
	// Don't show button if no active render or if already showing progress
	if (!activeRenderVideoId || exporting) {
		return null;
	}
	
	return (
		<Button
			variant="outline"
			size="sm"
			onClick={() => actions.checkActiveExport()}
			className="flex gap-1 animate-pulse"
		>
			<Loader2 className="h-4 w-4 mr-1 animate-spin" />
			View Export
		</Button>
	);
};

// Persistent indicator for batch image animation
const BatchAnimateIndicator = () => {
	const { isActive, items, actions } = useBatchAnimateState();

	if (!isActive || items.length === 0) return null;

	const doneCount = items.filter((i) => i.status === "done").length;

	return (
		<div className="flex items-center gap-1">
			<Button
				variant="outline"
				size="sm"
				className="flex gap-1 animate-pulse cursor-default"
			>
				<Loader2 className="h-4 w-4 animate-spin" />
				Animating {doneCount}/{items.length}
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 text-muted-foreground hover:text-destructive"
				onClick={() => actions.cancelAll()}
				title="Cancel all animations"
			>
				<X className="h-3 w-3" />
			</Button>
		</div>
	);
};

// Credit balance display — fetches on mount and exposes refresh via window
const CreditDisplay = () => {
	const [credits, setCredits] = useState<number | null>(null);

	const fetchCredits = useCallback(async () => {
		const urlParams = new URLSearchParams(window.location.search);
		const userId = urlParams.get("userId");
		const apiUrl = urlParams.get("apiUrl") || window.location.origin;
		if (!userId) return;
		try {
			const res = await fetch(`${apiUrl}/api/editor/credits?userId=${userId}`);
			const data = await res.json();
			if (data.success) {
				setCredits(data.credits);
			}
		} catch {
			// Silently fail — credits just won't show
		}
	}, []);

	useEffect(() => {
		fetchCredits();
		// Expose refresh function globally so animate/edit controls can trigger it
		(window as any).refreshEditorCredits = fetchCredits;
		return () => {
			(window as any).refreshEditorCredits = null;
		};
	}, [fetchCredits]);

	if (credits === null) return null;

	return (
		<div className="flex items-center gap-1 text-xs text-muted-foreground px-2">
			<Coins className="h-3.5 w-3.5" />
			<span>{credits}</span>
		</div>
	);
};

const DownloadPopover = ({ stateManager }: { stateManager: StateManager }) => {
	const isMediumScreen = useIsMediumScreen();
	const { actions, exportType, exporting, activeRenderVideoId } = useDownloadState();
	const [isExportTypeOpen, setIsExportTypeOpen] = useState(false);
	const [open, setOpen] = useState(false);

	const handleXMLExport = () => {
		const fullState = stateManager.getState();
		const { hiddenTrackIds } = useStore.getState();
		let filteredTrackItemsMap = fullState.trackItemsMap;
		let filteredTrackItemIds = fullState.trackItemIds;
		let filteredTracks = fullState.tracks;

		if (hiddenTrackIds.size > 0) {
			filteredTrackItemsMap = Object.fromEntries(
				Object.entries(fullState.trackItemsMap).filter(([id]) => !hiddenTrackIds.has(id))
			);
			filteredTrackItemIds = fullState.trackItemIds.filter((id: string) => !hiddenTrackIds.has(id));
			filteredTracks = fullState.tracks.map((track: any) => ({
				...track,
				items: track.items.filter((id: string) => !hiddenTrackIds.has(id)),
			})).filter((track: any) => track.items.length > 0);
		}

		const data: IDesign = {
			id: generateId(),
			...fullState,
			trackItemsMap: filteredTrackItemsMap,
			trackItemIds: filteredTrackItemIds,
			tracks: filteredTracks,
		};

		const result = downloadFCPXMLProject(data, "BlueFX_Project");
		console.log(`📦 XML project exported — ${result.mediaFiles} media files downloading`);
		setOpen(false);
	};

	const handleXMLOnly = () => {
		const fullState = stateManager.getState();
		const { hiddenTrackIds } = useStore.getState();
		let filteredTrackItemsMap = fullState.trackItemsMap;
		let filteredTrackItemIds = fullState.trackItemIds;
		let filteredTracks = fullState.tracks;

		if (hiddenTrackIds.size > 0) {
			filteredTrackItemsMap = Object.fromEntries(
				Object.entries(fullState.trackItemsMap).filter(([id]) => !hiddenTrackIds.has(id))
			);
			filteredTrackItemIds = fullState.trackItemIds.filter((id: string) => !hiddenTrackIds.has(id));
			filteredTracks = fullState.tracks.map((track: any) => ({
				...track,
				items: track.items.filter((id: string) => !hiddenTrackIds.has(id)),
			})).filter((track: any) => track.items.length > 0);
		}

		const data: IDesign = {
			id: generateId(),
			...fullState,
			trackItemsMap: filteredTrackItemsMap,
			trackItemIds: filteredTrackItemIds,
			tracks: filteredTracks,
		};

		downloadFCPXMLOnly(data, "BlueFX_Project");
		console.log('📄 XML-only exported');
		setOpen(false);
	};

	const handleExport = () => {
		// Check if there's already an active export
		if (exporting || activeRenderVideoId) {
			// If already exporting, just open the progress modal
			actions.setDisplayProgressModal(true);
			setOpen(false); // Close the popover
			return;
		}

		// Only start a new export if not already exporting
		const fullState = stateManager.getState();

		// Filter out hidden tracks so they don't appear in the rendered video
		const { hiddenTrackIds } = useStore.getState();
		let filteredTrackItemsMap = fullState.trackItemsMap;
		let filteredTrackItemIds = fullState.trackItemIds;
		let filteredTracks = fullState.tracks;

		if (hiddenTrackIds.size > 0) {
			console.log('🙈 Filtering out hidden tracks for export:', [...hiddenTrackIds]);
			filteredTrackItemsMap = Object.fromEntries(
				Object.entries(fullState.trackItemsMap).filter(([id]) => !hiddenTrackIds.has(id))
			);
			filteredTrackItemIds = fullState.trackItemIds.filter((id: string) => !hiddenTrackIds.has(id));
			filteredTracks = fullState.tracks.map((track: any) => ({
				...track,
				items: track.items.filter((id: string) => !hiddenTrackIds.has(id)),
			})).filter((track: any) => track.items.length > 0);
		}

		const data: IDesign = {
			id: generateId(),
			...fullState,
			trackItemsMap: filteredTrackItemsMap,
			trackItemIds: filteredTrackItemIds,
			tracks: filteredTracks,
		};

		actions.setState({ payload: data });
		actions.startExport();
		setOpen(false); // Close the popover after starting export
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="flex gap-1"
				>
					<Download className="h-4 w-4 mr-1" />
					Export
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="bg-sidebar z-[250] flex w-60 flex-col gap-4"
			>
				<Label>Export settings</Label>

				<Popover open={isExportTypeOpen} onOpenChange={setIsExportTypeOpen}>
					<PopoverTrigger asChild>
						<Button className="w-full justify-between" variant="outline">
							<div>{exportType.toUpperCase()}</div>
							<ChevronDown width={16} />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="bg-background z-[251] w-[--radix-popover-trigger-width] px-2 py-2">
						<div
							className="flex h-7 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-zinc-800"
							onClick={() => {
								actions.setExportType("mp4");
								setIsExportTypeOpen(false);
							}}
						>
							MP4
						</div>
						<div
							className="flex h-7 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-zinc-800"
							onClick={() => {
								actions.setExportType("json");
								setIsExportTypeOpen(false);
							}}
						>
							JSON
						</div>
					</PopoverContent>
				</Popover>

				<div className="flex flex-col gap-2">
					<Button onClick={handleExport} className="w-full">
						{(exporting || activeRenderVideoId) ? "View Export Progress" : "Export"}
					</Button>
					<Button onClick={handleXMLOnly} variant="outline" className="w-full text-xs">
						Download XML Only
					</Button>
					<Button onClick={handleXMLExport} variant="ghost" className="w-full text-xs">
						Download XML + All Media
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
};

interface ResizeOptionProps {
	label: string;
	icon: string;
	value: ResizeValue;
	description: string;
}

interface ResizeValue {
	width: number;
	height: number;
	name: string;
}

const RESIZE_OPTIONS: ResizeOptionProps[] = [
	{
		label: "16:9",
		icon: "landscape",
		description: "YouTube ads",
		value: {
			width: 1920,
			height: 1080,
			name: "16:9",
		},
	},
	{
		label: "9:16",
		icon: "portrait",
		description: "TikTok, YouTube Shorts",
		value: {
			width: 1080,
			height: 1920,
			name: "9:16",
		},
	},
	{
		label: "1:1",
		icon: "square",
		description: "Instagram, Facebook posts",
		value: {
			width: 1080,
			height: 1080,
			name: "1:1",
		},
	},
];

const ResizeVideo = () => {
	const handleResize = (options: ResizeValue) => {
		dispatch(DESIGN_RESIZE, {
			payload: {
				...options,
			},
		});
	};
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button className="z-10 h-7 gap-2" variant="outline" size={"sm"}>
					<ProportionsIcon className="h-4 w-4" />
					<div>Resize</div>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="z-[250] w-60 px-2.5 py-3">
				<div className="text-sm">
					{RESIZE_OPTIONS.map((option, index) => (
						<ResizeOption
							key={index}
							label={option.label}
							icon={option.icon}
							value={option.value}
							handleResize={handleResize}
							description={option.description}
						/>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
};

const ResizeOption = ({
	label,
	icon,
	value,
	description,
	handleResize,
}: ResizeOptionProps & { handleResize: (payload: ResizeValue) => void }) => {
	const Icon = Icons[icon as "text"];
	return (
		<div
			onClick={() => handleResize(value)}
			className="flex cursor-pointer items-center rounded-md p-2 hover:bg-zinc-50/10"
		>
			<div className="w-8 text-muted-foreground">
				<Icon size={20} />
			</div>
			<div>
				<div>{label}</div>
				<div className="text-xs text-muted-foreground">{description}</div>
			</div>
		</div>
	);
};
