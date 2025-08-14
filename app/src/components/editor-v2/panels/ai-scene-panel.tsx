'use client';

import { useEffect } from 'react';
import { Player } from '@remotion/player';
import { useAIVideoEditorStore } from '../store/use-ai-video-editor-store';
import useEditorStore from '../store/use-editor-store';
import { useAIEditorContext } from '../context/ai-editor-context';
import { AIRemotionComposition } from '../remotion/ai-remotion-composition';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useState } from 'react';

export function AIScenePanel() {
  const {
    composition,
    timeline,
    setCurrentFrame,
    play,
    pause
  } = useAIVideoEditorStore();
  
  const { playerRef, sceneRef } = useAIEditorContext();
  
  // Import setPlayerRef from editor store
  const { setPlayerRef } = useEditorStore();
  
  // Debug player mounting and sync with editor store
  useEffect(() => {
    console.log('Scene panel mounted, playerRef:', playerRef);
    console.log('Player current:', playerRef.current);
    
    const checkPlayer = () => {
      if (playerRef.current) {
        console.log('Player is now available:', playerRef.current);
        // Set the playerRef in the editor store so timeline can access it
        setPlayerRef(playerRef);
      } else {
        console.log('Player still not available, checking again in 100ms');
        setTimeout(checkPlayer, 100);
      }
    };
    
    checkPlayer();
  }, [playerRef, setPlayerRef]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sceneZoom, setSceneZoom] = useState(1);
  
  // Sync player state with store
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    
    const handleFrameUpdate = () => {
      const currentFrame = player.getCurrentFrame();
      setCurrentFrame(currentFrame);
    };
    
    const handlePlay = () => play();
    const handlePause = () => pause();
    
    // Listen to player events
    player.addEventListener('frameupdate', handleFrameUpdate);
    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);
    
    return () => {
      player.removeEventListener('frameupdate', handleFrameUpdate);
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('pause', handlePause);
    };
  }, [playerRef, setCurrentFrame, play, pause]);
  
  if (!composition) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/50">
        <div className="text-center">
          <div className="mb-4 text-muted-foreground">
            No composition loaded
          </div>
          <p className="text-sm text-muted-foreground">
            Create a new project to get started
          </p>
        </div>
      </div>
    );
  }
  
  const aspectRatio = composition.composition.width / composition.composition.height;
  const isPortrait = aspectRatio < 1;
  
  return (
    <div ref={sceneRef} className="relative flex h-full flex-col bg-muted/50">
      {/* Scene Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSceneZoom(Math.max(0.25, sceneZoom - 0.25))}
          disabled={sceneZoom <= 0.25}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSceneZoom(1)}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSceneZoom(Math.min(3, sceneZoom + 0.25))}
          disabled={sceneZoom >= 3}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Scene Info */}
      <div className="absolute top-4 left-4 z-10">
        <Card className="px-3 py-1.5 bg-background/80 backdrop-blur-sm">
          <div className="text-xs text-muted-foreground">
            {composition.composition.width}×{composition.composition.height} • {composition.composition.fps}fps
          </div>
          <div className="text-xs font-medium">
            {Math.floor((timeline.currentFrame || 0) / (composition.composition.fps || 30))}s / {Math.floor((composition.composition.durationInFrames || 0) / (composition.composition.fps || 30))}s
          </div>
        </Card>
      </div>
      
      {/* Player Container */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div 
          className="relative overflow-hidden rounded-lg bg-black shadow-2xl"
          style={{
            width: isPortrait ? 'auto' : '100%',
            height: isPortrait ? '100%' : 'auto',
            maxWidth: isPortrait ? '70vh' : '100%',
            maxHeight: isPortrait ? '100%' : '70vh',
            aspectRatio: aspectRatio,
            transform: `scale(${sceneZoom})`,
            transformOrigin: 'center'
          }}
        >
          {/* Remotion Player */}
          <Player
            ref={playerRef}
            component={AIRemotionComposition}
            inputProps={{
              composition: composition,
              sequences: composition.sequences
            }}
            durationInFrames={composition.composition.durationInFrames}
            compositionWidth={composition.composition.width}
            compositionHeight={composition.composition.height}
            fps={composition.composition.fps}
            style={{
              width: '100%',
              height: '100%'
            }}
            controls={false}
            loop={false}
            showVolumeControls={false}
            clickToPlay={true}
            doubleClickToFullscreen={false}
            onPlay={() => console.log('Player started playing via onPlay')}
            onPause={() => console.log('Player paused via onPause')}
          />
          
          {/* Overlay for additional scene info */}
          {composition.sequences.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center text-white">
                <div className="mb-2 text-lg font-medium">Empty Timeline</div>
                <p className="text-sm opacity-75">
                  Add content from the Asset Panel to get started
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Quick Stats */}
      <div className="border-t border-border/80 bg-background p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {composition.sequences.length} item{composition.sequences.length !== 1 ? 's' : ''}
          </span>
          <span>
            Zoom: {Math.round(sceneZoom * 100)}%
          </span>
          <span>
            Frame: {typeof timeline.currentFrame === 'number' ? timeline.currentFrame : 0}
          </span>
        </div>
      </div>
    </div>
  );
}