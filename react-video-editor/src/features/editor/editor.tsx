"use client";
import Timeline from "./timeline";
import useStore from "./store/use-store";
import Navbar from "./navbar";
import useTimelineEvents from "./hooks/use-timeline-events";
import usePlayerEvents from "./hooks/use-player-events";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useDeleteHandler } from "./hooks/use-delete-handler";
import Scene from "./scene";
import { SceneRef } from "./scene/scene.types";
import StateManager, { DESIGN_LOAD } from "@designcombo/state";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { getCompactFontData, loadFonts } from "./utils/fonts";
import { SECONDARY_FONT, SECONDARY_FONT_URL } from "./constants/constants";
import MenuList from "./menu-list";
import { MenuItem } from "./menu-item";
import { ControlItem } from "./control-item";
import CropModal from "./crop-modal/crop-modal";
import useDataState from "./store/use-data-state";
import { FONTS } from "./data/fonts";
import FloatingControl from "./control-item/floating-controls/floating-control";
import { useSceneStore } from "@/store/use-scene-store";
import { dispatch } from "@designcombo/events";
import MenuListHorizontal from "./menu-list-horizontal";
import { useIsLargeScreen } from "@/hooks/use-media-query";
import { ITrackItem } from "@designcombo/types";
import useLayoutStore from "./store/use-layout-store";
import ControlItemHorizontal from "./control-item-horizontal";
import { loadAIAssetsFromURL } from "./utils/ai-asset-loader";

const stateManager = new StateManager({
	size: {
		width: 1080,
		height: 1920,
	},
});

