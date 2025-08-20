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
import type { CaptionGenerationOptions } from "@/types/caption-types";
import useStore from "@/features/editor/store/use-store";
import { dispatch } from "@designcombo/events";
import { ADD_TEXT } from "@designcombo/state";

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

  // Extract audio info from timeline - use stable version to prevent re-renders
  const audioInfo = useMemo(() => {
    console.log('🔍 CaptionGeneratorPanel - Received trackItems:', trackItems?.length || 0);
    console.log('🔍 CaptionGeneratorPanel - TrackItems details:', trackItems?.map(item => ({ id: item.id, type: item.type, src: item.details?.src })));
    
    // Only process if we have trackItems
    if (!trackItems || trackItems.length === 0) {
      console.log('🔍 CaptionGeneratorPanel - No trackItems available');
      return {};
    }
    
    const audioTracks = trackItems.filter(item => item.type === 'audio' && item.details?.src);
    console.log('🔍 CaptionGeneratorPanel - Audio tracks found:', audioTracks.length);
    
    if (audioTracks.length > 0) {
      const firstAudio = audioTracks[0];
      console.log('🔍 CaptionGeneratorPanel - Using audio:', firstAudio.details.src);
      
      return {
        audioUrl: firstAudio.details.src,
        duration: firstAudio.duration || firstAudio.metadata?.duration
      };
    }
    
    return {};
  }, [trackItems.length, trackItems.map(item => item.id).join(',')]);

  // Check if we have everything needed for generation
  const canGenerate = useMemo(() => {
    return Boolean(audioInfo.audioUrl && !state.isGenerating);
  }, [audioInfo.audioUrl, state.isGenerating]);

  const handleGenerateClick = async () => {
    if (!audioInfo.audioUrl) {
      console.error('No audio URL found');
      return;
    }

    console.log('🎬 Starting AI caption generation...');

    try {
      const result = await generateCaptions({
        audioUrl: audioInfo.audioUrl,
        existingWhisperData,
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
          // Create the caption track structure expected by addCaptionTrackToEditor
          // captionTrackItems[0].duration is in frames, convert to milliseconds correctly
          const durationInMs = (captionTrackItems[0].duration / 30) * 1000;
          
          const captionTrack = {
            id: captionTrackItems[0].id,
            type: 'caption' as const,
            name: 'AI Generated Captions',
            display: {
              from: 0,
              to: durationInMs,
            },
            metadata: {
              resourceId: '',
              duration: durationInMs,
            },
            cut: {
              from: 0,
              to: durationInMs,
            },
            details: captionTrackItems[0].details,
            caption_metadata: {
              segments: captionTrackItems[0].details.captionSegments,
              sourceUrl: undefined,
              parentId: undefined
            }
          };
          
          // Add unified caption track to timeline using ADD_TEXT dispatch
          dispatch(ADD_TEXT, {
            payload: captionTrack
          });
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
      captionTrackItems.forEach(trackItem => {
        dispatch(ADD_TEXT, {
          payload: trackItem
        });
      });
    }
  };

  return (
    <div className="space-y-4">
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
              {audioInfo.audioUrl ? (
                <span className="text-green-600">Audio detected ({audioInfo.duration?.toFixed(1)}s)</span>
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