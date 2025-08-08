'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Download, Music, Clock, Volume2, Zap } from 'lucide-react';

interface MusicMachineOutputProps {
  musicMachineState: any;
}

/**
 * Music Machine Output Panel - Contextual display based on active tab
 * Following exact BlueFX style guide patterns
 */
export function MusicMachineOutput({ musicMachineState }: MusicMachineOutputProps) {
  const { 
    activeTab, 
    state, 
    playingMusicId, 
    handleMusicPlayback 
  } = musicMachineState;

  if (activeTab === 'generate') {
    return <GenerateOutput musicMachineState={musicMachineState} />;
  }

  if (activeTab === 'history') {
    return <HistoryOutput musicMachineState={musicMachineState} />;
  }

  return <DefaultOutput />;
}

function GenerateOutput({ musicMachineState }: { musicMachineState: any }) {
  const { state, playingMusicId, handleMusicPlayback } = musicMachineState;

  if (state.isGenerating || state.currentGeneration) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
          <Music className="w-8 h-8 text-white animate-pulse" />
        </div>
        
        <h3 className="text-lg font-semibold mb-2">Generating Music</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          Your AI music is being created using MusicGen. This process typically takes 1-2 minutes.
        </p>

        <div className="w-full max-w-sm mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Processing...</span>
            <span>⏱️ ~{Math.ceil(state.duration / 15)} min</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-pulse" 
                 style={{ width: '45%' }} />
          </div>
        </div>

        {state.currentGeneration && (
          <Card className="p-4 w-full max-w-md border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Generation Started</span>
            </div>
            
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Prompt:</span>
                <span className="text-right max-w-[200px] truncate">{state.currentGeneration.prompt}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span>{state.currentGeneration.duration}s</span>
              </div>
              <div className="flex justify-between">
                <span>Genre:</span>
                <span>{state.currentGeneration.genre}</span>
              </div>
            </div>
          </Card>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          You'll receive a notification when your music is ready
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
        <Music className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">Ready to Create Music</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Describe the music you want to create and let AI generate professional-quality audio tracks for you.
      </p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <Card className="p-4 text-center bg-white dark:bg-gray-800/40">
          <Zap className="w-6 h-6 mx-auto mb-2 text-blue-500" />
          <p className="text-xs font-medium">AI-Powered</p>
          <p className="text-xs text-muted-foreground">MusicGen technology</p>
        </Card>
        
        <Card className="p-4 text-center bg-white dark:bg-gray-800/40">
          <Clock className="w-6 h-6 mx-auto mb-2 text-blue-500" />
          <p className="text-xs font-medium">Up to 3 minutes</p>
          <p className="text-xs text-muted-foreground">Extended tracks</p>
        </Card>
      </div>
    </div>
  );
}

function HistoryOutput({ musicMachineState }: { musicMachineState: any }) {
  const { state, playingMusicId, handleMusicPlayback } = musicMachineState;

  if (state.isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-8 h-8 mb-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading your music history...</p>
      </div>
    );
  }

  if (state.musicHistory.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 mb-6 bg-gradient-to-r from-gray-500 to-gray-600 rounded-2xl flex items-center justify-center">
          <Music className="w-8 h-8 text-white" />
        </div>
        
        <h3 className="text-lg font-semibold mb-2">No Music Yet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          Once you generate your first AI music track, it will appear here with playback controls and download options.
        </p>

        <Card className="p-4 w-full max-w-md bg-white dark:bg-gray-800/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Quick Start</span>
            <Badge variant="secondary" className="text-xs">Tip</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Try prompts like "upbeat electronic dance music" or "calm acoustic guitar melody"
          </p>
        </Card>
      </div>
    );
  }

  const completedMusic = state.musicHistory.filter((m: any) => m.status === 'completed');
  const totalDuration = completedMusic.reduce((sum: number, m: any) => sum + m.duration, 0);
  const totalSize = completedMusic.reduce((sum: number, m: any) => sum + (m.file_size_mb || 0), 0);

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 mb-6 bg-gradient-to-r from-gray-500 to-gray-600 rounded-2xl flex items-center justify-center">
        <Music className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">Music Collection</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Browse your generated music tracks. Click play to listen or download to save locally.
      </p>

      <div className="grid grid-cols-3 gap-4 w-full max-w-md mb-6">
        <Card className="p-3 text-center bg-white dark:bg-gray-800/40">
          <p className="text-lg font-semibold text-blue-500">{state.musicHistory.length}</p>
          <p className="text-xs text-muted-foreground">Total Tracks</p>
        </Card>
        
        <Card className="p-3 text-center bg-white dark:bg-gray-800/40">
          <p className="text-lg font-semibold text-blue-500">
            {Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, '0')}
          </p>
          <p className="text-xs text-muted-foreground">Total Duration</p>
        </Card>
        
        <Card className="p-3 text-center bg-white dark:bg-gray-800/40">
          <p className="text-lg font-semibold text-blue-500">{totalSize.toFixed(1)}MB</p>
          <p className="text-xs text-muted-foreground">Total Size</p>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Use the controls on the left to play, download, or delete tracks
      </p>
    </div>
  );
}

function DefaultOutput() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
        <Music className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground max-w-md">
        Generate professional AI music tracks with advanced MusicGen technology for any project.
      </p>
    </div>
  );
}

export default MusicMachineOutput;