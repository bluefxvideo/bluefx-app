'use client';

import { ContextualOutput } from './contextual-output';
import { VoiceOverState } from '../hooks/use-voice-over';

interface VoiceOverOutputProps {
  voiceOverState: {
    activeTab: string;
    state: VoiceOverState;
    deleteVoice: (voiceId: string) => void;
  };
}

/**
 * Voice Over Output Panel
 * Following exact BlueFX style guide patterns
 */
export function VoiceOverOutput({ voiceOverState }: VoiceOverOutputProps) {
  return <ContextualOutput voiceOverState={voiceOverState} />;
}