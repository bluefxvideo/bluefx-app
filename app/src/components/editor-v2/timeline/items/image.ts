import {
	Resizable,
	ResizableProps,
	Pattern,
	util,
} from "@designcombo/timeline";

interface ImageProps extends ResizableProps {
	src?: string;
}

class AIImage extends Resizable {
	static type = "Image";
	public src: string;
	public hasSrc = true;

	constructor(props: ImageProps) {
		super(props);
		this.id = props.id;
		this.src = props.src || '';
		this.display = props.display;
		this.tScale = props.tScale;
		this.fill = "#10b981";
		
		if (this.src) {
			this.loadImage();
		}
	}

	public _render(ctx: CanvasRenderingContext2D) {
		super._render(ctx);
		this.updateSelected(ctx);
	}

	public loadImage() {
		if (!this.src) return;
		
		util.loadImage(this.src).then((img) => {
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
		}).catch(() => {
			console.error('Failed to load image:', this.src);
		});
	}

	public setSrc(src: string) {
		this.src = src;
		this.loadImage();
		this.canvas?.requestRenderAll();
	}
}

export default AIImage;