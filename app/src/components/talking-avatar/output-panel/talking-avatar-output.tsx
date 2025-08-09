'use client';

import { Video, User, Mic } from 'lucide-react';
import { TalkingAvatarState } from '../hooks/use-talking-avatar';

interface TalkingAvatarOutputProps {
  avatarState: { state: TalkingAvatarState };
}

export function TalkingAvatarOutput({ avatarState }: TalkingAvatarOutputProps) {
  const { state } = avatarState;

  if (state.isGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
          <Video className="w-8 h-8 text-white animate-pulse" />
        </div>
        
        <h3 className="text-2xl font-bold mb-2">Generating Avatar Video ✨</h3>
        <p className="text-base text-muted-foreground mb-6 max-w-md">
          Your AI-powered talking avatar video is being created. This typically takes 2-5 minutes.
        </p>

        <div className="w-full max-w-sm">
          <div className="w-full bg-muted rounded-full h-2">
            <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-pulse" 
                 style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
        <Video className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground mb-8 max-w-md">
        Transform text into engaging videos with AI-powered talking avatars in 3 simple steps.
      </p>

      <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div className="text-lg font-bold text-blue-500 mb-1">1</div>
          <p className="text-sm font-medium">Choose Avatar</p>
          <p className="text-xs text-muted-foreground">Select template or upload custom</p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <div className="text-lg font-bold text-blue-500 mb-1">2</div>
          <p className="text-sm font-medium">Add Voice</p>
          <p className="text-xs text-muted-foreground">Enter script and select voice</p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div className="text-lg font-bold text-blue-500 mb-1">3</div>
          <p className="text-sm font-medium">Generate Video</p>
          <p className="text-xs text-muted-foreground">Create professional avatar video</p>
        </div>
      </div>
    </div>
  );
}