import {
	Resizable,
	ResizableProps,
	Control,
	util,
} from "@designcombo/timeline";
import { IMetadata, ITrim } from "@designcombo/types";

interface AudioProps extends ResizableProps {
	id: string;
	details: {
		src: string;
		volume?: number;
	};
	metadata: IMetadata;
}

class AIAudio extends Resizable {
	public id: string;
	public details: AudioProps['details'];
	public metadata: IMetadata;
	private audioElement: HTMLAudioElement | null = null;
	private isAudioLoaded: boolean = false;
	private waveformData: number[] = [];

	constructor(props: AudioProps) {
		super({
			...props,
			fill: "rgba(168, 85, 247, 0.8)",
			stroke: "rgba(168, 85, 247, 1)",
			strokeWidth: 1,
			cornerStyle: "circle",
			cornerSize: 6,
			transparentCorners: false,
			cornerColor: "#ffffff",
			cornerStrokeColor: "rgba(168, 85, 247, 1)",
			hasRotatingPoint: false,
		});

		this.id = props.id;
		this.details = props.details;
		this.metadata = props.metadata;

		// Load audio
		if (this.details.src) {
			this.loadAudio();
		}

		// Set controls for resize handles
		this.controls = {
			...this.controls,
			ml: new Control({
				x: -0.5,
				y: 0,
				actionHandler: this.changeWidth,
				cursorStyleHandler: () => "ew-resize",
				actionName: "resizeX",
			}),
			mr: new Control({
				x: 0.5,
				y: 0,
				actionHandler: this.changeWidth,
				cursorStyleHandler: () => "ew-resize",
				actionName: "resizeX",
			}),
		};
	}

	private async loadAudio() {
		try {
			const audio = new Audio();
			audio.crossOrigin = 'anonymous';
			audio.preload = 'metadata';
			
			audio.onloadedmetadata = () => {
				this.audioElement = audio;
				this.isAudioLoaded = true;
				this.generateWaveform();
				this.canvas?.requestRenderAll();
			};
			
			audio.onerror = () => {
				console.error('Failed to load audio:', this.details.src);
			};
			
			audio.src = this.details.src;
		} catch (error) {
			console.error('Error loading audio:', error);
		}
	}

	private async generateWaveform() {
		// Simple waveform generation - in production you'd use Web Audio API
		// For now, generate fake waveform data
		const sampleCount = 100;
		this.waveformData = Array.from({ length: sampleCount }, () => 
			Math.random() * 0.8 + 0.1
		);
		this.canvas?.requestRenderAll();
	}

	public changeWidth = (eventData: any, transform: any, x: number, y: number) => {
		const target = transform.target;
		const localPoint = target.toLocalPoint({ x, y }, "center", "center");
		
		if (localPoint.x > 0) {
			target.set({ width: Math.abs(localPoint.x) * 2 });
		}
		
		return true;
	};

	// Handle scroll changes for performance
	public onScrollChange({ scrollLeft }: { scrollLeft: number }) {
		// Pause audio during scroll for performance
		if (this.audioElement && !this.audioElement.paused) {
			this.audioElement.pause();
		}
	}

	// Override render method to show waveform
	public _render(ctx: CanvasRenderingContext2D) {
		super._render(ctx);

		ctx.save();

		const width = this.width || 200;
		const height = this.height || 60;

		if (this.waveformData.length > 0) {
			// Draw waveform
			ctx.fillStyle = '#a855f7';
			ctx.strokeStyle = '#a855f7';
			ctx.lineWidth = 1;

			const barWidth = width / this.waveformData.length;
			const centerY = 0;

			for (let i = 0; i < this.waveformData.length; i++) {
				const barHeight = this.waveformData[i] * height * 0.8;
				const x = -width / 2 + i * barWidth;
				
				// Draw waveform bar
				ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
			}
		} else {
			// Draw placeholder
			ctx.fillStyle = '#374151';
			ctx.fillRect(-width / 2, -height / 2, width, height);

			// Placeholder icon and text
			ctx.fillStyle = '#9CA3AF';
			ctx.font = '14px Inter';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('🔊', 0, -10);
			ctx.fillText(this.isAudioLoaded ? 'Analyzing...' : 'Loading...', 0, 10);
		}

		// Draw audio info
		ctx.fillStyle = '#a855f7';
		ctx.font = '12px Inter';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'top';
		ctx.fillText('AUD', width / 2 - 10, -height / 2 + 10);

		// Draw volume level
		const volumeWidth = 40;
		const volumeHeight = 4;
		const volumeLevel = this.details.volume || 1;

		ctx.fillStyle = '#374151';
		ctx.fillRect(-width / 2 + 10, height / 2 - 15, volumeWidth, volumeHeight);
		
		ctx.fillStyle = '#a855f7';
		ctx.fillRect(-width / 2 + 10, height / 2 - 15, volumeWidth * volumeLevel, volumeHeight);

		// Volume indicator
		if (volumeLevel === 0) {
			ctx.fillStyle = '#ef4444';
			ctx.font = '12px Inter';
			ctx.textAlign = 'left';
			ctx.fillText('🔇', -width / 2 + 60, height / 2 - 15);
		}

		ctx.restore();
	}

	// Update audio source
	public updateSrc(newSrc: string) {
		this.details.src = newSrc;
		this.isAudioLoaded = false;
		this.audioElement = null;
		this.waveformData = [];
		if (newSrc) {
			this.loadAudio();
		}
	}

	// Cleanup audio resources
	public dispose() {
		if (this.audioElement) {
			this.audioElement.src = '';
			this.audioElement = null;
		}
		super.dispose();
	}
}

export default AIAudio;