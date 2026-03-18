import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDownloadState } from "./store/use-download-state";
import { Button } from "@/components/ui/button";
import { AlertCircle, CircleCheckIcon, XIcon } from "lucide-react";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";

const DownloadProgressModal = () => {
	const { progress, displayProgressModal, output, actions, projectId, exportError } =
		useDownloadState();
	const isCompleted = progress === 100;

	const handleDownload = () => {
		// URL is a Supabase public URL — opens instantly, no proxy needed
		const downloadUrl = output?.url;
		if (downloadUrl) {
			window.open(downloadUrl, '_blank');
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
					Export
				</div>
				{exportError ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-2 space-y-4">
						<div className="flex flex-col items-center space-y-1 text-center">
							<div className="text-red-500">
								<AlertCircle className="h-8 w-8" />
							</div>
							<div className="font-bold">Export Failed</div>
							<div className="text-muted-foreground max-w-md text-sm">
								{exportError}
							</div>
						</div>
						<Button onClick={() => {
							actions.clearActiveExport();
							actions.setDisplayProgressModal(false);
						}}>
							Close
						</Button>
					</div>
				) : isCompleted ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-2 space-y-4">
						<div className="flex flex-col items-center space-y-1 text-center">
							<div className="font-semibold">
								<CircleCheckIcon />
							</div>
							<div className="font-bold">Exported</div>
							<div className="text-muted-foreground">
								Your video is ready. You can also find it in your history.
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
							<div>Please keep this window open until the export is complete.</div>
							<div>The video will be saved in your history.</div>
						</div>
						<Button
							variant={"outline"}
							onClick={() => {
								actions.cancelExport();
								actions.setDisplayProgressModal(false);
							}}
						>
							Cancel
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default DownloadProgressModal;
