'use client';

import { useVideoEditorStore } from '../store/video-editor-store';

/**
 * Timing Debug Panel - Shows caption timing accuracy and confidence scores
 * Helps debug lip sync issues during development
 */
export function TimingDebugPanel() {
  const { segments, timeline } = useVideoEditorStore();

  const currentSegment = segments.find(segment => 
    timeline.current_time >= segment.start_time && 
    timeline.current_time < segment.end_time
  );

  if (!currentSegment) {
    return (
      <div className="bg-gray-900 text-white p-4 rounded-lg border border-gray-700">
        <h3 className="text-sm font-medium mb-2">🎯 Timing Debug</h3>
        <p className="text-gray-400 text-xs">No active segment</p>
      </div>
    );
  }

  const words = currentSegment.text.split(' ');
  const wordTimings = currentSegment.assets?.captions?.words || [];
  const currentTime = timeline.current_time;

  // Calculate current word and timing accuracy
  let currentWordIndex = -1;
  let timingAccuracy = 'unknown';
  let confidenceScore = 0;

  if (wordTimings.length > 0) {
    // Find current word based on enhanced algorithm
    wordTimings.forEach((wordTiming, index) => {
      if (index < words.length) {
        let wordAbsoluteStart: number;
        let wordAbsoluteEnd: number;
        
        if (wordTiming.start_time < currentSegment.start_time) {
          wordAbsoluteStart = currentSegment.start_time + wordTiming.start_time;
          wordAbsoluteEnd = currentSegment.start_time + wordTiming.end_time;
        } else {
          wordAbsoluteStart = wordTiming.start_time;
          wordAbsoluteEnd = wordTiming.end_time;
        }

        // Frame-perfect alignment check
        const frameRate = 30;
        const frameDuration = 1 / frameRate;
        wordAbsoluteStart = Math.round(wordAbsoluteStart / frameDuration) * frameDuration;
        wordAbsoluteEnd = Math.round(wordAbsoluteEnd / frameDuration) * frameDuration;

        const confidence = wordTiming.confidence || 0.8;
        const baseBuffer = 0.05;
        const confidenceBuffer = baseBuffer * (1.5 - confidence);

        const isCurrentWord = currentTime >= (wordAbsoluteStart - confidenceBuffer) && 
                             currentTime < (wordAbsoluteEnd + confidenceBuffer);

        if (isCurrentWord) {
          currentWordIndex = index;
          confidenceScore = confidence;
          
          if (confidence > 0.8) {
            timingAccuracy = 'high';
          } else if (confidence > 0.6) {
            timingAccuracy = 'medium';
          } else {
            timingAccuracy = 'low';
          }
        }
      }
    });
  }

  const getAccuracyColor = (accuracy: string) => {
    switch (accuracy) {
      case 'high': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getConfidenceBar = (confidence: number) => {
    const width = Math.max(10, confidence * 100);
    const color = confidence > 0.8 ? 'bg-green-500' : confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500';
    
    return (
      <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${width}%` }}
        />
      </div>
    );
  };

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg border border-gray-700 space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2">
        🎯 Timing Debug
        <span className={`text-xs px-2 py-1 rounded ${getAccuracyColor(timingAccuracy)}`}>
          {timingAccuracy}
        </span>
      </h3>
      
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="text-gray-400">Current Time:</p>
          <p className="font-mono">{currentTime.toFixed(3)}s</p>
        </div>
        <div>
          <p className="text-gray-400">Segment:</p>
          <p className="font-mono">{currentSegment.start_time.toFixed(1)}-{currentSegment.end_time.toFixed(1)}s</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Word Confidence:</span>
          <div className="flex items-center gap-2">
            {getConfidenceBar(confidenceScore)}
            <span className="text-xs font-mono">{(confidenceScore * 100).toFixed(0)}%</span>
          </div>
        </div>
        
        {currentWordIndex >= 0 && (
          <div>
            <p className="text-gray-400 text-xs">Active Word:</p>
            <p className="text-sm">
              <span className="text-gray-500">{words.slice(0, currentWordIndex).join(' ')} </span>
              <span className="bg-blue-600 px-1 rounded">{words[currentWordIndex]}</span>
              <span className="text-gray-500"> {words.slice(currentWordIndex + 1).join(' ')}</span>
            </p>
          </div>
        )}
      </div>

      <div className="text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-400">Total Words:</span>
          <span>{words.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Timing Data:</span>
          <span>{wordTimings.length > 0 ? 'Available' : 'Missing'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Frame Rate:</span>
          <span>30fps</span>
        </div>
      </div>
    </div>
  );
}