import { ITrackItem, IText, IImage, IAudio, IVideo } from '@designcombo/types';
import { AITrackItem, AIComposition } from '../store/use-ai-video-editor-store';

/**
 * Adapter to convert between AI Editor data structures and @designcombo/timeline types
 */
export class AITrackItemAdapter {
  /**
   * Convert AITrackItem to @designcombo ITrackItem format
   */
  static toDesignComboTrackItem(aiItem: AITrackItem, fps: number = 30): ITrackItem {
    console.log('Converting AI item:', aiItem);
    
    // Ensure all required fields exist
    if (!aiItem || !aiItem.id || !aiItem.type) {
      console.error('Invalid AI item:', aiItem);
      throw new Error('Invalid AI track item: missing required fields');
    }

    const baseItem: ITrackItem = {
      id: aiItem.id,
      name: (aiItem.details?.text && typeof aiItem.details.text === 'string') 
        ? aiItem.details.text 
        : `${aiItem.type}_${aiItem.id.slice(0, 8)}`,
      type: aiItem.type as any,
      display: {
        from: (aiItem.start / fps) * 1000, // Convert frames to ms
        to: ((aiItem.start + aiItem.duration) / fps) * 1000,
      },
      metadata: {
        resourceId: aiItem.details?.src || '',
        duration: (aiItem.duration / fps) * 1000,
      },
      cut: {
        from: 0,
        to: (aiItem.duration / fps) * 1000,
      },
      // Add tScale property required by timeline components
      tScale: 1,
    };

    console.log('Base item created:', baseItem);

    // Add type-specific properties
    switch (aiItem.type) {
      case 'text':
        const textItem = {
          ...baseItem,
          text: (aiItem.details?.text && typeof aiItem.details.text === 'string') 
            ? aiItem.details.text 
            : 'Text',
          details: {
            text: (aiItem.details?.text && typeof aiItem.details.text === 'string') 
              ? aiItem.details.text 
              : 'Text',
            fontSize: aiItem.details?.fontSize || 48,
            fontFamily: aiItem.details?.fontFamily || 'Inter',
            fontUrl: '', // Required by StateManager
            color: aiItem.details?.color || '#FFFFFF',
            backgroundColor: aiItem.details?.backgroundColor || 'transparent',
            textAlign: (aiItem.details?.textAlign as 'left' | 'center' | 'right') || 'center',
            width: aiItem.details?.width || 800,
            height: aiItem.details?.height || 100,
            opacity: aiItem.details?.opacity || 1,
            
            // Required @designcombo properties with defaults
            skewX: 0,
            skewY: 0,
            lineHeight: 1.2,
            letterSpacing: 0,
            fontWeight: 400,
            fontStyle: 'normal',
            textDecoration: 'none',
            wordSpacing: 0,
            textShadow: 'none',
            textTransform: 'none' as const,
            
            // Transform as string
            transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
          } as IText['details'],
        };
        console.log('Text item created:', textItem);
        return textItem;

      case 'image':
        return {
          ...baseItem,
          src: aiItem.details.src || '',
          details: {
            src: aiItem.details.src || '',
            width: aiItem.details.width || 1920,
            height: aiItem.details.height || 1080,
            top: aiItem.details.top || 0,
            left: aiItem.details.left || 0,
            opacity: aiItem.details.opacity || 1,
            transform: aiItem.details.transform || { x: 0, y: 0, scale: 1, rotation: 0 },
          } as IImage['details'],
        };

      case 'video':
        return {
          ...baseItem,
          src: aiItem.details.src || '',
          aspectRatio: (aiItem.details.width || 1920) / (aiItem.details.height || 1080),
          trim: {
            from: 0,
            to: (aiItem.duration / fps) * 1000,
          },
          duration: (aiItem.duration / fps) * 1000,
          metadata: {
            ...baseItem.metadata,
            previewUrl: aiItem.details.src || '', // Use src as preview for now
          },
          details: {
            src: aiItem.details.src || '',
            width: aiItem.details.width || 1920,
            height: aiItem.details.height || 1080,
            top: aiItem.details.top || 0,
            left: aiItem.details.left || 0,
            opacity: aiItem.details.opacity || 1,
            volume: aiItem.details.volume || 1,
            transform: aiItem.details.transform || { x: 0, y: 0, scale: 1, rotation: 0 },
          } as IVideo['details'],
        };

      case 'audio':
        return {
          ...baseItem,
          details: {
            src: aiItem.details.src || '',
            volume: aiItem.details.volume || 1,
          } as IAudio['details'],
        };

      case 'caption':
        // Handle caption as a special text type
        const captionItem = {
          ...baseItem,
          type: 'text' as const,
          text: (aiItem.details?.text && typeof aiItem.details.text === 'string') 
            ? aiItem.details.text 
            : 'Caption Track',
          details: {
            text: (aiItem.details?.text && typeof aiItem.details.text === 'string') 
              ? aiItem.details.text 
              : 'Caption Track',
            fontSize: aiItem.details?.fontSize || 48,
            fontFamily: aiItem.details?.fontFamily || 'Inter',
            fontUrl: '', // Required by StateManager
            color: aiItem.details?.appearedColor || '#FFFFFF',
            backgroundColor: aiItem.details?.backgroundColor || 'rgba(0, 0, 0, 0.7)',
            textAlign: (aiItem.details?.textAlign as 'left' | 'center' | 'right') || 'center',
            width: aiItem.details?.width || 800,
            height: aiItem.details?.height || 100,
            opacity: aiItem.details?.opacity || 1,
            
            // Required @designcombo properties with defaults
            skewX: 0,
            skewY: 0,
            lineHeight: 1.2,
            letterSpacing: 0,
            fontWeight: 400,
            fontStyle: 'normal',
            textDecoration: 'none',
            wordSpacing: 0,
            textShadow: 'none',
            textTransform: 'none' as const,
            
            // Transform as string
            transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
            
            // Store caption metadata in custom properties
            captionSegments: (aiItem.caption_metadata as any)?.segments || [],
            captionWords: aiItem.caption_metadata?.words || [],
          } as IText['details'] & { captionSegments?: any; captionWords?: any },
        };
        console.log('Caption item created:', captionItem);
        return captionItem;

      default:
        return baseItem;
    }
  }

