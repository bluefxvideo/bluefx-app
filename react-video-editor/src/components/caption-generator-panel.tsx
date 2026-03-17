'use client';

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Wand2, 
  Sparkles, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Settings,
  Play,
  Download
} from "lucide-react";
import { useState, useMemo } from "react";
import { useCaptionGenerator, extractAudioFromTimeline, captionsToTrackItems } from "@/hooks/use-caption-generator";
import type { CaptionGenerationOptions, AudioSource } from "@/types/caption-types";
import useStore from "@/features/editor/store/use-store";
import { addCaptionTrackToEditor } from "@/features/editor/utils/caption-loader";

/**
 * AI Caption Generator Panel
 * Integrates with existing Captions section to provide AI-powered caption generation
 */

interface CaptionGeneratorPanelProps {
  // Extract existing whisper data if available (from BlueFX)
  existingWhisperData?: any;
  // Current timeline data
  trackItems?: any[];
}

export function CaptionGeneratorPanel({ 
  existingWhisperData, 
  trackItems = [] 
}: CaptionGeneratorPanelProps) {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [generationOptions, setGenerationOptions] = useState({
    maxWordsPerChunk: 6,
    contentType: 'standard' as const,
    frameRate: 30
  });

  const { state, generateCaptions, clearError, reset } = useCaptionGenerator();
  const { trackItemsMap } = useStore();

  // Extract all audio sources from timeline (audio tracks + video tracks with audio)
  const { audioInfo, audioSources } = useMemo(() => {
    console.log('🔍 CaptionGeneratorPanel - Received trackItems:', trackItems?.length || 0);

    if (!trackItems || trackItems.length === 0) {
      return { audioInfo: {}, audioSources: [] as AudioSource[] };
    }

    // Collect all tracks that can have audio: audio tracks AND video tracks
    const sourceTracks = trackItems.filter(
      item => (item.type === 'audio' || item.type === 'video') && item.details?.src
    );

    const sources: AudioSource[] = sourceTracks.map(item => ({
      url: item.details.src,
      type: item.type as 'audio' | 'video',
      offsetMs: item.display?.from || 0,
      durationMs: (item.display?.to || 0) - (item.display?.from || 0),
    }));

    console.log('🔍 CaptionGeneratorPanel - Audio sources found:', sources.length, sources.map(s => ({ type: s.type, offsetMs: s.offsetMs })));

    // Primary audio info (first audio track for backward compat / duration display)
    const primaryAudio = sourceTracks.find(item => item.type === 'audio') || sourceTracks[0];
    const info = primaryAudio ? {
      audioUrl: primaryAudio.details.src,
      duration: primaryAudio.duration || primaryAudio.metadata?.duration
    } : {};

    return { audioInfo: info, audioSources: sources };
  }, [trackItems.length, trackItems.map(item => item.id).join(',')]);

  // Check if we have everything needed for generation
  const canGenerate = useMemo(() => {
    return Boolean(audioSources.length > 0 && !state.isGenerating);
  }, [audioSources.length, state.isGenerating]);

  // Extract original script text from image track metadata
  const originalScript = useMemo(() => {
    const imageItems = Object.values(trackItemsMap)
      .filter((item: any) => item.type === 'image' && item.metadata?.segmentText)
      .sort((a: any, b: any) => a.display.from - b.display.from)
      .map((item: any) => item.metadata.segmentText as string);

    if (imageItems.length > 0) {
      const script = imageItems.join(' ');
      console.log('📝 Original script extracted from image tracks:', script.substring(0, 100) + '...');
      return script;
    }
    return undefined;
  }, [trackItemsMap]);

  const handleGenerateClick = async () => {
    if (audioSources.length === 0) {
      console.error('No audio sources found');
      return;
    }

    console.log('🎬 Starting AI caption generation for', audioSources.length, 'source(s)...');

    try {
      const result = await generateCaptions({
        audioUrl: audioInfo.audioUrl,
        audioSources,
        existingWhisperData,
        originalScript,
        options: {
          ...generationOptions,
          maxCharsPerLine: 42, // Professional standard
          minChunkDuration: 0.833,
          maxChunkDuration: 4.0,
          audioDuration: audioInfo.duration  // Pass known audio duration for boundary checking
        }
      });

      if (result.success && result.captions.length > 0) {
        console.log('✅ Captions generated, adding to timeline...');
        
        // Convert captions to unified track format
        const captionTrackItems = captionsToTrackItems(result.captions, 'ai-generated-captions');
        
        if (captionTrackItems.length > 0) {
          // Create the caption track structure for addCaptionTrackToEditor
          const captionTrack = {
            id: captionTrackItems[0].id,
            type: 'caption' as const,
            name: 'AI Generated Captions',
            details: captionTrackItems[0].details,
            caption_metadata: {
              segments: captionTrackItems[0].details.captionSegments,
              sourceUrl: undefined,
              parentId: undefined
            },
            audioDuration: audioInfo.duration // Pass audio duration for proper track length
          };
          
          // Add unified caption track to timeline using proper caption loader
          addCaptionTrackToEditor(captionTrack);
          console.log(`🎉 Added AI-generated caption track with ${result.captions.length} segments to timeline`);
        }
      }
    } catch (error) {
      console.error('❌ Caption generation failed:', error);
    }
  };

  const handleAddToTimeline = () => {
    if (state.lastResult?.captions) {
      const captionTrackItems = captionsToTrackItems(state.lastResult.captions);
      if (captionTrackItems.length > 0) {
        // Create the caption track structure for addCaptionTrackToEditor
        const captionTrack = {
          id: captionTrackItems[0].id,
          type: 'caption' as const,
          name: 'AI Generated Captions',
          details: captionTrackItems[0].details,
          caption_metadata: {
            segments: captionTrackItems[0].details.captionSegments,
            sourceUrl: undefined,
            parentId: undefined
          },
          audioDuration: audioInfo.duration // Pass audio duration for proper track length
        };
        
        // Add unified caption track to timeline using proper caption loader
        addCaptionTrackToEditor(captionTrack);
      }
    }
  };

  return (
    <div className="space-y-4 mb-8">
      {/* AI Caption Generator Section */}
      <Card className="p-4 border-dashed border-2 border-primary/20">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium">AI Caption Generator</h4>
              <Badge variant="secondary" className="text-xs">Beta</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>

          {/* Status Information */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {audioSources.length > 0 ? (
                <span className="text-green-600">
                  {audioSources.length} audio source{audioSources.length > 1 ? 's' : ''} detected
                  {audioSources.length > 1 && ` (${audioSources.filter(s => s.type === 'audio').length} audio, ${audioSources.filter(s => s.type === 'video').length} video)`}
                </span>
              ) : (
                <span className="text-yellow-600">No audio found in timeline</span>
              )}
            </div>

            {existingWhisperData && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>Whisper analysis available (optimized generation)</span>
              </div>
            )}
          </div>

          {/* Advanced Options */}
          {showAdvancedOptions && (
            <Card className="p-3 bg-muted/50">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Words per chunk:</label>
                  <select 
                    value={generationOptions.maxWordsPerChunk}
                    onChange={(e) => setGenerationOptions(prev => ({
                      ...prev,
                      maxWordsPerChunk: Number(e.target.value)
                    }))}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value={4}>4 words (fast reading)</option>
                    <option value={6}>6 words (standard)</option>
                    <option value={8}>8 words (slower reading)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Content type:</label>
                  <select 
                    value={generationOptions.contentType}
                    onChange={(e) => setGenerationOptions(prev => ({
                      ...prev,
                      contentType: e.target.value as 'educational' | 'standard' | 'fast'
                    }))}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="educational">Educational</option>
                    <option value="standard">Standard</option>
                    <option value="fast">Fast-paced</option>
                  </select>
                </div>
              </div>
            </Card>
          )}

          {/* Generation Progress */}
          {state.isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs font-medium">{state.currentStage}</span>
              </div>
              <Progress value={state.progress} className="h-2" />
            </div>
          )}

          {/* Error Display */}
          {state.error && (
            <Card className="p-3 border-red-200 bg-red-50">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-red-700">{state.error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 px-2 mt-1"
                    onClick={clearError}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Success Results */}
          {state.lastResult?.success && (
            <Card className="p-3 border-green-200 bg-green-50">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium text-green-700">
                    Generated {state.lastResult.total_chunks} captions
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-green-600">
                  <div>
                    <div className="font-medium">Duration</div>
                    <div>{state.lastResult.total_duration.toFixed(1)}s</div>
                  </div>
                  <div>
                    <div className="font-medium">Accuracy</div>
                    <div>{state.lastResult.quality_metrics.timing_precision.toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="font-medium">Quality</div>
                    <div>{state.lastResult.quality_metrics.readability_score.toFixed(0)}%</div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={handleAddToTimeline}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Add to Timeline
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={reset}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerateClick}
            disabled={!canGenerate}
            className="w-full"
            variant={canGenerate ? "default" : "secondary"}
          >
            {state.isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate AI Captions
              </>
            )}
          </Button>

          {/* Help Text */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Frame-accurate lip sync</p>
            <p>• Professional broadcast standards</p>
            <p>• Direct Whisper word timing</p>
            {existingWhisperData && <p>• Optimized with existing analysis</p>}
          </div>
        </div>
      </Card>

      <Separator />
    </div>
  );
}