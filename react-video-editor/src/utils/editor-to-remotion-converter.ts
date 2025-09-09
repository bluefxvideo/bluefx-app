import { IDesign, ITrackItem } from "@designcombo/types";

/**
 * Editor to Remotion Converter
 * Converts React Video Editor format (IDesign) to Remotion composition format
 */

// Remotion layer interfaces
interface RemotionLayer {
  id: string;
  startFrame: number;
  durationInFrames: number;
}

interface AudioLayer extends RemotionLayer {
  type: 'audio';
  src: string;
  volume: number;
  startFrom?: number; // Trim start in frames
  endAt?: number;     // Trim end in frames
}

interface ImageLayer extends RemotionLayer {
  type: 'image';
  src: string;
  style: {
    position: 'absolute';
    top: string | number;
    left: string | number;
    width: number;
    height: number;
    transform?: string;
    opacity?: number;
    borderRadius?: number;
    filter?: string;
  };
}

interface VideoLayer extends RemotionLayer {
  type: 'video';
  src: string;
  volume: number;
  startFrom?: number; // Trim start in frames
  endAt?: number;     // Trim end in frames
  style: {
    position: 'absolute';
    top: string | number;
    left: string | number;
    width: number;
    height: number;
    transform?: string;
    opacity?: number;
  };
}

interface TextLayer extends RemotionLayer {
  type: 'text';
  text: string;
  style: {
    position: 'absolute';
    top: string | number;
    left: string | number;
    fontSize: number;
    fontFamily: string;
    fontWeight?: string | number;
    color: string;
    textAlign: 'left' | 'center' | 'right';
    backgroundColor?: string;
    padding?: string;
    borderRadius?: number;
    width?: number;
    height?: number;
    lineHeight?: number;
    letterSpacing?: number;
  };
}

interface CaptionLayer extends RemotionLayer {
  type: 'caption';
  segments: Array<{
    start: number; // milliseconds
    end: number;   // milliseconds
    text: string;
    words: Array<{
      word: string;
      start: number; // milliseconds
      end: number;   // milliseconds
      confidence?: number;
    }>;
    style?: {
      fontSize?: number;
      activeColor?: string;
      appearedColor?: string;
      color?: string;
    };
  }>;
  style: {
    position: 'absolute';
    top: string | number;
    left: string | number;
    fontSize: number;
    fontFamily: string;
    textAlign: 'left' | 'center' | 'right';
    color: string;
    activeColor?: string;
    appearedColor?: string;
    backgroundColor?: string;
    width?: number;
    height?: number;
  };
}

// Main conversion output
export interface RemotionCompositionData {
  audioLayers: AudioLayer[];
  imageLayers: ImageLayer[];
  videoLayers: VideoLayer[];
  textLayers: TextLayer[];
  captionLayers: CaptionLayer[];
  composition: {
    id: string;
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
  };
}

/**
 * Main converter class
 */
export class EditorToRemotionConverter {
  
  /**
   * Convert complete editor design to Remotion format
   */
  static convertDesign(design: IDesign): RemotionCompositionData {
    console.log('🔄 Converting editor design to Remotion format:', design);
    
    const fps = design.fps || 30;
    const durationMs = design.duration || 30000;
    const durationInFrames = Math.ceil((durationMs / 1000) * fps);
    
    const trackItems = Object.values(design.trackItemsMap || {});
    
    // Convert each track item type
    const audioLayers = this.convertAudioTracks(trackItems, fps);
    const imageLayers = this.convertImageTracks(trackItems, fps);
    const videoLayers = this.convertVideoTracks(trackItems, fps);
    const textLayers = this.convertTextTracks(trackItems, fps);
    const captionLayers = this.convertCaptionTracks(trackItems, fps);
    
    const result: RemotionCompositionData = {
      audioLayers,
      imageLayers,
      videoLayers,
      textLayers,
      captionLayers,
      composition: {
        id: String(design.id) || 'video-composition',
        width: design.size?.width || 1920,
        height: design.size?.height || 1080,
        fps,
        durationInFrames
      }
    };
    
    console.log('✅ Conversion complete:', {
      totalLayers: audioLayers.length + imageLayers.length + videoLayers.length + textLayers.length + captionLayers.length,
      durationInFrames,
      fps
    });
    
    return result;
  }
  
  /**
   * Convert audio track items
   */
  private static convertAudioTracks(trackItems: ITrackItem[], fps: number): AudioLayer[] {
    return trackItems
      .filter(item => item.type === 'audio')
      .map(item => {
        const startFrame = this.msToFrames(item.display.from, fps);
        const endFrame = this.msToFrames(item.display.to, fps);
        
        // Handle trimming for audio
        const trimStartFrame = item.trim ? this.msToFrames(item.trim.from, fps) : 0;
        const trimEndFrame = item.trim ? this.msToFrames(item.trim.to, fps) : undefined;
        
        return {
          id: item.id,
          type: 'audio' as const,
          startFrame,
          durationInFrames: endFrame - startFrame,
          src: item.details.src,
          volume: (item.details.volume || 100) / 100, // Convert percentage to decimal
          startFrom: trimStartFrame,
          endAt: trimEndFrame
        };
      });
  }
  
  /**
   * Convert image track items
   */
  private static convertImageTracks(trackItems: ITrackItem[], fps: number): ImageLayer[] {
    return trackItems
      .filter(item => item.type === 'image')
      .map(item => {
        const startFrame = this.msToFrames(item.display.from, fps);
        const endFrame = this.msToFrames(item.display.to, fps);
        
        return {
          id: item.id,
          type: 'image' as const,
          startFrame,
          durationInFrames: endFrame - startFrame,
          src: item.details.src,
          style: {
            position: 'absolute' as const,
            top: this.parsePixelValue(item.details.top) || 0,
            left: this.parsePixelValue(item.details.left) || 0,
            width: item.details.width || 1920,
            height: item.details.height || 1080,
            transform: item.details.transform || 'none',
            opacity: (item.details.opacity || 100) / 100,
            borderRadius: item.details.borderRadius || 0,
            filter: this.buildFilter(item.details)
          }
        };
      });
  }
  
