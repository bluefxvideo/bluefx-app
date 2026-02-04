'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Play, Square, Mic } from 'lucide-react';
import {
  MINIMAX_VOICE_OPTIONS,
  EMOTION_OPTIONS,
  type MinimaxEmotion
} from '@/components/shared/voice-constants';

import { VoiceOverState } from '../hooks/use-voice-over';

interface GeneratorTabProps {
  voiceOverState: {
    state: VoiceOverState;
    generateVoice: () => void;
    updateScriptText: (text: string) => void;
    updateVoiceSettings: (settings: Partial<VoiceOverState['voiceSettings']>) => void;
    handleVoicePlayback: (voiceId: string, url: string) => void;
    setState: (updater: (prev: VoiceOverState) => VoiceOverState) => void;
  };
  credits: number;
  clonedVoices?: Array<{ id: string; name: string; minimax_voice_id: string; preview_url: string | null }>;
}

/**
 * Generator Tab - Main voice over generation interface
 * Updated for Minimax Speech 2.6 HD with full settings
 */
export function GeneratorTab({ voiceOverState, credits, clonedVoices = [] }: GeneratorTabProps) {
  const {
    state,
    generateVoice,
    updateScriptText,
    updateVoiceSettings,
    handleVoicePlayback,
    setState,
  } = voiceOverState;

  const [localScriptText, setLocalScriptText] = useState(state.scriptText);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  // Check for prefilled script from Script Generator
  useEffect(() => {
    const prefillScript = localStorage.getItem('prefill_script');
    if (prefillScript) {
      setLocalScriptText(prefillScript);
      localStorage.removeItem('prefill_script');
    }
  }, []);

  // Sync local state with global state
  useEffect(() => {
    setLocalScriptText(state.scriptText);
  }, [state.scriptText]);

  // Update script text with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      updateScriptText(localScriptText);
    }, 500);
    return () => clearTimeout(timer);
  }, [localScriptText, updateScriptText]);

  const handleVoiceSelection = (voiceId: string) => {
    setState((prev) => ({ ...prev, selectedVoice: voiceId }));
  };

  const estimatedCredits = 2;
  const canGenerate = localScriptText.trim().length > 0 && state.selectedVoice && credits >= estimatedCredits;

  // Per-voice avatar configurations for DiceBear micah style
  // Each voice gets hand-picked params matching their gender, ethnicity, and personality
  const VOICE_AVATAR_PARAMS: Record<string, string> = {
    // === Professional Females ===
    Wise_Woman: 'baseColor=ac6651&hair=full&hairColor=808080&mouth=smile&eyes=smiling&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=100&earringsProbability=60&shirt=collared&shirtColor=6c63ff',
    English_Graceful_Lady: 'baseColor=d2b48c&hair=full&hairColor=3a1c00&mouth=smile&eyes=smilingShadow&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=0&earringsProbability=80&shirt=collared&shirtColor=c77dba',
    English_MatureBoss: 'baseColor=77311d&hair=full&hairColor=000000&mouth=smirk&eyes=eyes&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=80&shirt=collared&shirtColor=2d2d2d',
    English_Wiselady: 'baseColor=e0ac69&hair=full&hairColor=6a4e42&mouth=smile&eyes=smilingShadow&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=100&earringsProbability=40&shirt=collared&shirtColor=4a6fa5',
    English_ConfidentWoman: 'baseColor=8d5524&hair=full&hairColor=000000&mouth=smirk&eyes=eyes&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=80&shirt=collared&shirtColor=e74c3c',

    // === Professional Males ===
    Deep_Voice_Man: 'baseColor=8d5524&hair=fonze&hairColor=3a1c00&mouth=smile&eyes=eyes&eyebrows=up&facialHairProbability=100&facialHair=beard&facialHairColor=3a1c00&glassesProbability=0&earringsProbability=0&shirt=collared&shirtColor=2c3e50',
    Patient_Man: 'baseColor=f9c9b6&hair=dougFunny&hairColor=6a4e42&mouth=smile&eyes=smiling&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=3498db',
    Determined_Man: 'baseColor=d2b48c&hair=fonze&hairColor=3a1c00&mouth=smirk&eyes=eyes&eyebrows=up&facialHairProbability=100&facialHair=scruff&facialHairColor=3a1c00&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=e67e22',
    Elegant_Man: 'baseColor=f9c9b6&hair=dannyPhantom&hairColor=3a1c00&mouth=smile&eyes=eyesShadow&eyebrows=down&facialHairProbability=0&glassesProbability=100&earringsProbability=0&shirt=collared&shirtColor=8e44ad',
    English_Trustworth_Man: 'baseColor=f9c9b6&hair=fonze&hairColor=6a4e42&mouth=smile&eyes=smiling&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=collared&shirtColor=2980b9',
    English_Diligent_Man: 'baseColor=77311d&hair=fonze&hairColor=3a1c00&mouth=smile&eyes=eyes&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=collared&shirtColor=27ae60',
    English_ManWithDeepVoice: 'baseColor=8d5524&hair=fonze&hairColor=3a1c00&mouth=smirk&eyes=eyes&eyebrows=up&facialHairProbability=100&facialHair=beard&facialHairColor=3a1c00&glassesProbability=0&earringsProbability=0&shirt=collared&shirtColor=34495e',
    English_MaturePartner: 'baseColor=e0ac69&hair=fonze&hairColor=808080&mouth=smile&eyes=eyes&eyebrows=up&facialHairProbability=100&facialHair=scruff&facialHairColor=808080&glassesProbability=100&earringsProbability=0&shirt=collared&shirtColor=2c3e50',
    English_Steadymentor: 'baseColor=f9c9b6&hair=mrClean&hairColor=808080&mouth=smile&eyes=smiling&eyebrows=up&facialHairProbability=100&facialHair=beard&facialHairColor=808080&glassesProbability=100&earringsProbability=0&shirt=collared&shirtColor=34495e',
    'English_Deep-VoicedGentleman': 'baseColor=f9c9b6&hair=fonze&hairColor=3a1c00&mouth=smile&eyes=eyes&eyebrows=down&facialHairProbability=100&facialHair=scruff&facialHairColor=3a1c00&glassesProbability=0&earringsProbability=0&shirt=collared&shirtColor=8e44ad',
    English_WiseScholar: 'baseColor=f9c9b6&hair=dougFunny&hairColor=6a4e42&mouth=smile&eyes=eyesShadow&eyebrows=up&facialHairProbability=0&glassesProbability=100&earringsProbability=0&shirt=collared&shirtColor=2c3e50',
    English_PatientMan: 'baseColor=f9c9b6&hair=dannyPhantom&hairColor=6a4e42&mouth=smile&eyes=smiling&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=3498db',
    English_BossyLeader: 'baseColor=77311d&hair=fonze&hairColor=3a1c00&mouth=smirk&eyes=eyes&eyebrows=up&facialHairProbability=100&facialHair=beard&facialHairColor=3a1c00&glassesProbability=100&earringsProbability=0&shirt=collared&shirtColor=c0392b',

    // === Natural Females ===
    Calm_Woman: 'baseColor=f9c9b6&hair=pixie&hairColor=6a4e42&mouth=smile&eyes=smiling&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=0&earringsProbability=40&shirt=crew&shirtColor=1abc9c',
    Lovely_Girl: 'baseColor=f9c9b6&hair=full&hairColor=d4a574&mouth=smile&eyes=smiling&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=60&shirt=crew&shirtColor=e91e63',
    Sweet_Girl_2: 'baseColor=f9c9b6&hair=pixie&hairColor=6a4e42&mouth=smile&eyes=smilingShadow&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=0&earringsProbability=40&shirt=crew&shirtColor=f48fb1',
    English_CalmWoman: 'baseColor=e0ac69&hair=full&hairColor=3a1c00&mouth=smile&eyes=smiling&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=0&earringsProbability=40&shirt=crew&shirtColor=26a69a',
    English_LovelyGirl: 'baseColor=f9c9b6&hair=pixie&hairColor=b55239&mouth=smile&eyes=smilingShadow&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=80&shirt=open&shirtColor=e91e63',
    'English_Soft-spokenGirl': 'baseColor=f9c9b6&hair=dannyPhantom&hairColor=d4a574&mouth=pucker&eyes=smilingShadow&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=0&earringsProbability=20&shirt=crew&shirtColor=b39ddb',
    English_SereneWoman: 'baseColor=f9c9b6&hair=full&hairColor=daa520&mouth=smile&eyes=smiling&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=0&earringsProbability=40&shirt=crew&shirtColor=80cbc4',
    'English_Kind-heartedGirl': 'baseColor=f9c9b6&hair=pixie&hairColor=6a4e42&mouth=smile&eyes=smilingShadow&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=60&shirt=crew&shirtColor=f48fb1',

    // === Natural Males ===
    Casual_Guy: 'baseColor=f9c9b6&hair=dougFunny&hairColor=6a4e42&mouth=smile&eyes=smiling&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=open&shirtColor=e67e22',
    Decent_Boy: 'baseColor=f9c9b6&hair=dannyPhantom&hairColor=3a1c00&mouth=smile&eyes=eyes&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=3498db',
    'English_Gentle-voiced_man': 'baseColor=f9c9b6&hair=dougFunny&hairColor=6a4e42&mouth=smile&eyes=smiling&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=66bb6a',
    English_ReservedYoungMan: 'baseColor=f9c9b6&hair=fonze&hairColor=3a1c00&mouth=smile&eyes=eyes&eyebrows=down&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=7986cb',
    English_DecentYoungMan: 'baseColor=d2b48c&hair=fonze&hairColor=6a4e42&mouth=smile&eyes=smiling&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=42a5f5',
    English_Jovialman: 'baseColor=d2b48c&hair=dougFunny&hairColor=3a1c00&mouth=laughing&eyes=smiling&eyebrows=up&facialHairProbability=100&facialHair=beard&facialHairColor=3a1c00&glassesProbability=0&earringsProbability=0&shirt=open&shirtColor=ff7043',

    // === Natural Neutrals ===
    Friendly_Person: 'baseColor=d2b48c&hair=fonze&hairColor=3a1c00&mouth=smile&eyes=smiling&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=ff9800',
    English_FriendlyPerson: 'baseColor=e0ac69&hair=dougFunny&hairColor=6a4e42&mouth=smile&eyes=smiling&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=open&shirtColor=4caf50',

    // === Expressive Females ===
    Inspirational_girl: 'baseColor=ac6651&hair=full&hairColor=000000&mouth=laughing&eyes=smiling&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=60&shirt=crew&shirtColor=ff5722',
    Lively_Girl: 'baseColor=f9c9b6&hair=dannyPhantom&hairColor=b55239&mouth=laughing&eyes=smiling&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=40&shirt=open&shirtColor=e91e63',
    Exuberant_Girl: 'baseColor=ac6651&hair=full&hairColor=3a1c00&mouth=laughing&eyes=smilingShadow&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=60&shirt=crew&shirtColor=ff9800',
    English_UpsetGirl: 'baseColor=d2b48c&hair=full&hairColor=3a1c00&mouth=sad&eyes=eyesShadow&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=0&earringsProbability=20&shirt=crew&shirtColor=78909c',
    English_Whispering_girl: 'baseColor=f9c9b6&hair=pixie&hairColor=d4a574&mouth=pucker&eyes=smilingShadow&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=0&earringsProbability=20&shirt=crew&shirtColor=b39ddb',
    English_PlayfulGirl: 'baseColor=f9c9b6&hair=dannyPhantom&hairColor=daa520&mouth=laughing&eyes=smiling&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=40&shirt=open&shirtColor=f06292',
    English_SentimentalLady: 'baseColor=e0ac69&hair=full&hairColor=3a1c00&mouth=sad&eyes=eyesShadow&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=0&earringsProbability=60&shirt=crew&shirtColor=7e57c2',
    English_StressedLady: 'baseColor=f9c9b6&hair=dannyPhantom&hairColor=6a4e42&mouth=nervous&eyes=eyesShadow&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=0&earringsProbability=20&shirt=crew&shirtColor=90a4ae',
    English_WhimsicalGirl: 'baseColor=f9c9b6&hair=pixie&hairColor=b55239&mouth=surprised&eyes=round&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=80&shirt=open&shirtColor=ab47bc',

    // === Expressive Males ===
    English_CaptivatingStoryteller: 'baseColor=c68642&hair=fonze&hairColor=3a1c00&mouth=smile&eyes=eyes&eyebrows=up&facialHairProbability=100&facialHair=scruff&facialHairColor=3a1c00&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=5c6bc0',
    English_SadTeen: 'baseColor=f9c9b6&hair=dougFunny&hairColor=6a4e42&mouth=frown&eyes=eyes&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=607d8b',
    'English_Strong-WilledBoy': 'baseColor=c68642&hair=fonze&hairColor=3a1c00&mouth=smirk&eyes=eyes&eyebrows=up&facialHairProbability=100&facialHair=scruff&facialHairColor=3a1c00&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=e65100',

    // === Character Females ===
    Young_Knight: 'baseColor=f9c9b6&hair=dannyPhantom&hairColor=b55239&mouth=smile&eyes=eyes&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=40&shirt=crew&shirtColor=4caf50',
    Imposing_Manner: 'baseColor=8d5524&hair=full&hairColor=000000&mouth=smirk&eyes=eyes&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=80&shirt=collared&shirtColor=b71c1c',
    Abbess: 'baseColor=f9c9b6&hair=full&hairColor=808080&mouth=smile&eyes=smiling&eyebrows=eyelashesDown&facialHairProbability=0&glassesProbability=0&earringsProbability=20&shirt=collared&shirtColor=5c6bc0',
    English_ImposingManner: 'baseColor=77311d&hair=full&hairColor=000000&mouth=smirk&eyes=eyes&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=80&shirt=collared&shirtColor=880e4f',
    English_AssertiveQueen: 'baseColor=f9c9b6&hair=full&hairColor=daa520&mouth=smirk&eyes=eyesShadow&eyebrows=eyelashesUp&facialHairProbability=0&glassesProbability=0&earringsProbability=100&shirt=collared&shirtColor=6a1b9a',

    // === Character Males ===
    English_Debator: 'baseColor=d2b48c&hair=turban&hairColor=6a4e42&mouth=laughing&eyes=round&eyebrows=up&facialHairProbability=100&facialHair=beard&facialHairColor=6a4e42&glassesProbability=0&earringsProbability=100&earrings=hoop&shirt=open&shirtColor=8d6e63',
    English_Aussie_Bloke: 'baseColor=f9c9b6&hair=dougFunny&hairColor=daa520&mouth=laughing&eyes=smiling&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=open&shirtColor=ff9800',
    English_PassionateWarrior: 'baseColor=c68642&hair=fonze&hairColor=3a1c00&mouth=smirk&eyes=eyes&eyebrows=up&facialHairProbability=100&facialHair=scruff&facialHairColor=3a1c00&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=b71c1c',
    English_Comedian: 'baseColor=d2b48c&hair=dougFunny&hairColor=6a4e42&mouth=laughing&eyes=smiling&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=open&shirtColor=ffc107',

    // === Character Neutral ===
    English_AnimeCharacter: 'baseColor=f9c9b6&hair=dannyPhantom&hairColor=000000&mouth=surprised&eyes=round&eyebrows=up&facialHairProbability=0&glassesProbability=0&earringsProbability=0&shirt=crew&shirtColor=e91e63',
  };

  const getVoiceAvatarUrl = (voiceId: string, name: string, gender: string) => {
    const params = VOICE_AVATAR_PARAMS[voiceId];
    if (params) {
      return `https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(voiceId)}&${params}`;
    }
    // Fallback for cloned/unknown voices
    const seed = encodeURIComponent(name);
    if (gender === 'female') {
      return `https://api.dicebear.com/9.x/micah/svg?seed=${seed}&facialHairProbability=0&earringsProbability=50&eyebrows=eyelashesUp,eyelashesDown&hair=full,pixie,dannyPhantom`;
    }
    return `https://api.dicebear.com/9.x/micah/svg?seed=${seed}&facialHairProbability=40&earringsProbability=0&eyebrows=up,down&hair=fonze,mrT,dougFunny,mrClean,full`;
  };

  return (
    <div className="space-y-8">
      {/* Step 1: Script Input */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">1. Enter Your Script</h3>
          <p className="text-sm text-muted-foreground">Write or paste the text you want to convert to speech (max 10,000 characters)</p>
        </div>
        <Textarea
          value={localScriptText}
          onChange={(e) => setLocalScriptText(e.target.value)}
          placeholder="Enter the text you want to convert to speech..."
          className="min-h-[100px] resize-y"
          disabled={state.isGenerating}
          maxLength={10000}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>Words: {localScriptText.trim().split(/\s+/).filter(Boolean).length}</span>
          <span>{localScriptText.length}/10,000 characters</span>
        </div>
      </Card>

      {/* Step 2: Voice Selection */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">2. Choose Your Voice</h3>
            <p className="text-sm text-muted-foreground">Select from AI voices or use your cloned voice</p>
          </div>
          {/* Gender Filter */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
            {(['all', 'male', 'female'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setGenderFilter(filter)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  genderFilter === filter
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filter === 'all' ? `All (${MINIMAX_VOICE_OPTIONS.length})` : filter === 'male' ? `Male (${MINIMAX_VOICE_OPTIONS.filter(v => v.gender === 'male').length})` : `Female (${MINIMAX_VOICE_OPTIONS.filter(v => v.gender === 'female').length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Cloned voices section */}
        {clonedVoices.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">My Cloned Voices</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-4">
              {clonedVoices.map((voice) => (
                <div
                  key={voice.id}
                  className={`relative p-3 rounded-lg border-2 text-left transition-all hover:shadow-md cursor-pointer ${
                    state.selectedVoice === voice.minimax_voice_id
                      ? 'border-purple-500 bg-purple-500/5 shadow-sm'
                      : 'border-border hover:border-purple-500/50'
                  }`}
                  onClick={() => handleVoiceSelection(voice.minimax_voice_id)}
                >
                  {voice.preview_url && (
                    <button
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVoicePlayback(voice.minimax_voice_id, voice.preview_url!);
                      }}
                    >
                      {state.playingVoiceId === voice.minimax_voice_id ? (
                        <Square className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                  <div className="flex items-center gap-2.5">
                    <img
                      src={getVoiceAvatarUrl('', voice.name, 'neutral')}
                      alt=""
                      className="w-10 h-10 rounded-full bg-muted/50 shrink-0"
                      loading="lazy"
                    />
                    <p className="font-medium text-sm truncate pr-6">{voice.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">Your custom cloned voice</p>
                  <div className="flex gap-1 mt-2">
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded-full">
                      Cloned
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-2">System Voices</p>
          </div>
        )}

        {/* System voices */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {MINIMAX_VOICE_OPTIONS
            .map((voice, originalIndex) => ({ voice, originalIndex }))
            .filter(({ voice }) => genderFilter === 'all' || voice.gender === genderFilter)
            .map(({ voice, originalIndex }) => (
            <div
              key={voice.id}
              className={`relative p-3 rounded-lg border-2 text-left transition-all hover:shadow-md cursor-pointer ${
                state.selectedVoice === voice.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handleVoiceSelection(voice.id)}
            >
              <button
                className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVoicePlayback(voice.id, voice.preview_url);
                }}
              >
                {state.playingVoiceId === voice.id ? (
                  <Square className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </button>
              <div className="flex items-center gap-2.5">
                <img
                  src={getVoiceAvatarUrl(voice.id, voice.name, voice.gender ?? 'neutral')}
                  alt=""
                  className="w-10 h-10 rounded-full bg-muted/50 shrink-0"
                  loading="lazy"
                />
                <p className="font-medium text-sm truncate pr-6">
                  <span className="text-muted-foreground mr-1">{originalIndex + 1}.</span>
                  {voice.name}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{voice.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                  {voice.gender}
                </span>
                {voice.category && (
                  <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                    {voice.category}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Step 3: Voice Settings + Generate */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">3. Voice Settings</h3>
          <p className="text-sm text-muted-foreground">Fine-tune speed, pitch, volume, and emotion</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Speed Control */}
          <div className="space-y-2">
            <Label className="text-sm">Speed: {state.voiceSettings.speed}x</Label>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={state.voiceSettings.speed}
              onChange={(e) => updateVoiceSettings({ speed: parseFloat(e.target.value) })}
              disabled={state.isGenerating}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5x</span>
              <span>2.0x</span>
            </div>
          </div>

          {/* Pitch Control */}
          <div className="space-y-2">
            <Label className="text-sm">Pitch: {state.voiceSettings.pitch > 0 ? '+' : ''}{state.voiceSettings.pitch}</Label>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={state.voiceSettings.pitch}
              onChange={(e) => updateVoiceSettings({ pitch: parseInt(e.target.value) })}
              disabled={state.isGenerating}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-12</span>
              <span>+12</span>
            </div>
          </div>

          {/* Volume Control */}
          <div className="space-y-2">
            <Label className="text-sm">Volume: {state.voiceSettings.volume}</Label>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={state.voiceSettings.volume}
              onChange={(e) => updateVoiceSettings({ volume: parseInt(e.target.value) })}
              disabled={state.isGenerating}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>10</span>
            </div>
          </div>

          {/* Emotion Control */}
          <div className="space-y-2">
            <Label className="text-sm">Emotion</Label>
            <Select
              value={state.voiceSettings.emotion}
              onValueChange={(emotion: MinimaxEmotion) => updateVoiceSettings({ emotion })}
              disabled={state.isGenerating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMOTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Set the emotional tone
            </p>
          </div>
        </div>

        {/* Generate Button */}
        <div className="mt-6">
          <Button
            onClick={generateVoice}
            disabled={!canGenerate || state.isGenerating}
            className="w-full max-w-md mx-auto h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium flex"
            size="lg"
          >
            {state.isGenerating ? (
              <>
                <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Generating Voice...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Generate Voice (2 credits)
              </>
            )}
          </Button>
          {credits < estimatedCredits && localScriptText.trim().length > 0 && state.selectedVoice && (
            <p className="text-xs text-destructive text-center mt-2">
              Insufficient credits. You need {estimatedCredits} credits.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
