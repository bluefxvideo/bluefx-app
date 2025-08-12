'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { Play, Pause, SkipBack, SkipForward, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVideoEditorStore } from '../store/video-editor-store';
import { SimpleCaptionOverlay } from '../components/simple-caption-overlay';

export function VideoPreview() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { segments, timeline, project, selectSegment } = useVideoEditorStore();
  const audioUrl = segments.find(s => s.assets.voice.url)?.assets.voice.url;

  const handlePlayPause = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (timeline.is_playing) {
      audioRef.current.pause();
      useVideoEditorStore.setState((state) => { state.timeline.is_playing = false; });
    } else {
      useVideoEditorStore.setState((state) => { state.timeline.is_playing = true; });
      audioRef.current.play();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Video Player */}
      <div className="flex-1 flex items-center justify-center">
        <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative" style={{ width: '300px' }}>
          {(() => {
            // Find the currently playing segment using realigned timing (only one should match)
            // This ensures images switch at the same time as captions
            const currentSegment = timeline.is_playing ? 
              segments.find(segment => 
                timeline.current_time >= segment.start_time && 
                timeline.current_time < segment.end_time
              ) : null;
            
            const imageUrl = currentSegment?.assets.image.url || segments[0]?.assets.image.url;
            
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
            
            const segmentProgress = currentSegment 
              ? Math.min(1, Math.max(0, (timeline.current_time - currentSegment.start_time) / currentSegment.duration))
              : 0;
            
            const scale = 1.0 + (segmentProgress * 0.1);
            
            return (
              <div className="relative w-full h-full overflow-hidden">
                <Image
                  src={imageUrl}
                  alt={currentSegment ? `Segment ${currentSegment.index + 1}` : 'Video preview'}
                  fill
                  className="object-cover"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    transition: 'transform 100ms ease-out'
                  }}
                />
                
                {/* Caption Overlay */}
                <div className="absolute inset-0">
                  <SimpleCaptionOverlay videoId={project?.video_id} />
                  {/* Debug: Show if video_id exists */}
                  {!project?.video_id && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs p-1 rounded">
                      No video_id
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative bg-gray-900/95 rounded-lg p-4 mt-4 overflow-hidden" style={{ height: '250px' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/10"
              onClick={() => {
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
              {timeline.is_playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/10"
              onClick={() => {
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

        {/* Timeline Tracks */}
        <div 
          className="relative space-y-2 cursor-pointer overflow-hidden px-2 pb-4"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left - 8; // Adjust for padding
            const timelineWidth = rect.width - 16; // Account for padding on both sides
            const clickedTime = Math.max(0, (clickX / timelineWidth) * project.duration);
            const finalTime = Math.max(0, Math.min(clickedTime, project.duration));
            
            console.log('🔍 Timeline click:', { clickX, timelineWidth, clickedTime, finalTime, duration: project.duration });
            
            if (audioRef.current) {
              if (!audioRef.current.paused) {
                audioRef.current.pause();
              }
              const audioDuration = audioRef.current.duration || 0;
              const seekTime = Math.max(0, Math.min(finalTime, audioDuration));
              audioRef.current.currentTime = seekTime;
              
              useVideoEditorStore.setState((state) => {
                state.timeline.current_time = seekTime;
                state.timeline.is_playing = false;
              });
              
              console.log('🔍 Seeked to:', seekTime);
            }
          }}
        >
          {/* Main Video Track */}
          <div className="relative h-12 bg-gray-800 rounded">
            <div className="absolute inset-x-2 top-1 text-xs text-white/60">Main Video</div>
            <div 
              className="absolute top-2 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded"
              style={{ left: '8px', right: '8px' }}
            >
              <div className="p-1 text-xs text-white font-medium">Script to Video</div>
            </div>
          </div>

          {/* Segments Track */}
          <div className="relative h-10 bg-gray-800 rounded overflow-hidden">
            <div className="absolute inset-x-2 top-1 text-xs text-white/60">Segments</div>
            <div className="absolute top-1 left-2 right-2 h-8 flex gap-0.5">
              {(() => {
                // Find the currently playing segment index using realigned timing (only one should be playing)
                // This ensures timeline highlighting matches image/caption timing
                const playingSegmentIndex = timeline.is_playing ? 
                  segments.findIndex(seg => 
                    timeline.current_time >= seg.start_time && 
                    timeline.current_time < seg.end_time
                  ) : -1;
                
                return segments.map((segment, i) => { // Show all segments
                  const isSelected = timeline.selected_segment_ids.includes(segment.id);
                  const isCurrentlyPlaying = timeline.is_playing && i === playingSegmentIndex;
                
                const segmentProgress = isCurrentlyPlaying 
                  ? ((timeline.current_time - segment.start_time) / segment.duration) * 100 
                  : 0;
                
                return (
                  <div 
                    key={segment.id}
                    className={`bg-gradient-to-r rounded flex items-center justify-center cursor-pointer transition-all duration-200 relative ${
                      isCurrentlyPlaying && timeline.is_playing
                        ? 'from-green-500 to-green-600 ring-2 ring-yellow-400 shadow-lg scale-105' 
                        : isSelected 
                        ? 'from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 ring-2 ring-blue-400' 
                        : 'from-blue-500 to-cyan-500 hover:from-green-500 hover:to-green-600'
                    }`}
                    style={{ 
                      flex: '1 1 0', // Equal width distribution to fill entire width
                      minWidth: '30px',
                      height: '30px'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectSegment(segment.id, false); // Don't seek when clicking segment
                    }}
                  >
                    {isCurrentlyPlaying && timeline.is_playing && (
                      <div 
                        className="absolute left-0 top-0 h-full bg-white/30 rounded transition-all duration-100 ease-linear"
                        style={{ width: `${segmentProgress}%` }}
                      />
                    )}
                    
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${
                      isCurrentlyPlaying ? 'bg-white/40' : 'bg-white/20'
                    }`}>
                      <span className="text-xs text-white font-bold">{i + 1}</span>
                    </div>
                    {segments.length <= 6 && (
                      <span className="text-xs text-white ml-1 font-medium truncate z-10 max-w-8">
                        {isCurrentlyPlaying ? 'Play' : 'Ready'}
                      </span>
                    )}
                  </div>
                );
                });
              })()}
            </div>
          </div>

          {/* Captions Track */}
          <div className="relative h-10 bg-gray-800 rounded">
            <div className="absolute inset-x-2 top-1 text-xs text-white/60">T Captions</div>
            <div 
              className="absolute top-1 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded opacity-70"
              style={{ left: '8px', right: '8px' }}
            />
          </div>

          {/* Playhead */}
          <div 
            className="absolute w-0.5 bg-red-500 pointer-events-none z-10"
            style={{ 
              left: project.duration > 0 
                ? `calc(8px + ${(timeline.current_time / project.duration) * 100}% * (100% - 16px) / 100%)`
                : '8px',
              top: '0',
              height: '100%'
            }}
          >
            <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.25 -mt-1.5" />
          </div>
        </div>
      </div>
      
      {/* Audio Element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onTimeUpdate={() => {
            if (audioRef.current) {
              const currentTime = audioRef.current.currentTime;
              console.log('🔍 Audio time update:', currentTime);
              
              // Find which segment should be playing
              const currentSegment = segments.find(seg => 
                currentTime >= seg.start_time && currentTime < seg.end_time
              );
              
              console.log('🔍 Current segment:', {
                time: currentTime,
                segment: currentSegment ? `${currentSegment.start_time}-${currentSegment.end_time}` : 'NONE',
                allSegments: segments.map(s => `${s.start_time}-${s.end_time}`)
              });
              
              useVideoEditorStore.setState((state) => {
                state.timeline.current_time = currentTime;
              });
            }
          }}
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
}