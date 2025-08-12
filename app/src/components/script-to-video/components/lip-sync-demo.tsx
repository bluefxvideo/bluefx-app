'use client';

import { LipSyncCaptions } from './lip-sync-captions';

/**
 * Demo component showing lip sync highlighting
 */
export function LipSyncDemo() {
  // Mock word-level timing data (what you'd get from Whisper)
  const mockWords = [
    { text: 'Welcome', start_time: 0.0, end_time: 0.8, confidence: 0.95 },
    { text: 'to', start_time: 0.8, end_time: 1.0, confidence: 0.98 },
    { text: 'our', start_time: 1.0, end_time: 1.3, confidence: 0.92 },
    { text: 'amazing', start_time: 1.3, end_time: 1.9, confidence: 0.88 },
    { text: 'script-to-video', start_time: 1.9, end_time: 2.8, confidence: 0.94 },
    { text: 'generator', start_time: 2.8, end_time: 3.5, confidence: 0.91 },
    { text: 'with', start_time: 3.5, end_time: 3.8, confidence: 0.97 },
    { text: 'perfect', start_time: 3.8, end_time: 4.4, confidence: 0.89 },
    { text: 'lip', start_time: 4.4, end_time: 4.7, confidence: 0.93 },
    { text: 'sync', start_time: 4.7, end_time: 5.2, confidence: 0.96 },
    { text: 'highlighting!', start_time: 5.2, end_time: 6.0, confidence: 0.87 }
  ];

  return (
    <div className="relative w-full h-96 bg-black rounded-lg overflow-hidden">
      {/* Mock video background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
        <div className="text-white text-center">
          <h3 className="text-2xl font-bold mb-2">🎬 Lip Sync Demo</h3>
          <p className="text-sm opacity-75">Words highlight as they're spoken</p>
        </div>
      </div>
      
      {/* Lip sync captions overlay */}
      <LipSyncCaptions words={mockWords} />
      
      {/* Instructions */}
      <div className="absolute top-4 left-4 text-white text-sm bg-black/60 p-3 rounded">
        <p><strong>How it works:</strong></p>
        <ul className="mt-1 space-y-1 text-xs">
          <li>• Each word highlights golden when spoken</li>
          <li>• Shows 6-8 word window for readability</li>
          <li>• Uses Whisper word-level timing</li>
          <li>• Smooth transitions and scaling</li>
        </ul>
      </div>
    </div>
  );
}