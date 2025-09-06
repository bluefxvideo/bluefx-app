'use client';

import { useState, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  Settings,
  Volume2,
  Type,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

interface TimelineSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  imageUrl?: string;
  track: 'video' | 'audio' | 'captions';
}

interface EnhancedTimelineProps {
  segments: TimelineSegment[];
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
  onSegmentEdit: (segmentId: string, action: string) => void;
}

/**
 * Enhanced Timeline Component - Inspired by Blotato
 * Focuses on simplicity while maintaining professional appearance
 */
export function EnhancedTimeline({
  segments,
  duration,
  currentTime,
  isPlaying,
  onTimeChange,
  onPlayPause,
  onSegmentEdit
}: EnhancedTimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Group segments by track
  const videoSegments = segments.filter(s => s.track === 'video');
  const _audioSegments = segments.filter(s => s.track === 'audio');
  const captionSegments = segments.filter(s => s.track === 'captions');

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timelineWidth = rect.width;
    const newTime = (clickX / timelineWidth) * duration * zoom;
    
    onTimeChange(Math.max(0, Math.min(duration, newTime)));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSegmentStyle = (segment: TimelineSegment) => {
    const leftPercent = (segment.startTime / duration) * 100 / zoom;
    const widthPercent = ((segment.endTime - segment.startTime) / duration) * 100 / zoom;
    
    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      minWidth: '40px'
    };
  };

  const getTrackColor = (track: string) => {
    switch (track) {
      case 'video': return 'from-blue-500 to-blue-600';
      case 'audio': return 'from-blue-500 to-cyan-500';  
      case 'captions': return 'from-blue-500 to-cyan-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Timeline Editor
          </CardTitle>
          
          {/* Timeline Controls */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onTimeChange(0)}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onPlayPause}>
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onTimeChange(duration)}>
              <SkipForward className="w-4 h-4" />
            </Button>
            
            <div className="text-sm font-mono text-muted-foreground ml-4">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Zoom Control */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Zoom</span>
          <Slider
            value={[zoom]}
            onValueChange={([value]) => setZoom(value)}
            min={0.5}
            max={3}
            step={0.1}
            className="flex-1 max-w-32"
          />
          <span className="text-xs text-muted-foreground w-12">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Timeline Container */}
        <div className="space-y-3">
          {/* Time Ruler */}
          <div className="relative h-6 bg-muted/20 rounded-t border">
            <div className="absolute inset-0 flex justify-between items-center px-2 text-xs text-muted-foreground">
              <span>0:00</span>
              <span>{formatTime(duration / 2)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Timeline */}
          <div 
            ref={timelineRef}
            className="relative bg-muted/10 rounded border-2 border-dashed border-muted hover:border-primary/50 transition-colors cursor-pointer"
            style={{ height: '200px', overflow: 'hidden' }}
            onClick={handleTimelineClick}
          >
            {/* Playhead */}
            <div 
              className="absolute top-0 w-0.5 h-full bg-red-500 z-20 pointer-events-none"
              style={{ left: `${(currentTime / duration) * 100 / zoom}%` }}
            >
              <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 -mt-1.5" />
            </div>

            {/* Video Track */}
            <div className="absolute top-4 left-0 right-0 h-12">
              <div className="flex items-center gap-2 mb-1 px-2">
                <ImageIcon className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-medium text-blue-600">Video</span>
              </div>
              <div className="relative h-8 ">
                {videoSegments.map((segment) => (
                  <div
                    key={segment.id}
                    className={`absolute h-full bg-gradient-to-r ${getTrackColor('video')} rounded cursor-pointer transition-all hover:shadow-md ${
                      selectedSegment === segment.id ? 'ring-2 ring-blue-400' : ''
                    }`}
                    style={getSegmentStyle(segment)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSegment(segment.id);
                    }}
                  >
                    <div className="p-1 text-xs text-white truncate">
                      Segment {videoSegments.indexOf(segment) + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audio Track */}
            <div className="absolute top-20 left-0 right-0 h-8">
              <div className="flex items-center gap-2 mb-1 px-2">
                <Volume2 className="w-3 h-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-600">Audio</span>
              </div>
              <div className="h-6 ">
                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded opacity-80" />
              </div>
            </div>

            {/* Captions Track */}
            <div className="absolute top-32 left-0 right-0 h-8">
              <div className="flex items-center gap-2 mb-1 px-2">
                <Type className="w-3 h-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-600">Captions</span>
                <Badge variant="secondary" className="text-xs px-1 py-0">AI Synced</Badge>
              </div>
              <div className="h-6 ">
                {captionSegments.map((segment) => (
                  <div
                    key={segment.id}
                    className={`absolute h-full bg-gradient-to-r ${getTrackColor('captions')} rounded opacity-60`}
                    style={getSegmentStyle(segment)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Segment Info */}
        {selectedSegment && (
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Selected Segment</h4>
                  <p className="text-sm text-muted-foreground">
                    {videoSegments.find(s => s.id === selectedSegment)?.text?.substring(0, 50)}...
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onSegmentEdit(selectedSegment, 'regenerate')}>
                    Regenerate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onSegmentEdit(selectedSegment, 'delete')}>
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}