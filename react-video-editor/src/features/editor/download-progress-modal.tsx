import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDownloadState } from "./store/use-download-state";
import { Button } from "@/components/ui/button";
import { CircleCheckIcon, XIcon } from "lucide-react";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { download } from "@/utils/download";
import { useEffect } from "react";

const DownloadProgressModal = () => {
	const { progress, displayProgressModal, output, actions, projectId } =
		useDownloadState();
	const isCompleted = progress === 100;

	// Log the Remotion URL when export completes
	useEffect(() => {
		if (isCompleted && output?.url) {
			console.log("✅ Video available at Remotion URL:", output.url);
			// The video is directly accessible via the Remotion server URL
			// No need to store it elsewhere as it's already publicly accessible
		}
	}, [isCompleted, output?.url]);

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
					onClick={() => {
						actions.setDisplayProgressModal(false);
					}}
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
