import { useCallback, useEffect, useState } from "react";
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
	Sparkles
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type StateManager from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import type { IDesign } from "@designcombo/types";
import { useDownloadState } from "./store/use-download-state";
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
	const isLargeScreen = useIsLargeScreen();
	const isMediumScreen = useIsMediumScreen();
	const isSmallScreen = useIsSmallScreen();

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

	return (
		<nav className="flex h-14 items-center justify-between border-b border-border/80 bg-background px-4">
			<DownloadProgressModal />
			
			{/* Left Section - Project Info */}
			<div className="flex items-center gap-4">
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
					className="text-muted-foreground hover:text-foreground"
				>
					<Save className="h-4 w-4" />
				</Button>
				
				<DownloadPopover stateManager={stateManager} />
				
				
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

const DownloadPopover = ({ stateManager }: { stateManager: StateManager }) => {
	const isMediumScreen = useIsMediumScreen();
	const { actions, exportType } = useDownloadState();
	const [isExportTypeOpen, setIsExportTypeOpen] = useState(false);
	const [open, setOpen] = useState(false);

	const handleExport = () => {
		const data: IDesign = {
			id: generateId(),
			...stateManager.getState(),
		};

		actions.setState({ payload: data });
		actions.startExport();
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

				<div>
					<Button onClick={handleExport} className="w-full">
						Export
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