  /**
   * Convert video track items
   */
  private static convertVideoTracks(trackItems: ITrackItem[], fps: number): VideoLayer[] {
    return trackItems
      .filter(item => item.type === 'video')
      .map(item => {
        const startFrame = this.msToFrames(item.display.from, fps);
        const endFrame = this.msToFrames(item.display.to, fps);
        
        // Handle trimming for video
        const trimStartFrame = item.trim ? this.msToFrames(item.trim.from, fps) : 0;
        const trimEndFrame = item.trim ? this.msToFrames(item.trim.to, fps) : undefined;
        
        return {
          id: item.id,
          type: 'video' as const,
          startFrame,
          durationInFrames: endFrame - startFrame,
          src: item.details.src,
          volume: (item.details.volume || 100) / 100,
          startFrom: trimStartFrame,
          endAt: trimEndFrame,
          style: {
            position: 'absolute' as const,
            top: this.parsePixelValue(item.details.top) || 0,
            left: this.parsePixelValue(item.details.left) || 0,
            width: item.details.width || 1920,
            height: item.details.height || 1080,
            transform: item.details.transform || 'none',
            opacity: (item.details.opacity || 100) / 100
          }
        };
      });
  }
  
  /**
   * Convert text track items
   */
  private static convertTextTracks(trackItems: ITrackItem[], fps: number): TextLayer[] {
    return trackItems
      .filter(item => item.type === 'text' && !(item.details as any).isCaptionTrack) // Exclude caption tracks
      .map(item => {
        const startFrame = this.msToFrames(item.display.from, fps);
        const endFrame = this.msToFrames(item.display.to, fps);
        
        return {
          id: item.id,
          type: 'text' as const,
          startFrame,
          durationInFrames: endFrame - startFrame,
          text: item.details.text || '',
          style: {
            position: 'absolute' as const,
            top: this.parsePixelValue(item.details.top) || 100,
            left: this.parsePixelValue(item.details.left) || 100,
            fontSize: item.details.fontSize || 48,
            fontFamily: item.details.fontFamily || 'Inter',
            fontWeight: item.details.fontWeight || 'normal',
            color: item.details.color || '#FFFFFF',
            textAlign: item.details.textAlign || 'left',
            backgroundColor: item.details.backgroundColor || 'transparent',
            width: item.details.width,
            height: item.details.height,
            lineHeight: item.details.lineHeight || 1.2,
            letterSpacing: item.details.letterSpacing || 0
          }
        };
      });
  }
  
  /**
   * Convert caption track items
   */
  private static convertCaptionTracks(trackItems: ITrackItem[], fps: number): CaptionLayer[] {
    return trackItems
      .filter(item => item.type === 'text' && (item.details as any).isCaptionTrack) // Only caption tracks
      .map(item => {
        const startFrame = this.msToFrames(item.display.from, fps);
        const endFrame = this.msToFrames(item.display.to, fps);
        
        // Get caption segments from details
        const segments = item.details.captionSegments || [];
        
        return {
          id: item.id,
          type: 'caption' as const,
          startFrame,
          durationInFrames: endFrame - startFrame,
          segments,
          style: {
            position: 'absolute' as const,
            // Caption positioning is now handled in the Remotion component for proper centering
            // These values are passed but may be overridden for better display
            top: item.details.top || 'auto',
            left: item.details.left || 'auto',
            fontSize: item.details.fontSize || 48,
            fontFamily: item.details.fontFamily || 'Inter',
            textAlign: 'center' as const, // Always center captions
            color: item.details.color || '#E0E0E0',
            activeColor: item.details.activeColor || '#00FF88',
            appearedColor: item.details.appearedColor || '#FFFFFF',
            backgroundColor: item.details.backgroundColor || 'rgba(0, 0, 0, 0.7)',
            width: item.details.width || '80%', // Use percentage for responsive width
            height: item.details.height || 'auto',
            textShadow: item.details.textShadow || '2px 2px 4px rgba(0,0,0,0.8)'
          }
        };
      });
  }
  
  /**
   * Convert milliseconds to frames
   */
  private static msToFrames(ms: number, fps: number): number {
    return Math.round((ms / 1000) * fps);
  }
  
  /**
   * Parse pixel value from string (e.g., "100px" → 100)
   */
  private static parsePixelValue(value: any): number | string {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      if (value.endsWith('px')) {
        return parseInt(value.replace('px', ''));
      }
      const parsed = parseInt(value);
      return isNaN(parsed) ? value : parsed;
    }
    return value;
  }
  
  /**
   * Build CSS filter string from details
   */
  private static buildFilter(details: any): string {
    const filters: string[] = [];
    
    if (details.blur && details.blur > 0) {
      filters.push(`blur(${details.blur}px)`);
    }
    
    if (details.brightness && details.brightness !== 100) {
      filters.push(`brightness(${details.brightness}%)`);
    }
    
    return filters.length > 0 ? filters.join(' ') : 'none';
  }
}

/**
 * Utility function for quick conversion
 */
export function convertEditorToRemotionFormat(design: IDesign): RemotionCompositionData {
  return EditorToRemotionConverter.convertDesign(design);
}

/**
 * Type definitions for external use
 */
export type {
  AudioLayer,
  ImageLayer,
  VideoLayer, 
  TextLayer,
  CaptionLayer
};