  /**
   * Convert @designcombo ITrackItem to AITrackItem format
   */
  static fromDesignComboTrackItem(dcItem: ITrackItem, fps: number = 30): AITrackItem {
    const startFrame = Math.round((dcItem.display.from / 1000) * fps);
    const durationFrame = Math.round(((dcItem.display.to - dcItem.display.from) / 1000) * fps);

    const baseAiItem: AITrackItem = {
      id: dcItem.id,
      type: dcItem.type as AITrackItem['type'],
      start: startFrame,
      duration: durationFrame,
      layer: 1, // Default layer
      details: {},
    };

    // Convert type-specific properties
    switch (dcItem.type) {
      case 'text':
        const textDetails = dcItem.details as IText['details'];
        baseAiItem.details = {
          text: textDetails.text || '',
          fontSize: textDetails.fontSize || 48,
          fontFamily: textDetails.fontFamily || 'Inter',
          fontUrl: textDetails.fontUrl || '',
          color: textDetails.color || '#FFFFFF',
          backgroundColor: textDetails.backgroundColor || 'transparent',
          textAlign: textDetails.textAlign as 'left' | 'center' | 'right' || 'center',
          width: textDetails.width || 800,
          height: textDetails.height || 100,
          top: textDetails.top || 0,
          left: textDetails.left || 0,
          opacity: textDetails.opacity || 1,
          transform: textDetails.transform || { x: 0, y: 0, scale: 1, rotation: 0 },
        };
        
        // Check if this is a caption (has special caption properties)
        if ('captionSegments' in textDetails || 'captionWords' in textDetails) {
          baseAiItem.type = 'caption';
          baseAiItem.caption_metadata = {
            segments: (textDetails as any).captionSegments || [],
            words: (textDetails as any).captionWords || [],
            sourceUrl: null,
            parentId: null,
          };
        }
        break;

      case 'image':
        const imageDetails = dcItem.details as IImage['details'];
        baseAiItem.details = {
          src: imageDetails.src || '',
          width: imageDetails.width || 1920,
          height: imageDetails.height || 1080,
          top: imageDetails.top || 0,
          left: imageDetails.left || 0,
          opacity: imageDetails.opacity || 1,
          transform: imageDetails.transform || { x: 0, y: 0, scale: 1, rotation: 0 },
        };
        break;

      case 'video':
        const videoDetails = dcItem.details as IVideo['details'];
        baseAiItem.details = {
          src: videoDetails.src || '',
          width: videoDetails.width || 1920,
          height: videoDetails.height || 1080,
          top: videoDetails.top || 0,
          left: videoDetails.left || 0,
          opacity: videoDetails.opacity || 1,
          volume: videoDetails.volume || 1,
          transform: videoDetails.transform || { x: 0, y: 0, scale: 1, rotation: 0 },
        };
        break;

      case 'audio':
        const audioDetails = dcItem.details as IAudio['details'];
        baseAiItem.details = {
          src: audioDetails.src || '',
          volume: audioDetails.volume || 1,
        };
        break;
    }

    return baseAiItem;
  }

  /**
   * Convert AIComposition to @designcombo format for timeline
   */
  static toDesignComboItems(composition: AIComposition): ITrackItem[] {
    if (!composition.sequences) return [];

    console.log('Converting sequences to @designcombo:', composition.sequences);
    
    return composition.sequences.map(sequence => {
      console.log('Processing sequence:', sequence);
      const result = this.toDesignComboTrackItem(sequence, composition.composition.fps);
      console.log('Converted result:', result);
      return result;
    });
  }

  /**
   * Convert @designcombo items back to AIComposition sequences
   */
  static fromDesignComboItems(items: ITrackItem[], composition: AIComposition): AITrackItem[] {
    return items.map(item => 
      this.fromDesignComboTrackItem(item, composition.composition.fps)
    );
  }

  /**
   * Update AIComposition with timeline changes
   */
  static updateComposition(
    composition: AIComposition,
    updatedItems: ITrackItem[]
  ): AIComposition {
    const updatedSequences = this.fromDesignComboItems(updatedItems, composition);
    
    return {
      ...composition,
      sequences: updatedSequences,
    };
  }
}