'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { 
  Play, 
  Pause,
  SkipBack,
  SkipForward,
  Download, 
  Share2, 
  CheckCircle, 
  AlertCircle, 
  Film, 
  Clock, 
  Layers,
  Sparkles,
  Zap,
  Brain,
  Mic,
  Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useVideoEditorStore } from '../store/video-editor-store';
import { SimpleCaptionOverlay } from '../components/simple-caption-overlay';
import { useCaptionStore } from '../store/caption-store';
import type { ScriptToVideoResponse } from '@/actions/tools/script-to-video-orchestrator';

interface VideoPreviewProps {
  result?: ScriptToVideoResponse;
  isGenerating: boolean;
  isEditing: boolean;
  error?: string;
  onClearResults: () => void;
  activeMode: 'generate' | 'editor';
}

export function VideoPreview({
  result,
  isGenerating,
  error,
  onClearResults,
  activeMode
}: VideoPreviewProps) {
  // Local state for video playback
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Get state and actions from Zustand store
  const {
    // State
    segments,
    timeline,
    project,
    // Actions
    selectSegment
  } = useVideoEditorStore();
  
  // Caption store is used by SimpleCaptionOverlay component

  // Get audio URL from either result prop or store segments
  const audioUrl = result?.audio_url || segments.find(s => s.assets.voice.url)?.assets.voice.url;
  
  // Get video ID from result or project store for captions
  const videoId = result?.video_id || project?.video_id || null;
  
  // Track if audio URL changes
  const previousAudioUrl = useRef(audioUrl);
  useEffect(() => {
    if (previousAudioUrl.current !== audioUrl) {
      console.log('AUDIO URL CHANGED from', previousAudioUrl.current, 'to', audioUrl);
      previousAudioUrl.current = audioUrl;
    }
  }, [audioUrl]);
  
  // Debug log
  console.log('VideoPreview - Audio URL:', audioUrl, 'Result:', result?.audio_url, 'Segments:', segments.length);
  console.log('Segment timing data:', segments.map(s => ({ id: s.id, start: s.start_time, end: s.end_time, duration: s.duration })));

  // Handle play/pause functionality - LEGACY PATTERN
  const handlePlayPause = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      // Update store state directly to avoid conflicts
      useVideoEditorStore.setState((state) => {
        state.timeline.is_playing = false;
      });
    } else {
      // SIMPLIFIED: Just play from current audio position, don't try to sync
      // The audio position was already set when timeline was clicked
      console.log('PLAY CLICKED - Audio will play from:', audioRef.current.currentTime);
      
      // Update state
      setIsPlaying(true);
      useVideoEditorStore.setState((state) => {
        state.timeline.is_playing = true;
      });
      
      // Play the audio
      audioRef.current.play()
        .then(() => {
          console.log('Playback started at:', audioRef.current.currentTime);
        })
        .catch(e => {
          console.error('Play failed:', e);
          setIsPlaying(false);
          useVideoEditorStore.setState((state) => {
            state.timeline.is_playing = false;
          });
        });
    }
  };

  // LEGACY PATTERN: Simple audio sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;
      console.log('[VideoPreview] Audio time update:', currentTime, 'Playing:', isPlaying);
      
      // Always update timeline when audio time changes
      // This ensures captions stay in sync
      useVideoEditorStore.setState((state) => {
        state.timeline.current_time = Math.max(0, Math.min(currentTime, state.project.duration));
      });
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isPlaying, audioUrl]);


  // Handle basic audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      useVideoEditorStore.setState((state) => {
        state.timeline.is_playing = false;
      });
    };

    const handleError = (e: any) => {
      console.error('Audio playback error:', e);
      setIsPlaying(false);
      useVideoEditorStore.setState((state) => {
        state.timeline.is_playing = false;
      });
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // Loading State
  if (isGenerating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Video Generation</CardTitle>
          <CardDescription>Creating your professional video with intelligent orchestration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Generation Progress */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Film className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-medium mb-2">AI Orchestrator Working...</h3>
              <p className="text-sm text-muted-foreground">
                Analyzing script and optimizing production workflow
              </p>
            </div>
          </div>

          <Progress value={35} className="w-full" />

          {/* Generation Steps */}
          <div className="space-y-3">
            {[
              { icon: Brain, label: 'AI analyzing script', completed: true },
              { icon: Zap, label: 'Creating production plan', completed: true },
              { icon: Mic, label: 'Generating voice over', completed: false, active: true },
              { icon: Camera, label: 'Creating visuals', completed: false },
              { icon: Film, label: 'Assembling video', completed: false },
            ].map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  step.completed 
                    ? 'bg-blue-100 text-blue-600' 
                    : step.active 
                    ? 'bg-blue-100 text-blue-600 animate-pulse' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <step.icon className="w-3 h-3" />
                </div>
                <span className={`text-sm ${
                  step.completed 
                    ? 'text-blue-600' 
                    : step.active 
                    ? 'text-blue-600 font-medium' 
                    : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Estimated Time */}
          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Estimated completion: 45-60 seconds
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error State  
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <h3 className="font-medium text-red-900 mb-2">Generation Failed</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <Button onClick={onClearResults} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Success State - Video Generated
  if (result && result.success) {
    return (
      <>
        {/* Success Notice */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-blue-600" />
              <div>
                <h3 className="font-medium text-blue-600">Video Generated Successfully!</h3>
                <p className="text-sm text-blue-600">
                  {result.segments?.length || 0} segments • {result.timeline_data?.total_duration || 0}s duration
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Video Player */}
        <Card>
          <CardHeader>
            <CardTitle>Video Preview</CardTitle>
            <CardDescription>Your AI-generated TikTok-style video</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Video Player Container */}
            <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative max-w-sm mx-auto">
              {result.video_url ? (
                <video
                  src={result.video_url}
                  controls
                  className="w-full h-full object-cover"
                  poster={result.generated_images?.[0]?.url}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <div className="text-center">
                    <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm opacity-75">Video Preview</p>
                  </div>
                </div>
              )}
              
              {/* Play Overlay */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-black ml-1" />
                  </div>
                </div>
              )}
            </div>

            {/* Video Actions */}
            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                onClick={handlePlayPause}
                disabled={!audioUrl}
              >
                {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {isPlaying ? 'Pause' : 'Play'} {!audioUrl && '(No Audio)'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => console.log('Download clicked - not implemented yet')}
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline"
                onClick={() => console.log('Share clicked - not implemented yet')}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Generation Details */}
        <Card>
          <CardHeader>
            <CardTitle>Generation Details</CardTitle>
            <CardDescription>AI orchestration insights and metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Production Plan */}
            {result.production_plan && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Workflow Type:</span>
                  <Badge variant="secondary" className="capitalize">
                    {result.production_plan.workflow_type}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Complexity Score:</span>
                  <Badge variant={result.production_plan.complexity_score > 7 ? 'destructive' : 'default'}>
                    {result.production_plan.complexity_score}/10
                  </Badge>
                </div>
              </div>
            )}

            {/* Timeline Stats */}
            {result.timeline_data && (
              <div className="grid grid-cols-3 gap-4 text-center py-4 border-t border-b">
                <div>
                  <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm font-medium">{result.timeline_data.total_duration}s</p>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
                <div>
                  <Layers className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm font-medium">{result.timeline_data.segment_count}</p>
                  <p className="text-xs text-muted-foreground">Segments</p>
                </div>
                <div>
                  <Film className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm font-medium">{result.timeline_data.frame_count}</p>
                  <p className="text-xs text-muted-foreground">Frames</p>
                </div>
              </div>
            )}

            {/* AI Optimizations */}
            {result.optimization_applied && result.optimization_applied.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">AI Optimizations Applied</span>
                </div>
                <div className="space-y-1">
                  {result.optimization_applied.map((optimization: string, index: number) => (
                    <div key={index} className="text-xs text-muted-foreground flex items-center gap-2">
                      <Zap className="w-3 h-3 text-blue-500" />
                      {optimization}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generation Stats */}
            <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credits Used:</span>
                <Badge variant="outline">{result.credits_used}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Generation Time:</span>
                <span className="font-medium">{(result.generation_time_ms / 1000).toFixed(1)}s</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={onClearResults}
                className="w-full"
              >
                Generate New Video
              </Button>
              
              {activeMode === 'generate' && (
                <p className="text-xs text-center text-muted-foreground">
                  Switch to Timeline Editor to make precise edits
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  // Show video player only in editor mode 
  if (activeMode === 'editor') {
    return (
      <div className="h-full flex flex-col">
        {/* Video Player - Center positioned like Blotato */}
        <div className="flex-1 flex items-center justify-center">
          <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative" style={{ width: '300px' }}>
            {/* Current Segment Image Display with Ken Burns Effect */}
            {(() => {
              const currentSegment = segments.find(segment => 
                timeline.current_time >= segment.start_time && 
                timeline.current_time < segment.end_time
              );
              
              // Use the current segment's image, fallback to first segment's image
              const imageUrl = currentSegment?.assets.image.url || segments[0]?.assets.image.url;
              
              // Show a fallback if no image available
              if (!imageUrl) {
                return (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No image available</p>
                    </div>
                  </div>
                );
              }
              
              // Calculate progress within current segment for Ken Burns effect
              const segmentProgress = currentSegment 
                ? Math.min(1, Math.max(0, (timeline.current_time - currentSegment.start_time) / currentSegment.duration))
                : 0;
              
              // Simple Ken Burns effect - slow zoom
              const scale = 1.0 + (segmentProgress * 0.1); // Subtle zoom from 1.0 to 1.1
              
              return (
                <div className="relative w-full h-full overflow-hidden">
                  <Image
                    src={imageUrl}
                    alt={currentSegment ? `Segment ${currentSegment.index + 1}` : 'Video preview'}
                    fill
                    className="object-cover"
                    style={{
                      transform: timeline.is_playing 
                        ? `scale(${scale})`
                        : 'scale(1)',
                      transition: timeline.is_playing 
                        ? `transform ${currentSegment?.duration || 3}s linear`
                        : 'transform 0.3s ease-out'
                    }}
                    key={currentSegment?.id || 'fallback'} // Force re-render on segment change
                  />
                </div>
              );
            })()}
            
            {/* Real-time Caption Overlay with Professional Chunks */}
            <SimpleCaptionOverlay videoId={videoId} />
            
            {/* Center Play/Pause Button - Main Control */}
            <div 
              className="absolute inset-0 flex items-center justify-center cursor-pointer group"
              onClick={handlePlayPause}
            >
              <div className={`w-16 h-16 bg-white/90 rounded-full flex items-center justify-center transition-all duration-200 ${
                timeline.is_playing 
                  ? 'opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100' 
                  : 'opacity-100 scale-100 hover:scale-105'
              }`}>
                {timeline.is_playing ? (
                  <Pause className="w-8 h-8 text-black" />
                ) : (
                  <Play className="w-8 h-8 text-black ml-1" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline at Bottom - Like Blotato */}
        <div className="relative bg-gray-900/95 rounded-lg p-4 mt-4 overflow-hidden" style={{ height: '250px' }}>
          {/* Timeline Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/10"
                onClick={() => {
                  // Direct state update to avoid dependency issues
                  useVideoEditorStore.setState((state) => {
                    state.timeline.current_time = 0;
                  });
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                  }
                }}
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/10"
                onClick={handlePlayPause}
                disabled={!audioUrl}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/10"
                onClick={() => {
                  // Direct state update to avoid dependency issues
                  useVideoEditorStore.setState((state) => {
                    state.timeline.current_time = state.project.duration;
                  });
                  if (audioRef.current) {
                    audioRef.current.currentTime = project.duration;
                  }
                }}
              >
                <SkipForward className="w-4 h-4" />
              </Button>
              
              <div className="text-sm font-mono text-white/80 ml-4">
                {Math.floor(timeline.current_time / 60).toString().padStart(2, '0')}:{Math.floor(timeline.current_time % 60).toString().padStart(2, '0')}.{Math.floor((timeline.current_time % 1) * 100).toString().padStart(2, '0')} / {Math.floor(project.duration / 60).toString().padStart(2, '0')}:{Math.floor(project.duration % 60).toString().padStart(2, '0')}
              </div>
            </div>
            
            <Button variant="outline" size="sm" className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700">
              Render Video
            </Button>
          </div>

          {/* Time Ruler */}
          <div className="relative h-6 bg-gray-800/50 rounded-t border-b border-gray-700 mb-2">
            <div className="absolute inset-0 flex justify-between items-center px-2 text-xs text-white/60">
              <span>0:00</span>
              <span>{Math.floor(project.duration / 2 / 60)}:{Math.floor((project.duration / 2) % 60).toString().padStart(2, '0')}</span>
              <span>{Math.floor(project.duration / 60)}:{Math.floor(project.duration % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>

          {/* Timeline Tracks Container - LEGACY PATTERN */}
          <div 
            className="relative space-y-2 cursor-pointer overflow-hidden px-2 pb-4"
            onClick={(e) => {
              // LEGACY PATTERN: Simple direct control
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left - 8 - 8; // Account for container padding + track padding
              const timelineWidth = rect.width - 16 - 16; // Account for all padding
              const clickedTime = Math.max(0, (clickX / timelineWidth) * project.duration);
              const finalTime = Math.max(0, Math.min(clickedTime, project.duration));
              
              console.log(`TIMELINE CLICKED: seeking to ${finalTime}s`);
              console.log('Store timeline BEFORE click:', useVideoEditorStore.getState().timeline.current_time);
              
              // Pause audio if playing
              if (audioRef.current && !audioRef.current.paused) {
                audioRef.current.pause();
                setIsPlaying(false);
              }
              
              // Set audio position directly - like legacy
              if (audioRef.current) {
                const audioDuration = audioRef.current.duration || 0;
                const clampedPosition = Math.min(finalTime, audioDuration);
                audioRef.current.currentTime = clampedPosition;
                console.log('Audio position set to:', clampedPosition, 'Audio actual:', audioRef.current.currentTime);
              }
              
              // Update store last to avoid interference
              useVideoEditorStore.setState((state) => {
                state.timeline.current_time = Math.max(0, Math.min(finalTime, state.project.duration));
                state.timeline.is_playing = false;
              });
              
              console.log('Store timeline AFTER click:', useVideoEditorStore.getState().timeline.current_time);
              
              // Check again in next tick to see if something reset it
              setTimeout(() => {
                console.log('Store timeline after timeout:', useVideoEditorStore.getState().timeline.current_time);
                console.log('Audio position after timeout:', audioRef.current?.currentTime);
              }, 50);
            }}
          >
            {/* Main Video Track - Purple like Blotato */}
            <div className="relative h-12 bg-gray-800 rounded">
              <div className="absolute inset-x-2 top-1 text-xs text-white/60">Main Video</div>
              <div 
                className="absolute top-2 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded"
                style={{ left: '8px', right: '8px' }}
              >
                <div className="p-1 text-xs text-white font-medium">Script to Video</div>
              </div>
            </div>

            {/* Segment Tracks Row - Green like Blotato */}
            <div className="relative h-10 bg-gray-800 rounded overflow-hidden">
              <div className="absolute inset-x-2 top-1 text-xs text-white/60">Segments</div>
              <div className="absolute top-1 left-2 right-2 h-8 flex">
                {segments.map((segment, i) => {
                  const isSelected = timeline.selected_segment_ids.includes(segment.id);
                  const isCurrentlyPlaying = timeline.current_time >= segment.start_time && timeline.current_time < segment.end_time;
                  
                  // Calculate progress within the segment for visual feedback
                  const segmentProgress = isCurrentlyPlaying 
                    ? ((timeline.current_time - segment.start_time) / segment.duration) * 100 
                    : 0;
                  
                  return (
                    <div 
                      key={segment.id}
                      className={`flex-1 bg-gradient-to-r rounded flex items-center justify-center cursor-pointer transition-all duration-200 ${
                        isCurrentlyPlaying && timeline.is_playing
                          ? 'from-blue-500 to-cyan-500 ring-2 ring-yellow-400 shadow-lg scale-105' 
                          : isSelected 
                          ? 'from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 ring-2 ring-blue-400' 
                          : 'from-blue-500 to-cyan-500 hover:from-green-500 hover:to-green-600'
                      } ${i > 0 ? 'ml-1' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Just select segment for visual feedback - don't interfere with timeline
                        selectSegment(segment.id);
                      }}
                    >
                      {/* Progress indicator for currently playing segment */}
                      {isCurrentlyPlaying && timeline.is_playing && (
                        <div 
                          className="absolute left-0 top-0 h-full bg-white/30 rounded transition-all duration-100 ease-linear"
                          style={{ width: `${segmentProgress}%` }}
                        />
                      )}
                      
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${
                        isCurrentlyPlaying ? 'bg-white/40' : 'bg-white/20'
                      }`}>
                        <span className="text-xs text-white font-medium">{i + 1}</span>
                      </div>
                      <span className="text-xs text-white ml-1 hidden sm:inline font-medium truncate z-10">
                        {isCurrentlyPlaying ? 'Playing' : segment.status === 'ready' ? 'Ready' : 'Draft'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Captions Track - Blue like Blotato */}
            <div className="relative h-10 bg-gray-800 rounded">
              <div className="absolute inset-x-2 top-1 text-xs text-white/60">T Captions</div>
              <div 
                className="absolute top-1 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded opacity-70"
                style={{ left: '8px', right: '8px' }}
              />
            </div>

            {/* Playhead - Positioned relative to timeline tracks */}
            <div 
              className="absolute w-0.5 bg-red-500 pointer-events-none z-10"
              style={{ 
                left: project.duration > 0 
                  ? `calc(0.5rem + ${(timeline.current_time / project.duration)} * (100% - 1rem))`
                  : '0.5rem',
                top: '0',
                height: '100%'
              }}
            >
              <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.25 -mt-1.5" />
            </div>
          </div>
        </div>
        
        {/* Hidden Audio Element for Playback - Only render when we have audio */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="auto"
            onLoadedMetadata={() => {
              console.log('Audio loaded:', audioUrl, 'Duration:', audioRef.current?.duration);
            }}
            onError={(e) => console.error('Audio error:', e)}
            onSeeking={() => console.log('Audio is seeking...')}
            onSeeked={() => console.log('Audio seek complete, position:', audioRef.current?.currentTime)}
            onLoadStart={() => console.log('Audio load started')}
            onCanPlay={() => console.log('Audio can play')}
            onTimeUpdate={() => {
              // Log first few timeupdate events after play
              if (audioRef.current && audioRef.current.currentTime < 0.5) {
                console.log('TimeUpdate early in playback:', audioRef.current.currentTime);
              }
            }}
            style={{ display: 'none' }}
          />
        )}
      </div>
    );
  }

  // Empty State - Show only if no segments exist
  if (segments.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="text-center space-y-4 max-w-sm">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto">
              <Film className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2 flex items-center justify-center gap-2">
                Ready to Create Videos
                <Sparkles className="w-4 h-4 text-yellow-500" />
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {activeMode === 'generate' 
                  ? 'Enter your script to generate professional TikTok-style videos with AI orchestration.'
                  : 'Generate a video first to access the timeline editor.'
                }
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">💡 AI Features:</p>
                <ul className="text-left space-y-1">
                  <li>• Intelligent script segmentation</li>
                  <li>• Automated voice & visual generation</li>
                  <li>• Perfect lip-sync captions</li>
                  <li>• Professional timeline editing</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If we have segments but we're in generate mode, return null to let other components handle display
  return null;
}