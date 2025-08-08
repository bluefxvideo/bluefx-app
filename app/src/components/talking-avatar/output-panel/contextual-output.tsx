'use client';

import { TalkingAvatarOutput } from './talking-avatar-output';
import { HistoryOutput } from './history-output';

interface ContextualOutputProps {
  activeTab: string;
  avatarState: any;
}

export function ContextualOutput({ activeTab, avatarState }: ContextualOutputProps) {
  switch (activeTab) {
    case 'generate':
      return <TalkingAvatarOutput avatarState={avatarState} />;
    case 'history':
      return <HistoryOutput />;
    default:
      return <TalkingAvatarOutput avatarState={avatarState} />;
  }
}