const Editor = ({ tempId, id }: { tempId?: string; id?: string }) => {
	const [projectName, setProjectName] = useState<string>("Untitled video");
	const { scene } = useSceneStore();
	const timelinePanelRef = useRef<ImperativePanelHandle>(null);
	const sceneRef = useRef<SceneRef>(null);
	const { timeline, playerRef } = useStore();
	const { activeIds, trackItemsMap, transitionsMap } = useStore();
	const [loaded, setLoaded] = useState(false);
	const [trackItem, setTrackItem] = useState<ITrackItem | null>(null);
	const [hasLoadedDesign, setHasLoadedDesign] = useState(false);
	
	// Enhanced loading state management
	const [isLoadingAssets, setIsLoadingAssets] = useState(false);
	const [loadingSource, setLoadingSource] = useState<string | null>(null);
	const [loadingError, setLoadingError] = useState<string | null>(null);
	const {
		setTrackItem: setLayoutTrackItem,
		setFloatingControl,
		setLabelControlItem,
		setTypeControlItem,
	} = useLayoutStore();
	const isLargeScreen = useIsLargeScreen();

	useTimelineEvents();
	usePlayerEvents();
	useKeyboardShortcuts();
	useDeleteHandler(stateManager);
	
	// Atomic loading function to prevent race conditions
	const loadDesignAtomically = useCallback(async (
		loadFunction: () => Promise<{ payload: any; source: string }>,
		source: string
	) => {
		// Prevent concurrent loading
		if (isLoadingAssets || hasLoadedDesign) {
			console.log(`⏭️ Skipping ${source} - already loading or loaded`);
			return false;
		}
		
		setIsLoadingAssets(true);
		setLoadingSource(source);
		setLoadingError(null);
		
		try {
			console.log(`🔄 Starting atomic loading from: ${source}`);
			const { payload } = await loadFunction();
			
			if (payload) {
				console.log(`📤 Dispatching DESIGN_LOAD from: ${source}`);
				dispatch(DESIGN_LOAD, { payload });
				setHasLoadedDesign(true);
				console.log(`✅ Successfully loaded design from: ${source}`);
				return true;
			}
		} catch (error) {
			console.error(`❌ Failed to load from ${source}:`, error);
			setLoadingError(error instanceof Error ? error.message : 'Unknown error');
		} finally {
			setIsLoadingAssets(false);
			setLoadingSource(null);
		}
		
		return false;
	}, [isLoadingAssets, hasLoadedDesign]);

	const { setCompactFonts, setFonts } = useDataState();

	useEffect(() => {
		if (tempId) {
			loadDesignAtomically(async () => {
				const response = await fetch(`https://scheme.combo.sh/video-json/${id}`);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const data = await response.json();
				return { 
					payload: data.videoJson.json, 
					source: 'tempId-video-json' 
				};
			}, 'tempId-video-json');
		}

		if (id) {
			loadDesignAtomically(async () => {
				const response = await fetch(`/api/scene/${id}`);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const data = await response.json();
				console.log("Fetched scene data:", data);

				if (data.success && data.scene) {
					// Set project name if available
					if (data.project?.name) {
						setProjectName(data.project.name);
					}
					
					return { 
						payload: data.scene.content, 
						source: 'scene-by-id' 
					};
				} else {
					throw new Error(data.error || "Failed to fetch scene");
				}
			}, 'scene-by-id');
		}
	}, [id, tempId, loadDesignAtomically]);

	useEffect(() => {
		console.log("scene", scene);
		console.log("timeline", timeline);
		if (scene && timeline && !hasLoadedDesign && !isLoadingAssets) {
			console.log("scene", scene);
			loadDesignAtomically(async () => {
				return { payload: scene, source: 'scene-store' };
			}, 'scene-store');
		}
	}, [scene, timeline, hasLoadedDesign, isLoadingAssets, loadDesignAtomically]);

	useEffect(() => {
		setCompactFonts(getCompactFontData(FONTS));
		setFonts(FONTS);
	}, []);

	useEffect(() => {
		loadFonts([
			{
				name: SECONDARY_FONT,
				url: SECONDARY_FONT_URL,
			},
		]);
	}, []);

	useEffect(() => {
		const screenHeight = window.innerHeight;
		const desiredHeight = 300;
		const percentage = (desiredHeight / screenHeight) * 100;
		timelinePanelRef.current?.resize(percentage);
	}, []);

	const handleTimelineResize = () => {
		const timelineContainer = document.getElementById("timeline-container");
		if (!timelineContainer) return;

		timeline?.resize(
			{
				height: timelineContainer.clientHeight - 90,
				width: timelineContainer.clientWidth - 40,
			},
			{
				force: true,
			},
		);

		// Trigger zoom recalculation when timeline is resized
		setTimeout(() => {
			sceneRef.current?.recalculateZoom();
		}, 100);
	};

	useEffect(() => {
		const onResize = () => handleTimelineResize();
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [timeline]);

	useEffect(() => {
		if (activeIds.length === 1) {
			const [id] = activeIds;
			const trackItem = trackItemsMap[id];
			if (trackItem) {
				setTrackItem(trackItem);
				setLayoutTrackItem(trackItem);
			} else console.log(transitionsMap[id]);
		} else {
			setTrackItem(null);
			setLayoutTrackItem(null);
		}
	}, [activeIds, trackItemsMap]);

	useEffect(() => {
		setFloatingControl("");
		setLabelControlItem("");
		setTypeControlItem("");
	}, [isLargeScreen]);

	useEffect(() => {
		setLoaded(true);
	}, []);

	// Load AI-generated assets from URL parameters with highest priority
	useEffect(() => {
		console.log('🚀 EDITOR: Starting AI asset loading useEffect');
		
		const loadAIAssets = async () => {
			try {
				// Give AI loading highest priority by loading it immediately
				const result = await loadAIAssetsFromURL();
				console.log('🚀 EDITOR: Result from loadAIAssetsFromURL:', result);
				
				if (result.success) {
					console.log('✅ AI assets loaded from URL:', result.video_id);
					setProjectName(`AI Video - ${result.video_id}`);
					// The loadAIAssetsFromURL already dispatches DESIGN_LOAD
					setHasLoadedDesign(true);
					setIsLoadingAssets(false); // Clear loading state
					setLoadingSource(null);
				} else if (!result.skipped) {
					console.log('ℹ️ No AI assets to load from URL');
					setIsLoadingAssets(false);
					setLoadingSource(null);
				} else {
					console.log('⏭️ Skipped AI asset loading:', result.reason);
					setIsLoadingAssets(false);
					setLoadingSource(null);
				}
			} catch (error) {
				console.error('❌ Failed to load AI assets from URL:', error);
				setLoadingError(error instanceof Error ? error.message : 'AI loading failed');
				setIsLoadingAssets(false); // Clear loading state on error
				setLoadingSource(null);
			}
		};

		// Run AI loading immediately on mount if URL params exist
		const urlParams = new URLSearchParams(window.location.search);
		const hasVideoId = urlParams.get('videoId');
		const hasLegacyId = urlParams.get('loadAI');
		const hasMockMode = urlParams.get('mock') === 'true';
		const hasStoryboardId = urlParams.get('storyboardId');

		// Store auth token if provided
		const tokenFromUrl = urlParams.get('token');
		if (tokenFromUrl) {
			localStorage.setItem('editor-auth-token', tokenFromUrl);
			console.log('🔐 Auth token stored from URL');
		}

		if (hasVideoId || hasLegacyId || hasMockMode || hasStoryboardId) {
			console.log('🎯 Asset URL parameters detected - starting priority loading', {
				hasVideoId,
				hasLegacyId,
				hasMockMode,
				hasStoryboardId
			});
			setIsLoadingAssets(true); // Show loading state
			setLoadingSource(hasStoryboardId ? 'Storyboard-frames' : 'AI-assets');

			// Load assets directly without pre-clearing (prevents double DESIGN_LOAD)
			loadAIAssets();
		}
	}, []); // Empty dependency array - run only once on mount

	return (
		<div className="flex h-screen w-screen flex-col bg-background">
			<Navbar
				projectName={projectName}
				user={null}
				stateManager={stateManager}
				setProjectName={setProjectName}
			/>
			
			{/* Main Editor Layout - Three Panel Design */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left Sidebar - Assets & Menu */}
				<div className="flex flex-none border-r border-border/80 bg-muted/50 h-[calc(100vh-56px)]">
					<MenuList />
					<MenuItem />
				</div>

				{/* Center - Scene & Timeline */}
				<ResizablePanelGroup 
					direction="vertical" 
					className="flex-1"
				>
					{/* Scene/Preview Panel */}
					<ResizablePanel 
						className="relative min-h-[200px]" 
						defaultSize={70}
					>
						<FloatingControl />
						<div
							style={{
								width: "100%",
								height: "100%",
								position: "relative",
								flex: 1,
								overflow: "hidden",
							}}
						>
							<CropModal />
							<Scene ref={sceneRef} stateManager={stateManager} />
						</div>
					</ResizablePanel>

					<ResizableHandle className="border-border/80" />

					{/* Timeline Panel */}
					<ResizablePanel
						className="min-h-[300px]"
						ref={timelinePanelRef}
						defaultSize={30}
						onResize={handleTimelineResize}
					>
						{isLoadingAssets ? (
							<div className="flex items-center justify-center h-full bg-muted/50">
								<div className="text-center">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
									<p className="text-sm text-muted-foreground">
										Loading {loadingSource}...
									</p>
									{loadingError && (
										<p className="text-xs text-red-500 mt-2">{loadingError}</p>
									)}
								</div>
							</div>
						) : (
							playerRef && <Timeline stateManager={stateManager} />
						)}
					</ResizablePanel>
				</ResizablePanelGroup>

				{/* Right Sidebar - Properties Panel */}
				<ControlItem />
				
				{/* Mobile/Tablet Layout Fallbacks */}
				{!isLargeScreen && !trackItem && loaded && <MenuListHorizontal />}
				{!isLargeScreen && trackItem && <ControlItemHorizontal />}
			</div>
		</div>
	);
};

export default Editor;
