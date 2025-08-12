'use client';

import { useEffect, useState } from 'react';
import { useVideoEditorStore } from '../store/video-editor-store';

interface CaptionChunk {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
}

interface SegmentData {
  segment_id: string;
  caption_chunks: CaptionChunk[];
}

export function SimpleCaptionOverlay({ videoId }: { videoId?: string }) {
  const { timeline, settings, project } = useVideoEditorStore();
  const [captionSegments, setCaptionSegments] = useState<SegmentData[]>([]);
  const [wordTimings, setWordTimings] = useState<any[]>([]);
  
  useEffect(() => {
    const targetVideoId = videoId || project?.video_id;
    if (!targetVideoId) return;
    
    fetch(`/api/script-video/${targetVideoId}/captions`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCaptionSegments(data.caption_chunks || []);
          setWordTimings(data.word_timings || []);
        }
      })
      .catch(err => console.error('Failed to fetch captions:', err));
  }, [videoId, project?.video_id]);

  // Find current active chunk
  const currentTime = timeline.current_time;
  let currentChunk: CaptionChunk | null = null;
  let currentSegmentData: any = null;
  
  for (const segment of captionSegments) {
    const activeChunk = segment.caption_chunks.find(chunk => 
      currentTime >= chunk.start_time && currentTime < chunk.end_time
    );
    if (activeChunk) {
      currentChunk = activeChunk;
      currentSegmentData = wordTimings.find(s => s.segment_id === segment.segment_id);
      break;
    }
  }
  
  if (!currentChunk) return null;

  // Word highlighting with timing
  const renderWords = () => {
    if (!currentSegmentData?.word_timings) {
      return currentChunk.text;
    }

    const chunkWords = currentChunk.text.split(' ');
    const segmentWordTimings = currentSegmentData.word_timings;
    
    return chunkWords.map((word, index) => {
      const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, '').trim();
      
      const timing = segmentWordTimings.find((wt: any) => {
        const whisperWord = (wt.word || wt.text || '').toLowerCase().replace(/[.,!?;:]/g, '').trim();
        return whisperWord === cleanWord && 
               wt.start >= currentChunk.start_time && 
               wt.end <= currentChunk.end_time;
      });
      
      const isActive = timing && currentTime >= timing.start && currentTime <= timing.end;
      
      return (
        <span
          key={index}
          className={isActive ? 'text-yellow-300 font-bold' : 'text-white'}
          style={{ marginRight: index < chunkWords.length - 1 ? '0.25em' : '0' }}
        >
          {word}
        </span>
      );
    });
  };

  return (
    <div 
      className="absolute bottom-[10%] left-1/2 transform -translate-x-1/2 max-w-[90%] text-center bg-black/80 px-5 py-3 rounded-lg text-lg font-bold"
      style={{
        fontFamily: settings.typography?.font_family || 'Arial',
        textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)',
        lineHeight: '1.3'
      }}
    >
      {renderWords()}
    </div>
  );
}