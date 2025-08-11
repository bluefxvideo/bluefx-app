'use client';

import { useRef, useEffect, useState } from 'react';
import { SimpleCaptionOverlay } from './simple-caption-overlay';
import { useCaptionStore } from '../store/caption-store';

/**
 * Example Video Player with Caption Integration
 * Shows how simple it is to add professional captions
 */
export function VideoPlayerWithCaptions({ 
  videoUrl, 
  videoId 
}: { 
  videoUrl: string;
  videoId: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { updateCurrentChunk } = useCaptionStore();
  
  // Update caption timing as video plays
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleTimeUpdate = () => {
      updateCurrentChunk(video.currentTime);
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [updateCurrentChunk]);
  
  // Simple play/pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '800px' }}>
      {/* Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        style={{ width: '100%', height: 'auto' }}
        onClick={togglePlay}
      />
      
      {/* Captions Overlay */}
      <SimpleCaptionOverlay videoId={videoId} />
      
      {/* Simple Controls */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '10px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))'
      }}>
        <button
          onClick={togglePlay}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>
    </div>
  );
}

/**
 * Usage Example in a page:
 * 
 * export default function WatchVideoPage({ params }) {
 *   const videoId = params.id;
 *   const [videoData, setVideoData] = useState(null);
 * 
 *   useEffect(() => {
 *     // Fetch video data
 *     fetch(`/api/script-video/${videoId}`)
 *       .then(res => res.json())
 *       .then(data => setVideoData(data));
 *   }, [videoId]);
 * 
 *   if (!videoData) return <div>Loading...</div>;
 * 
 *   return (
 *     <VideoPlayerWithCaptions 
 *       videoUrl={videoData.video_url}
 *       videoId={videoId}
 *     />
 *   );
 * }
 */