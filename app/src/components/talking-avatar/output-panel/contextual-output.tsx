'use client';

import { TalkingAvatarOutput } from './talking-avatar-output';
import { HistoryOutput } from './history-output';
import { TalkingAvatarState } from '../hooks/use-talking-avatar';

interface ContextualOutputProps {
  activeTab: string;
  avatarState: { state: TalkingAvatarState };
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