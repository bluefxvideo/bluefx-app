'use client';

import { FileText, Mic, Video } from 'lucide-react';

/**
 * Ready to Create Panel - Welcome state for Script-to-Video
 * Matches the exact styling of Talking Avatar's welcome panel
 */
export function ReadyToCreatePanel() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
        <Video className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground mb-8 max-w-md">
        Transform scripts into engaging videos with AI orchestration in 3 simple steps.
      </p>

      <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="text-lg font-bold text-blue-500 mb-1">1</div>
          <p className="text-sm font-medium">Create Script</p>
          <p className="text-xs text-muted-foreground">Generate from idea or write your own</p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <div className="text-lg font-bold text-blue-500 mb-1">2</div>
          <p className="text-sm font-medium">Choose Voice</p>
          <p className="text-xs text-muted-foreground">Select AI voice and speaking style</p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div className="text-lg font-bold text-blue-500 mb-1">3</div>
          <p className="text-sm font-medium">Generate Assets</p>
          <p className="text-xs text-muted-foreground">AI creates images and assembles video</p>
        </div>
      </div>
    </div>
  );
}