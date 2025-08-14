import { Track as TrackBase, TrackItemProps } from "@designcombo/timeline";

interface AITrackProps extends TrackItemProps {
	name?: string;
	type?: string;
	isLocked?: boolean;
	isVisible?: boolean;
}

class AITrack extends TrackBase {
	public name: string;
	public type: string;
	public isLocked: boolean;
	public isVisible: boolean;

	constructor(props: AITrackProps) {
		super({
			...props,
			fill: "rgba(55, 65, 81, 0.8)",
			stroke: "rgba(107, 114, 128, 1)",
			strokeWidth: 1,
		});

		this.name = props.name || `Track ${props.id || ''}`;
		this.type = props.type || 'default';
		this.isLocked = props.isLocked || false;
		this.isVisible = props.isVisible !== false;
	}

	// Override render method to show track info
	public _render(ctx: CanvasRenderingContext2D) {
		super._render(ctx);

		if (!this.isVisible) return;

		ctx.save();

		const width = this.width || 200;
		const height = this.height || 40;

		// Track background
		ctx.fillStyle = this.isLocked ? 'rgba(55, 65, 81, 0.6)' : 'rgba(55, 65, 81, 0.8)';
		ctx.fillRect(-width / 2, -height / 2, width, height);

		// Track border
		ctx.strokeStyle = this.isLocked ? 'rgba(239, 68, 68, 1)' : 'rgba(107, 114, 128, 1)';
		ctx.lineWidth = 1;
		ctx.strokeRect(-width / 2, -height / 2, width, height);

		// Track name
		ctx.fillStyle = this.isLocked ? '#9CA3AF' : '#F3F4F6';
		ctx.font = '12px Inter';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(this.name, -width / 2 + 10, 0);

		// Track type indicator
		ctx.textAlign = 'right';
		let typeIcon = '🎬';
		switch (this.type) {
			case 'video': typeIcon = '🎥'; break;
			case 'audio': typeIcon = '🔊'; break;
			case 'image': typeIcon = '🖼️'; break;
			case 'text': typeIcon = '📝'; break;
			case 'caption': typeIcon = '💬'; break;
		}
		ctx.fillText(typeIcon, width / 2 - 10, 0);

		// Lock indicator
		if (this.isLocked) {
			ctx.fillStyle = '#ef4444';
			ctx.font = '10px Inter';
			ctx.textAlign = 'right';
			ctx.fillText('🔒', width / 2 - 30, 0);
		}

		ctx.restore();
	}

	// Toggle lock state
	public toggleLock() {
		this.isLocked = !this.isLocked;
		this.canvas?.requestRenderAll();
	}

	// Toggle visibility
	public toggleVisibility() {
		this.isVisible = !this.isVisible;
		this.canvas?.requestRenderAll();
	}
}

export default AITrack;