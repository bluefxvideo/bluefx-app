import { Control, Resizable, ResizableProps } from "@designcombo/timeline";
import { IDisplay } from "@designcombo/types";

interface CaptionProps extends ResizableProps {
	id: string;
	text: string;
	tScale: number;
	display: IDisplay;
}

class Caption extends Resizable {
	static type = "caption";
	declare id: string;
	declare text: string;

	constructor(props: CaptionProps) {
		super(props);
		this.fill = "#4A9EFF"; // Blue color for captions
		this.id = props.id;
		this.borderColor = "transparent";
		this.stroke = "transparent";
		this.text = props.text || "Captions";
		// Match the standard height of other timeline items
		this.height = 40; // Standard height like text/audio items
	}

	public _render(ctx: CanvasRenderingContext2D) {
		super._render(ctx);
		this.drawCaptionIdentity(ctx);
		this.updateSelected(ctx);
	}

	public drawCaptionIdentity(ctx: CanvasRenderingContext2D) {
		// Draw subtitle/caption icon path
		const captionPath = new Path2D(
			"M2 6C2 4.89543 2.89543 4 4 4H20C21.1046 4 22 4.89543 22 6V14C22 15.1046 21.1046 16 20 16H4C2.89543 16 2 15.1046 2 14V6ZM4 6V14H20V6H4ZM6 8H18V10H6V8ZM6 12H14V14H6V12Z"
		);
		
		ctx.save();
		
		// Don't clip - this might be hiding the icon
		ctx.translate(-this.width / 2, -this.height / 2);
		
		// Position text more centrally and make it more visible
		const textY = this.height / 2; // Center vertically
		const textX = this.width / 2; // Center horizontally
		
		ctx.font = `bold 16px Inter`; // Make it larger and bold
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		
		// Draw the actual text content
		const displayText = this.text || 'Captions';
		// Limit text length to fit in the timeline item
		const maxLength = Math.floor(this.width / 12); // More conservative estimate
		const truncatedText = displayText.length > maxLength 
			? displayText.substring(0, maxLength) + '...'
			: displayText;
		
		// Draw text background for visibility
		const textWidth = ctx.measureText(truncatedText).width;
		ctx.fillStyle = "rgba(0, 0, 0, 0.8)"; // Black background
		ctx.fillRect(textX - textWidth/2 - 4, textY - 10, textWidth + 8, 20);
		
		// Draw white text on top
		ctx.fillStyle = "#ffffff"; // Pure white text
		ctx.fillText(truncatedText, textX, textY);

		// Draw the caption icon on the left
		ctx.translate(8, textY - 12);
		ctx.scale(0.8, 0.8); // Scale down the icon
		ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
		ctx.fill(captionPath);
		ctx.restore();
	}
}

export default Caption;