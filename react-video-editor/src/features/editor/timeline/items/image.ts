import {
	Resizable,
	ResizableProps,
	Pattern,
	util,
	Control,
} from "@designcombo/timeline";

interface ImageProps extends ResizableProps {
	src: string;
}

class Image extends Resizable {
	static type = "Image";
	public src: string;
	public hasSrc = true;

	constructor(props: ImageProps) {
		super(props);
		this.id = props.id;
		this.src = props.src;
		this.display = props.display;
		this.tScale = props.tScale;
		this.loadImage();
	}

	public _render(ctx: CanvasRenderingContext2D) {
		super._render(ctx);
		this.updateSelected(ctx);
	}

	public loadImage() {
		util.loadImage(this.src)
			.then((img) => {
				// Validate image before using
				if (!img || !img.width || !img.height) {
					console.warn('Invalid image loaded:', this.src);
					return;
				}
				
				const imgWidth = img.width;
				const imgHeight = img.height;
				const rectWidth = this.width;
				const rectHeight = this.height;
				
				// Calculate scale to fit image properly (cover mode)
				const scaleX = rectWidth / imgWidth;
				const scaleY = rectHeight / imgHeight;
				const scale = Math.max(scaleX, scaleY); // Use larger scale for cover effect
				
				// Calculate centering offset
				const scaledWidth = imgWidth * scale;
				const scaledHeight = imgHeight * scale;
				const offsetX = (rectWidth - scaledWidth) / 2;
				const offsetY = (rectHeight - scaledHeight) / 2;
				
				try {
					const pattern = new Pattern({
						source: img,
						repeat: "no-repeat", // No tiling - single centered image
						patternTransform: [scale, 0, 0, scale, offsetX, offsetY],
					});
					this.set("fill", pattern);
					this.canvas?.requestRenderAll();
				} catch (error) {
					console.error('Failed to create pattern for image:', this.src, error);
					// Fallback to solid color
					this.set("fill", "#cccccc");
					this.canvas?.requestRenderAll();
				}
			})
			.catch((error) => {
				console.error('Failed to load image:', this.src, error);
				// Fallback to solid color
				this.set("fill", "#cccccc");
				this.canvas?.requestRenderAll();
			});
	}

	public setSrc(src: string) {
		this.src = src;
		this.loadImage();
		this.canvas?.requestRenderAll();
	}
 
}

export default Image;
