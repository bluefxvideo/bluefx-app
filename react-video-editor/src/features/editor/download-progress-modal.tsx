import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDownloadState } from "./store/use-download-state";
import { Button } from "@/components/ui/button";
import { CircleCheckIcon, XIcon } from "lucide-react";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { download } from "@/utils/download";
import { useEffect, useState } from "react";

const DownloadProgressModal = () => {
	const { progress, displayProgressModal, output, actions, projectId } =
		useDownloadState();
	const isCompleted = progress === 100;
	const [isStoringToSupabase, setIsStoringToSupabase] = useState(false);
	const [storedUrl, setStoredUrl] = useState<string | null>(null);

	// Store video to Supabase when export completes
	useEffect(() => {
		const storeVideoToSupabase = async () => {
			if (isCompleted && output?.url && !storedUrl && !isStoringToSupabase) {
				setIsStoringToSupabase(true);
				console.log("🔄 Storing exported video to Supabase...");
				
				try {
					// Get video_id from localStorage or session
					const storedData = localStorage.getItem('script-to-video-current');
					const videoData = storedData ? JSON.parse(storedData) : null;
					const video_id = videoData?.video_id || projectId;
					
					// Call API to store video
					const response = await fetch('/api/script-video/store-export', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							video_url: output.url,
							video_id,
							batch_id: videoData?.batch_id,
							duration_seconds: videoData?.duration || 30,
							file_size_mb: 10, // Estimate, can be calculated from blob
							export_settings: {
								format: 'mp4',
								quality: 'standard',
								fps: 30
							}
						})
					});

					if (response.ok) {
						const result = await response.json();
						console.log("✅ Video stored in Supabase:", result.video_url);
						setStoredUrl(result.video_url);
					} else {
						console.error("Failed to store video:", await response.text());
					}
				} catch (error) {
					console.error("Error storing video to Supabase:", error);
				} finally {
					setIsStoringToSupabase(false);
				}
			}
		};

		storeVideoToSupabase();
	}, [isCompleted, output?.url, storedUrl, isStoringToSupabase, projectId]);

	const handleDownload = async () => {
		// Always use the Remotion server URL for immediate download
		// The stored URL is for persistence, but Remotion URL works better for direct downloads
		const downloadUrl = output?.url;
		if (downloadUrl) {
			// Generate a meaningful filename with timestamp
			const now = new Date();
			const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
			const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
			const filename = `video-${dateStr}-${timeStr}`;
			
			await download(downloadUrl, filename);
			console.log("downloading from Remotion server:", filename, downloadUrl);
		}
	};
	return (
		<Dialog
			open={displayProgressModal}
			onOpenChange={actions.setDisplayProgressModal}
		>
			<DialogContent className="flex h-[627px] flex-col gap-0 bg-background p-0 sm:max-w-[844px]" showCloseButton={false}>
				<DialogTitle className="hidden" />
				<DialogDescription className="hidden" />
				<XIcon
					onClick={() => actions.setDisplayProgressModal(false)}
					className="absolute right-4 top-5 h-5 w-5 text-zinc-400 hover:cursor-pointer hover:text-zinc-500"
				/>
				<div className="flex h-16 items-center border-b px-4 font-medium">
					Download
				</div>
				{isCompleted ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-2 space-y-4">
						<div className="flex flex-col items-center space-y-1 text-center">
							<div className="font-semibold">
								<CircleCheckIcon />
							</div>
							<div className="font-bold">Exported</div>
							<div className="text-muted-foreground">
								You can download the video to your device.
							</div>
						</div>
						<Button onClick={handleDownload}>Download</Button>
					</div>
				) : (
					<div className="flex flex-1 flex-col items-center justify-center gap-4">
						<div className="text-5xl font-semibold">
							{Math.floor(progress)}%
						</div>
						<div className="font-bold">Exporting...</div>
						<div className="text-center text-zinc-500">
							<div>Closing the browser will not cancel the export.</div>
							<div>The video will be saved in your space.</div>
						</div>
						<Button variant={"outline"}>Cancel</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default DownloadProgressModal;
