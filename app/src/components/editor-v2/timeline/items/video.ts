import {
	Trimmable,
	TrimmableProps,
	Pattern,
	util,
} from "@designcombo/timeline";
import { IDisplay, IMetadata, ITrim } from "@designcombo/types";

interface VideoProps extends TrimmableProps {
	aspectRatio: number;
	trim: ITrim;
	duration: number;
	src: string;
	metadata: Partial<IMetadata> & {
		previewUrl: string;
	};
}

class AIVideo extends Trimmable {
	static type = "Video";
	public src: string;
	public hasSrc = true;
	declare id: string;
	declare tScale: number;
	declare display: IDisplay;
	declare trim: ITrim;
	declare duration: number;
	public aspectRatio = 1;
	public metadata?: Partial<IMetadata>;

	constructor(props: VideoProps) {
		super(props);
		this.id = props.id;
		this.tScale = props.tScale;
		this.objectCaching = false;
		this.rx = 4;
		this.ry = 4;
		this.display = props.display;
		this.trim = props.trim;
		this.duration = props.duration;
		this.fill = "#27272a";
		this.aspectRatio = props.aspectRatio;
		this.src = props.src;
		this.strokeWidth = 0;
		this.transparentCorners = false;
		this.hasBorders = false;
		this.metadata = props.metadata;
		
		// Load video preview/thumbnail
		if (this.metadata?.previewUrl) {
			this.loadPreview();
		}
	}

	public _render(ctx: CanvasRenderingContext2D) {
		super._render(ctx);
		this.updateSelected(ctx);
	}

	private async loadPreview() {
		if (!this.metadata?.previewUrl) return;
		
		try {
			const img = await util.loadImage(this.metadata.previewUrl);
			const imgHeight = img.height;
			const rectHeight = this.height;
			const scaleY = rectHeight / imgHeight;
			const pattern = new Pattern({
				source: img,
				repeat: "repeat-x",
				patternTransform: [scaleY, 0, 0, scaleY, 0, 0],
			});
			this.set("fill", pattern);
			this.canvas?.requestRenderAll();
		} catch (error) {
			console.error('Failed to load video preview:', this.metadata?.previewUrl);
		}
	}

	public setSrc(src: string) {
		this.src = src;
		this.canvas?.requestRenderAll();
	}

	public setDuration(duration: number) {
		this.duration = duration;
	}
}

export default AIVideo;