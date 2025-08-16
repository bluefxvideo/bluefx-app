import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDownloadState } from "./store/use-download-state";
import { Button } from "@/components/ui/button";
import { CircleCheckIcon, XIcon } from "lucide-react";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { download } from "@/utils/download";
import { getAIGenerationInfo } from "../utils/ai-asset-loader";
import useStore from "../store/use-store";

const DownloadProgressModal = () => {
	const { progress, displayProgressModal, output, actions } =
		useDownloadState();
	const { trackItemsMap } = useStore();
	const isCompleted = progress === 100;

	const handleDownload = async () => {
		if (output?.url) {
			// Generate a meaningful filename
			let filename = "video";
			
			// Check if this is AI-generated content and use video ID
			const aiInfo = getAIGenerationInfo(trackItemsMap);
			if (aiInfo.hasAIContent && aiInfo.videoId) {
				filename = `ai-video-${aiInfo.videoId.slice(-8)}`;
			} else {
				// Fallback to timestamp
				const now = new Date();
				const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
				const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
				filename = `video-${dateStr}-${timeStr}`;
			}
			
			await download(output.url, filename);
			console.log("downloading:", filename);
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
