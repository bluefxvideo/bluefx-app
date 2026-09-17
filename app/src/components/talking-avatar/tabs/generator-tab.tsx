'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Video, User, Mic, Mic2, Play, Square, ArrowRight, ArrowLeft, Monitor, Smartphone, Upload, AlertCircle, Plus, Trash2, RotateCcw, Sparkles, ChevronDown, ChevronUp, ImageIcon, Loader2, Download, Save, Heart, Zap, Gem, Check } from 'lucide-react';
import { AVATAR_TIER_CONFIG, AVATAR_BASIC_WAIT_LABEL, AVATAR_BASIC_CREDITS_PER_SECOND, AVATAR_BASIC_WORDS_PER_SECOND, maxWordsFor, waitLabelFor, scriptFit, isScriptTier, tierLabel, type AvatarQualityTier } from '@/types/talking-avatar-tiers';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { InsufficientCreditsNotice } from '@/components/ui/insufficient-credits-notice';
import { UnifiedDragDrop } from '@/components/ui/unified-drag-drop';
import { UseTalkingAvatarReturn } from '../hooks/use-talking-avatar';
import { AvatarTemplate } from '@/actions/tools/talking-avatar';
import { MINIMAX_VOICE_OPTIONS, DEFAULT_VOICE_SETTINGS, EMOTION_OPTIONS, type VoiceSettings, type MinimaxEmotion } from '@/components/shared/voice-constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/app/supabase/client';
import { toast } from 'sonner';
import { generateAvatarImage, type AvatarGeneratorRequest } from '@/actions/tools/avatar-generator';

const AVATAR_GENERATION_CREDIT_COST = 4;
const AVATAR_PAGE_SIZE = 24;

// Constants for LTX model limits
const MAX_AUDIO_DURATION_SECONDS = 60;

// Plain-words helpers for prices and limits (no "cr/s", no "s")
function creditsPerSecondText(n: number): string {
  return `${n} credit${n === 1 ? '' : 's'} per second`;
}

function wordsText(n: number): string {
  return `${n} word${n === 1 ? '' : 's'}`;
}

function moreWordsText(n: number): string {
  return `${n} more word${n === 1 ? '' : 's'}`;
}

function tierExplanation(tier: AvatarQualityTier): string {
  if (tier === 'standard') {
    return `Pick one of ${MINIMAX_VOICE_OPTIONS.length} voices, use your cloned voice, or upload a recording. Videos up to ${MAX_AUDIO_DURATION_SECONDS} seconds. ${creditsPerSecondText(AVATAR_BASIC_CREDITS_PER_SECOND)}, so a 30 second video costs 30 credits. Ready in ${AVATAR_BASIC_WAIT_LABEL}.`;
  }
  const c = AVATAR_TIER_CONFIG[tier];
  const shortest = c.allowedDurations[0];
  const opening = tier === 'ultra' ? 'Best lip sync. The avatar speaks your script.' : 'The avatar speaks your script.';
  const shape = tier === 'ultra' ? ' The video keeps the shape of the avatar photo.' : '';
  return `${opening} The voice is picked for you and can change from one video to the next. To choose the voice or use your cloned voice, pick Basic. Videos from ${shortest} to ${c.maxSeconds} seconds. ${creditsPerSecondText(c.creditsPerSecond)}, so the shortest video costs ${shortest * c.creditsPerSecond} credits. Ready in ${c.waitLabel}.${shape}`;
}

function tooLongText(tier: Exclude<AvatarQualityTier, 'standard'>, overBy: number, words: number): string {
  const cut = `Cut ${wordsText(overBy)}`;
  if (tier === 'ultra' && words <= maxWordsFor('fast')) {
    return `${cut}, or pick Fast above (up to ${maxWordsFor('fast')} words).`;
  }
  return `${cut}, or pick Basic above (up to ${MAX_AUDIO_DURATION_SECONDS} seconds).`;
}

// Map raw ethnicity values to broad filter groups
function getEthnicityGroup(ethnicity?: string): string {
  if (!ethnicity) return 'other';
  const e = ethnicity.toLowerCase();
  if (e.includes('black') || e.includes('nigerian') || e.includes('ghanaian') || e.includes('somali') || e.includes('senegalese')) return 'black';
  if (e.includes('latina') || e.includes('latino') || e.includes('mexican') || e.includes('puerto rican') || e.includes('colombian') || e.includes('brazilian') || e.includes('portuguese')) return 'latina/o';
  if (e.includes('white') || e.includes('irish') || e.includes('german') || e.includes('scandinavian') || e.includes('swedish') || e.includes('french') && !e.includes('mixed') || e.includes('italian') || e.includes('mediterranean') || e.includes('european') || e.includes('croatian') || e.includes('russian')) return 'white';
  if (e.includes('east asian') || e.includes('japanese') || e.includes('chinese') || e.includes('korean') || e.includes('vietnamese')) return 'asian';
  if (e.includes('middle eastern') || e.includes('lebanese') || e.includes('israeli') || e.includes('persian') || e.includes('egyptian')) return 'middle eastern';
  if (e.includes('indian') || e.includes('south asian') || e.includes('pakistani')) return 'south asian';
  if (e.includes('mixed')) return 'mixed';
  return 'other';
}

// Per-voice avatar configurations for DiceBear micah style
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

interface GeneratorTabProps {
  avatarState: UseTalkingAvatarReturn;
  credits: number;
  /** True while the balance is still being fetched — suppresses the
      insufficient-credits warnings so they don't flash on first load. */
  creditsLoading?: boolean;
  /** False while the History tab covers the wizard (it stays mounted to keep its state). */
  isActive?: boolean;
}

export function GeneratorTab({ avatarState, credits, creditsLoading, isActive = true }: GeneratorTabProps) {
  const {
    state,
    loadAvatarTemplates,
    handleAvatarSelection,
    selectAvatarImageUrl,
    handleVoiceGeneration,
    handleVideoGeneration,
    goToStep,
    resetWizard,
    clearVoice,
    setAudioInputMode,
    setUploadedAudio,
    setActionPrompt,
    setSelectedResolution,
    setScriptText,
    setQualityTier,
    cloneVoice,
    saveAvatar,
    deleteSavedAvatar,
  } = avatarState;

  // The hook owns the script and the movement text: one source of truth. They used to be
  // copied into local state and synced back through an effect; with keys arriving fast
  // the two copies chased each other ("Maximum update depth exceeded").
  const localScriptText = state.scriptText;
  const [selectedTemplate, setSelectedTemplate] = useState<AvatarTemplate | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('Friendly_Person');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const localActionPrompt = state.actionPrompt;
  const audioInputRef = useRef<HTMLInputElement>(null);
  const stepTopRef = useRef<HTMLDivElement>(null);

  // Scroll to top when step changes
  useEffect(() => {
    stepTopRef.current?.scrollIntoView({ block: 'start' });
  }, [state.currentStep]);

  // The wizard stays mounted behind History: stop a playing voice sample when it is covered
  useEffect(() => {
    if (isActive || !currentAudio) return;
    currentAudio.pause();
    setCurrentAudio(null);
    setPlayingVoiceId(null);
  }, [isActive, currentAudio]);

  // Avatar hover video preview
  const [hoveredTemplateId, setHoveredTemplateId] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  // Avatar filter state
  const [avatarGenderFilter, setAvatarGenderFilter] = useState<string>('all');
  const [avatarAgeFilter, setAvatarAgeFilter] = useState<string>('all');
  const [avatarEthnicityFilter, setAvatarEthnicityFilter] = useState<string>('all');
  // The library shows a page at a time: 246 cards at once made step 1 a very long scroll
  const [visibleAvatarCount, setVisibleAvatarCount] = useState(AVATAR_PAGE_SIZE);

  // Voice filter state
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  // Clone voice modal state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneVoiceName, setCloneVoiceName] = useState('');
  const [cloneNoiseReduction, setCloneNoiseReduction] = useState(true);
  const [cloneVolumeNorm, setCloneVolumeNorm] = useState(true);

  // Avatar generator state
  const [showAvatarGen, setShowAvatarGen] = useState(false);
  const [avatarGenPrompt, setAvatarGenPrompt] = useState('');
  const [avatarGenPreset, setAvatarGenPreset] = useState<AvatarGeneratorRequest['style_preset']>('ugc_portrait');
  const [avatarGenRefImage, setAvatarGenRefImage] = useState<File | null>(null);
  const [avatarGenRefUrl, setAvatarGenRefUrl] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null);
  const [saveAvatarName, setSaveAvatarName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  // Get current user for avatar generation
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  // Handle avatar generation
  const handleGenerateAvatar = async () => {
    if (!avatarGenPrompt.trim()) {
      toast.error('Please describe your avatar');
      return;
    }
    if (!userId) {
      toast.error('Please sign in to generate avatars');
      return;
    }
    if (credits < AVATAR_GENERATION_CREDIT_COST) {
      toast.error(`Not enough credits. An avatar photo costs ${AVATAR_GENERATION_CREDIT_COST} credits.`);
      return;
    }
    setIsGeneratingAvatar(true);
    setGeneratedAvatarUrl(null);
    setShowSaveInput(false);
    try {
      // Upload reference image if provided
      let refUrl = avatarGenRefUrl;
      if (avatarGenRefImage && !refUrl) {
        const { uploadImageToStorage } = await import('@/actions/supabase-storage');
        const uploadResult = await uploadImageToStorage(avatarGenRefImage, {
          bucket: 'images',
          folder: 'avatars/references',
          filename: `ref_${Date.now()}.png`,
          contentType: avatarGenRefImage.type,
        });
        if (uploadResult.success && uploadResult.url) {
          refUrl = uploadResult.url;
          setAvatarGenRefUrl(refUrl);
        }
      }

      const result = await generateAvatarImage({
        prompt: avatarGenPrompt,
        style_preset: avatarGenPreset,
        reference_image_url: refUrl || undefined,
        user_id: userId,
      });

      if (result.success && result.image_url) {
        setGeneratedAvatarUrl(result.image_url);
        toast.success('Avatar generated!');
      } else {
        toast.error(result.error || 'Generation failed');
      }
    } catch {
      toast.error('Failed to generate avatar');
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  // Download generated avatar
  const handleDownloadAvatar = async () => {
    if (!generatedAvatarUrl) return;
    try {
      const response = await fetch(generatedAvatarUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `avatar_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download avatar');
    }
  };

  // Save generated avatar to My Avatars
  const handleSaveAvatar = async () => {
    if (!generatedAvatarUrl || !saveAvatarName.trim()) return;
    setIsSavingAvatar(true);
    try {
      const success = await saveAvatar(saveAvatarName.trim(), generatedAvatarUrl);
      if (success) {
        setShowSaveInput(false);
        setSaveAvatarName('');
      }
    } finally {
      setIsSavingAvatar(false);
    }
  };

  // Use generated avatar as the selected avatar
  const handleUseGeneratedAvatar = () => {
    if (!generatedAvatarUrl) return;
    // The AI photo already sits in our storage, so it is used as is
    setSelectedTemplate(null);
    selectAvatarImageUrl(generatedAvatarUrl);
    setShowAvatarGen(false);
  };

  // Load templates on mount
  useEffect(() => {
    loadAvatarTemplates();
  }, [loadAvatarTemplates]);

  // Check for prefilled script from Script Generator
  useEffect(() => {
    const prefillScript = localStorage.getItem('prefill_script');
    if (prefillScript) {
      setScriptText(prefillScript);
      localStorage.removeItem('prefill_script');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update local state when wizard state changes
  useEffect(() => {
    setSelectedTemplate(state.selectedAvatarTemplate);
  }, [state.selectedAvatarTemplate]);

  // The voice pick follows the hook only when the hook's voice changes. It used
  // to ride on the effect above, so every typed letter cleared the chosen voice.
  useEffect(() => {
    setSelectedVoice(state.selectedVoiceId || '');
  }, [state.selectedVoiceId]);

  // The avatar decides the voice: the matching preset, or none when the avatar has
  // no preset (then the button goes grey with "Pick a voice to continue"). Writing
  // only on a match left the previous avatar's voice selected and out of sight.
  useEffect(() => {
    const template = state.selectedAvatarTemplate;
    const matchingVoice = template?.voice_id
      ? MINIMAX_VOICE_OPTIONS.find(v => v.id === template.voice_id)
      : undefined;
    setSelectedVoice(matchingVoice ? matchingVoice.id : (state.selectedVoiceId || ''));
    if (!template?.gender) setVoiceGenderFilter('all');
    if (state.selectedAvatarTemplate?.gender) {
      const gender = state.selectedAvatarTemplate.gender.toLowerCase();
      if (gender === 'male' || gender === 'female') {
        setVoiceGenderFilter(gender);
      }
    }
    // state.selectedVoiceId is read, not watched: only an avatar change runs this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedAvatarTemplate]);

  // Avatar hover video handlers
  const handleAvatarHover = async (templateId: string, shouldPlay: boolean) => {
    const videoElement = videoRefs.current[templateId];
    if (!videoElement) return;

    if (shouldPlay) {
      setHoveredTemplateId(templateId);
      try {
        videoElement.muted = true;
        videoElement.currentTime = 0;
        await videoElement.play();
      } catch {
        // Autoplay prevented
      }
    } else {
      setHoveredTemplateId(null);
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  };

  const handleVoicePlayback = useCallback((voiceId: string, sampleUrl: string) => {
    if (playingVoiceId === voiceId && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setPlayingVoiceId(null);
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const audio = new Audio(sampleUrl);
    setCurrentAudio(audio);
    setPlayingVoiceId(voiceId);

    audio.addEventListener('ended', () => {
      setCurrentAudio(null);
      setPlayingVoiceId(null);
    });
    audio.addEventListener('error', () => {
      setCurrentAudio(null);
      setPlayingVoiceId(null);
    });

    audio.play().catch(() => {
      setCurrentAudio(null);
      setPlayingVoiceId(null);
    });
  }, [playingVoiceId, currentAudio]);

  // Clone modal helpers
  const validateAndSetCloneFile = (file: File) => {
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!validTypes.includes(file.type) && !['mp3', 'wav', 'm4a'].includes(ext)) {
      toast.error('Invalid file type. Please upload MP3, WAV, or M4A.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 20MB.');
      return;
    }
    setCloneFile(file);
    if (!cloneVoiceName) {
      setCloneVoiceName(file.name.replace(/\.[^/.]+$/, '').slice(0, 50));
    }
  };

  const handleCloneSubmit = async () => {
    if (!cloneFile || !cloneVoiceName.trim()) return;
    try {
      const saved = await cloneVoice(cloneFile, cloneVoiceName.trim(), {
        noiseReduction: cloneNoiseReduction,
        volumeNormalization: cloneVolumeNorm,
      });
      // Select the voice that was just paid for (state.clonedVoices here is a stale closure)
      if (saved) setSelectedVoice(saved.minimax_voice_id);
      setCloneFile(null);
      setCloneVoiceName('');
      setShowCloneModal(false);
    } catch {
      // Error handled by hook
    }
  };

  // Step actions
  // Fast / Ultra: the script alone decides the clip length and the price.
  const scriptTier = isScriptTier(state.qualityTier) ? state.qualityTier : null;
  const fit = scriptTier ? scriptFit(scriptTier, localScriptText) : null;

  const handleStepAction = async () => {
    if (state.currentStep === 1) {
      // The pick (and a photo upload) already happened when the card was clicked
      if (selectedTemplate || state.customAvatarUrl) goToStep(2);
    } else if (state.currentStep === 2) {
      if (scriptTier) {
        // Fast / Ultra: no voice step, the script goes straight to the preview
        if (fit?.fits) goToStep(3);
      } else if (state.audioInputMode === 'upload') {
        // Upload mode: skip voice gen, go to step 3
        if (state.uploadedAudioUrl && state.audioDurationSeconds > 0) {
          goToStep(3);
        }
      } else {
        // TTS mode: generate voice → auto-advances to step 3 on success
        if (selectedVoice && localScriptText.trim()) {
          await handleVoiceGeneration(selectedVoice, localScriptText, voiceSettings);
        }
      }
    } else if (state.currentStep === 3) {
      await handleVideoGeneration();
    }
  };

  // Credit estimation
  const getEstimatedDuration = () => {
    // Step 3: use actual audio duration if available
    if (state.currentStep === 3 && state.audioDurationSeconds > 0) {
      return Math.min(state.audioDurationSeconds, MAX_AUDIO_DURATION_SECONDS);
    }
    if (state.audioInputMode === 'upload' && state.audioDurationSeconds > 0) {
      return Math.min(state.audioDurationSeconds, MAX_AUDIO_DURATION_SECONDS);
    }
    const wordCount = localScriptText ? localScriptText.trim().split(/\s+/).filter(w => w).length : 0;
    return Math.min(Math.ceil(wordCount / AVATAR_BASIC_WORDS_PER_SECOND), MAX_AUDIO_DURATION_SECONDS);
  };
  const estimatedDuration = getEstimatedDuration();
  const estimatedCredits = fit ? fit.credits : Math.min(60, Math.ceil(estimatedDuration));

  const canProceed = () => {
    if (state.currentStep === 1) {
      // An own photo counts once its upload has finished
      return !!selectedTemplate || !!state.customAvatarUrl;
    } else if (state.currentStep === 2) {
      if (scriptTier) return !!fit?.fits;
      if (state.audioInputMode === 'upload') {
        return state.uploadedAudioUrl && state.audioDurationSeconds > 0 && state.audioDurationSeconds <= MAX_AUDIO_DURATION_SECONDS;
      }
      // TTS: need script + selected voice (duration is validated in step 3 with actual audio)
      return selectedVoice && localScriptText.trim();
    } else if (state.currentStep === 3) {
      if (scriptTier) return !!fit?.fits && (creditsLoading || credits >= estimatedCredits);
      const hasAudio = state.voiceAudioUrl || state.uploadedAudioUrl;
      const withinDuration = state.audioDurationSeconds <= MAX_AUDIO_DURATION_SECONDS;
      // While the balance is loading, assume enough — the server re-checks anyway.
      return hasAudio && withinDuration && (creditsLoading || credits >= estimatedCredits);
    }
    return false;
  };

  // Button label for each step
  const getButtonLabel = () => {
    if (state.isLoading || state.isGenerating) {
      if (state.currentStep === 1) return 'Uploading photo...';
      if (state.currentStep === 2) return 'Creating voice...';
      if (state.currentStep === 3) return 'Making your video...';
      return 'Processing...';
    }
    if (state.currentStep === 1) {
      return selectedTemplate || state.customAvatarUrl ? 'Continue' : 'Pick an avatar to continue';
    }
    if (state.currentStep === 2) {
      if (scriptTier) return 'Continue';
      return state.audioInputMode === 'upload' ? 'Continue' : 'Create Voice';
    }
    if (state.currentStep === 3) {
      return scriptTier
        ? `Generate ${tierLabel(scriptTier)} Video · ${estimatedCredits} credits`
        : `Generate Video · ${estimatedCredits} credits`;
    }
    return 'Next';
  };

  // Button icon for each step
  const getButtonIcon = () => {
    if (state.isLoading || state.isGenerating) return <Loader2 className="w-4 h-4 mr-2 animate-spin" />;
    if (state.currentStep === 2 && !scriptTier && state.audioInputMode === 'tts') return <Mic className="w-4 h-4 mr-2" />;
    if (state.currentStep === 3) return <Video className="w-4 h-4 mr-2" />;
    return null;
  };
  // Steps that only move the user forward get an arrow
  const showNextArrow = !state.isLoading && !state.isGenerating && (
    state.currentStep === 1 || (state.currentStep === 2 && (!!scriptTier || state.audioInputMode === 'upload'))
  );

  // Library avatars after the filters, shown a page at a time
  const filteredTemplates = state.avatarTemplates.filter((template: AvatarTemplate) => {
    if (avatarGenderFilter !== 'all' && template.gender !== avatarGenderFilter) return false;
    if (avatarAgeFilter !== 'all' && template.age_range !== avatarAgeFilter) return false;
    if (avatarEthnicityFilter !== 'all' && getEthnicityGroup(template.ethnicity) !== avatarEthnicityFilter) return false;
    return true;
  });
  const visibleTemplates = filteredTemplates.slice(0, visibleAvatarCount);
  const hiddenTemplateCount = Math.max(0, filteredTemplates.length - visibleTemplates.length);

  return (
    <TabContentWrapper>
      <TabBody>
        <div ref={stepTopRef} />
        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-medium">Step {state.currentStep} of {state.totalSteps}</span>
            {state.currentStep > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={state.isLoading || state.isGenerating}
                onClick={() => {
                  // One slip used to wipe the avatar, the tier and a typed script
                  const hasWork = !!localScriptText.trim() || !!state.voiceAudioUrl || !!state.uploadedAudioUrl;
                  if (hasWork && !window.confirm('Start over? This clears the avatar, the script and the voice.')) return;
                  resetWizard();
                }}
              >
                Start Over
              </Button>
            )}
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(state.currentStep / state.totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* ===== STEP 1: Avatar Selection ===== */}
        {state.currentStep === 1 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium mb-2 block">Choose Your Avatar</Label>

            {/* My Avatars Section */}
            {state.savedAvatars.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-medium">My Avatars</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {state.savedAvatars.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {state.savedAvatars.map((saved) => (
                    <Card
                      key={saved.id}
                      className={`p-1.5 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] group relative ${
                        !selectedTemplate && state.customAvatarUrl === saved.image_url
                          ? 'ring-2 ring-purple-500'
                          : 'bg-card hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        // Saved avatars already sit in our storage: no download and re-upload
                        setSelectedTemplate(null);
                        selectAvatarImageUrl(saved.image_url);
                      }}
                    >
                      <div className="relative aspect-[4/3] bg-muted rounded mb-1 flex items-center justify-center overflow-hidden">
                        <Image
                          src={saved.image_url}
                          alt={saved.name}
                          fill priority={false} quality={60}
                          sizes="(max-width: 768px) 33vw, 150px"
                          className="object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        {!selectedTemplate && state.customAvatarUrl === saved.image_url && (
                          <div className="absolute top-0.5 left-0.5 bg-purple-500 rounded-full p-0.5">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {/* Delete button on hover */}
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await deleteSavedAvatar(saved.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                      <p className="text-[11px] font-medium text-center truncate leading-tight">{saved.name}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Own photo first: close to half of all avatar videos use one */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">Use your own photo</span>
              </div>
              <p className="text-xs text-muted-foreground">A clear photo, face to the camera. JPG or PNG.</p>
              <UnifiedDragDrop
                fileType="avatar"
                selectedFile={state.customAvatarImage}
                onFileSelect={(file) => {
                  setSelectedTemplate(null);
                  handleAvatarSelection(null, file);
                }}
                disabled={state.isLoading}
                loading={state.isLoading && !!state.customAvatarImage}
                previewSize="small"
                title="Drop your photo or click to upload"
                description="Use your own photo as the avatar"
              />
            </div>

            {/* Create Custom Avatar with AI */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                onClick={() => setShowAvatarGen(!showAvatarGen)}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Make an avatar photo with AI ({AVATAR_GENERATION_CREDIT_COST} credits)
                </span>
                {showAvatarGen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAvatarGen && (
                <div className="p-3 pt-0 space-y-3">
                  {/* Style Presets */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Style</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { id: 'ugc_portrait', label: 'Everyday Photo', desc: 'Natural light, friendly look' },
                        { id: 'ugc_selfie', label: 'Selfie', desc: "Phone photo held at arm's length" },
                        { id: 'professional', label: 'Professional', desc: 'Studio headshot' },
                        { id: 'custom', label: 'Custom', desc: 'Only your description is used' },
                      ] as const).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`p-2 rounded-md text-left border transition-all text-xs ${
                            avatarGenPreset === preset.id
                              ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500'
                              : 'border-muted hover:border-muted-foreground/40'
                          }`}
                          onClick={() => setAvatarGenPreset(preset.id)}
                        >
                          <p className="font-medium">{preset.label}</p>
                          <p className="text-[10px] text-muted-foreground">{preset.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Describe Your Avatar</Label>
                    <Textarea
                      value={avatarGenPrompt}
                      onChange={(e) => setAvatarGenPrompt(e.target.value)}
                      placeholder="A 55 year old roofer in a grey work shirt, standing in front of a house"
                      className="min-h-[70px] resize-none text-sm"
                      disabled={isGeneratingAvatar}
                    />
                  </div>

                  {/* Optional Reference Image */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      Photo to guide the look (optional)
                    </Label>
                    {avatarGenRefImage ? (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-xs truncate flex-1">{avatarGenRefImage.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => { setAvatarGenRefImage(null); setAvatarGenRefUrl(null); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="block border border-dashed rounded-md p-3 text-center cursor-pointer hover:border-primary/50 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setAvatarGenRefImage(file);
                              setAvatarGenRefUrl(null);
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Upload a photo. The AI uses it as a guide for the new avatar.</p>
                      </label>
                    )}
                  </div>

                  {/* Generate Button */}
                  <div className="space-y-1.5">
                    <Button
                      onClick={handleGenerateAvatar}
                      disabled={!avatarGenPrompt.trim() || isGeneratingAvatar || (!creditsLoading && credits < AVATAR_GENERATION_CREDIT_COST)}
                      className="w-full"
                      size="sm"
                    >
                      {isGeneratingAvatar ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Avatar ({AVATAR_GENERATION_CREDIT_COST} credits)
                        </>
                      )}
                    </Button>
                    {!creditsLoading && credits < AVATAR_GENERATION_CREDIT_COST && (
                      <p className="text-xs text-destructive text-center">
                        Not enough credits. An avatar photo costs {AVATAR_GENERATION_CREDIT_COST} credits.
                      </p>
                    )}
                  </div>

                  {/* Generated Preview */}
                  {generatedAvatarUrl && (
                    <div className="space-y-2">
                      <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                        <Image
                          src={generatedAvatarUrl}
                          alt="Generated avatar"
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 400px"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleUseGeneratedAvatar}
                          className="flex-1"
                          size="sm"
                        >
                          Use This Avatar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowSaveInput(!showSaveInput);
                            if (!saveAvatarName) {
                              setSaveAvatarName(avatarGenPrompt.slice(0, 50).trim() || 'My Avatar');
                            }
                          }}
                          title="Save to My Avatars"
                        >
                          <Save className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadAvatar}
                          title="Download"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateAvatar}
                          disabled={isGeneratingAvatar}
                          title="Regenerate"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Save to My Avatars inline input */}
                      {showSaveInput && (
                        <div className="flex gap-2">
                          <Input
                            value={saveAvatarName}
                            onChange={(e) => setSaveAvatarName(e.target.value)}
                            placeholder="Avatar name"
                            className="text-sm h-8"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveAvatar()}
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveAvatar}
                            disabled={!saveAvatarName.trim() || isSavingAvatar}
                            className="h-8 px-3"
                          >
                            {isSavingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-0.5 pt-1">
              <span className="text-xs font-medium">Or pick an avatar from the library ({state.avatarTemplates.length})</span>
              <p className="text-xs text-muted-foreground">Click a photo, then press Continue below.</p>
            </div>

            {/* Avatar Filters */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {['all', 'female', 'male'].map((g) => (
                  <Button key={g} variant={avatarGenderFilter === g ? 'default' : 'outline'} size="sm" className="text-xs h-6 px-2"
                    onClick={() => { setAvatarGenderFilter(g); setVisibleAvatarCount(AVATAR_PAGE_SIZE); }}>
                    {g === 'all' ? 'All' : g.charAt(0).toUpperCase() + g.slice(1)}
                  </Button>
                ))}
                <span className="text-muted-foreground text-xs self-center px-1">|</span>
                {['all', 'young', 'middle_aged', 'senior'].map((a) => (
                  <Button key={a} variant={avatarAgeFilter === a ? 'default' : 'outline'} size="sm" className="text-xs h-6 px-2"
                    onClick={() => { setAvatarAgeFilter(a); setVisibleAvatarCount(AVATAR_PAGE_SIZE); }}>
                    {a === 'all' ? 'All ages' : a === 'young' ? 'Under 30' : a === 'middle_aged' ? '30 to 45' : '46 and over'}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {['all', 'black', 'latina/o', 'white', 'asian', 'middle eastern', 'south asian', 'mixed'].map((eth) => (
                  <Button key={eth} variant={avatarEthnicityFilter === eth ? 'default' : 'outline'} size="sm" className="text-xs h-6 px-2"
                    onClick={() => { setAvatarEthnicityFilter(eth); setVisibleAvatarCount(AVATAR_PAGE_SIZE); }}>
                    {eth === 'all' ? 'All' : eth.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {visibleTemplates.map((template: AvatarTemplate) => (
                <Card
                  key={template.id}
                  className={`p-1.5 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
                    selectedTemplate?.id === template.id ? 'ring-2 ring-blue-500' : 'bg-card hover:bg-muted/50'
                  }`}
                  onClick={() => {
                    setSelectedTemplate(template);
                    handleAvatarSelection(template);
                  }}
                  onMouseEnter={() => template.preview_video_url && handleAvatarHover(template.id, true)}
                  onMouseLeave={() => template.preview_video_url && handleAvatarHover(template.id, false)}
                  title={template.description || undefined}
                >
                  <div className="relative aspect-[4/3] bg-muted rounded mb-1 flex items-center justify-center overflow-hidden">
                    {template.preview_video_url && (
                      <video
                        ref={(el) => { videoRefs.current[template.id] = el; }}
                        src={template.preview_video_url}
                        muted loop playsInline preload="none"
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                          hoveredTemplateId === template.id ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    )}
                    {template.thumbnail_url ? (
                      <Image
                        src={template.thumbnail_url}
                        alt={template.name}
                        fill priority={false} quality={60}
                        sizes="(max-width: 768px) 33vw, 150px"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                        className={`object-cover transition-opacity duration-300 ${
                          hoveredTemplateId === template.id && template.preview_video_url ? 'opacity-0' : 'opacity-100'
                        }`}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground" />
                    )}
                    {selectedTemplate?.id === template.id && (
                      <div className="absolute top-0.5 left-0.5 bg-blue-500 rounded-full p-0.5">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {template.preview_video_url && hoveredTemplateId !== template.id && (
                      <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                        <Play className="w-2.5 h-2.5 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-center truncate leading-tight">{template.name}</p>
                </Card>
              ))}
            </div>

            {hiddenTemplateCount > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setVisibleAvatarCount((count) => count + AVATAR_PAGE_SIZE)}
              >
                Show more avatars ({hiddenTemplateCount} more)
              </Button>
            )}

            {state.avatarTemplates.length > 0 && filteredTemplates.length === 0 && (
              <div className="text-center space-y-2 py-4">
                <p className="text-sm text-muted-foreground">No avatars match these filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAvatarGenderFilter('all');
                    setAvatarAgeFilter('all');
                    setAvatarEthnicityFilter('all');
                    setVisibleAvatarCount(AVATAR_PAGE_SIZE);
                  }}
                >
                  Show all avatars
                </Button>
              </div>
            )}

          </div>
        )}

        {/* ===== STEP 2: Script & Voice ===== */}
        {state.currentStep === 2 && (
          <div className="space-y-4">
            {/* Quality: Standard keeps today's voice flow; Fast / Ultra let the engine speak the script */}
            <div className="space-y-2">
              <Label>Quality</Label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-muted/50 rounded-lg">
                {([
                  { id: 'standard' as AvatarQualityTier, label: 'Basic', icon: Mic, lines: ['Pick a voice', creditsPerSecondText(AVATAR_BASIC_CREDITS_PER_SECOND)] },
                  { id: 'fast' as AvatarQualityTier, label: 'Fast', icon: Zap, lines: ['Avatar speaks', creditsPerSecondText(AVATAR_TIER_CONFIG.fast.creditsPerSecond)] },
                  { id: 'ultra' as AvatarQualityTier, label: 'Ultra', icon: Gem, lines: ['Best lip sync', creditsPerSecondText(AVATAR_TIER_CONFIG.ultra.creditsPerSecond)] },
                ]).map((option) => {
                  const Icon = option.icon;
                  const active = state.qualityTier === option.id;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      variant={active ? 'default' : 'ghost'}
                      className="flex flex-col h-auto py-2 gap-0.5"
                      onClick={() => setQualityTier(option.id)}
                      disabled={state.isLoading || state.isGenerating}
                    >
                      <span className="flex items-center gap-1.5">
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{option.label}</span>
                      </span>
                      {option.lines.map((line) => (
                        <span key={line} className="text-[10px] opacity-70 whitespace-normal leading-tight">{line}</span>
                      ))}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground p-2 rounded bg-muted/30">
                {tierExplanation(state.qualityTier)}
              </p>
            </div>

            {scriptTier && fit && (
              <div className="space-y-2">
                <Label>Script</Label>
                <Textarea
                  value={localScriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="Type what the avatar should say..."
                  className="min-h-[140px] resize-none"
                  disabled={state.isLoading}
                />
                <div
                  className={`flex items-center justify-between text-xs ${
                    fit.words === 0
                      ? 'text-muted-foreground'
                      : fit.fits
                        ? fit.words > fit.maxWords * 0.85
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                        : 'text-destructive'
                  }`}
                >
                  <span>
                    {fit.words}/{fit.maxWords} words{fit.clipSeconds ? ` · ${fit.clipSeconds} second video` : ''}
                  </span>
                  <span>{fit.fits ? `${fit.credits} credits` : ''}</span>
                </div>
                {!fit.fits && fit.words > 0 && (
                  <p className="text-xs text-destructive">{tooLongText(scriptTier, fit.overBy, fit.words)}</p>
                )}
                {fit.fits && fit.roomWords > 0 && (scriptTier === 'fast' || fit.clipSeconds === AVATAR_TIER_CONFIG[scriptTier].allowedDurations[0]) && (
                  <p className="text-xs text-muted-foreground">
                    {fit.clipSeconds === AVATAR_TIER_CONFIG[scriptTier].allowedDurations[0]
                      ? `The shortest ${tierLabel(scriptTier)} video is ${fit.clipSeconds} seconds. Room for ${moreWordsText(fit.roomWords)} at the same price.`
                      : `Room for ${moreWordsText(fit.roomWords)} in this ${fit.clipSeconds} second video at the same price.`}
                  </p>
                )}
              </div>
            )}

            {!scriptTier && (
            <>
            {/* Audio Input Mode Toggle */}
            <div className="space-y-2">
              <Label>Where does the voice come from?</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={state.audioInputMode === 'tts' ? 'default' : 'outline'}
                  className="w-full h-auto min-h-9 py-2 whitespace-normal"
                  onClick={() => setAudioInputMode('tts')}
                  disabled={state.isLoading || state.isGenerating}
                >
                  <Mic className="w-4 h-4 mr-2 shrink-0" />
                  Pick a voice
                </Button>
                <Button
                  variant={state.audioInputMode === 'upload' ? 'default' : 'outline'}
                  className="w-full h-auto min-h-9 py-2 whitespace-normal"
                  onClick={() => setAudioInputMode('upload')}
                  disabled={state.isLoading || state.isGenerating}
                >
                  <Upload className="w-4 h-4 mr-2 shrink-0" />
                  Upload my recording
                </Button>
              </div>
            </div>
            </>
            )}

            {/* TTS Mode */}
            {!scriptTier && state.audioInputMode === 'tts' && (
              <>
                <div className="space-y-2">
                  <Label>Script</Label>
                  <Textarea
                    value={localScriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder="Type what the avatar should say..."
                    className="min-h-[140px] resize-none"
                    disabled={state.isLoading}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{localScriptText.trim().split(/\s+/).filter(Boolean).length} words</span>
                    <span>about {Math.ceil(localScriptText.trim().split(/\s+/).filter(Boolean).length / AVATAR_BASIC_WORDS_PER_SECOND)} seconds</span>
                  </div>
                  {localScriptText.trim().split(/\s+/).filter(Boolean).length > 110 && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3 h-3" />
                      <span className="text-xs">Long script. The voice may run past 60 seconds. Shorten the text or raise the speed.</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Voice</Label>
                    <div className="flex items-center gap-2">
                      {/* Gender Filter */}
                      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                        {(['all', 'male', 'female'] as const).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setVoiceGenderFilter(filter)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                              voiceGenderFilter === filter
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {filter === 'all'
                              ? `All (${MINIMAX_VOICE_OPTIONS.length})`
                              : `${filter.charAt(0).toUpperCase() + filter.slice(1)} (${MINIMAX_VOICE_OPTIONS.filter(v => v.gender === filter).length})`}
                          </button>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-primary"
                        onClick={() => setShowCloneModal(true)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Clone
                      </Button>
                    </div>
                  </div>

                  {/* Cloned Voices */}
                  {state.clonedVoices.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">My Voices</p>
                      <div className="grid grid-cols-2 gap-2">
                        {state.clonedVoices.map((voice) => (
                          <div
                            key={voice.minimax_voice_id}
                            className={`relative p-3 rounded-lg border-2 text-left transition-all hover:shadow-md cursor-pointer ${
                              selectedVoice === voice.minimax_voice_id
                                ? 'border-purple-500 bg-purple-500/5 shadow-sm'
                                : 'border-border hover:border-purple-500/50'
                            }`}
                            onClick={() => setSelectedVoice(voice.minimax_voice_id)}
                          >
                            {voice.preview_url && voice.preview_url.startsWith('http') && (
                              <button
                                className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVoicePlayback(voice.minimax_voice_id, voice.preview_url!);
                                }}
                              >
                                {playingVoiceId === voice.minimax_voice_id ? (
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
                    </div>
                  )}

                  {/* System Voices */}
                  {state.clonedVoices.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">System Voices</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {MINIMAX_VOICE_OPTIONS
                      .map((voice, originalIndex) => ({ voice, originalIndex }))
                      .filter(({ voice }) => voiceGenderFilter === 'all' || voice.gender === voiceGenderFilter)
                      .map(({ voice, originalIndex }) => (
                        <div
                          key={voice.id}
                          className={`relative p-3 rounded-lg border-2 text-left transition-all hover:shadow-md cursor-pointer ${
                            selectedVoice === voice.id
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedVoice(voice.id)}
                        >
                          <button
                            className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVoicePlayback(voice.id, voice.preview_url);
                            }}
                          >
                            {playingVoiceId === voice.id ? (
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
                </div>

                {/* Voice Settings */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Voice Settings</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Speed */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Speed: {voiceSettings.speed}x</Label>
                      <input
                        type="range" min={0.5} max={2.0} step={0.1}
                        value={voiceSettings.speed}
                        onChange={(e) => setVoiceSettings(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                        disabled={state.isGenerating}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0.5x</span><span>2.0x</span>
                      </div>
                    </div>
                    {/* Pitch */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Pitch: {voiceSettings.pitch > 0 ? '+' : ''}{voiceSettings.pitch}</Label>
                      <input
                        type="range" min={-12} max={12} step={1}
                        value={voiceSettings.pitch}
                        onChange={(e) => setVoiceSettings(prev => ({ ...prev, pitch: parseInt(e.target.value) }))}
                        disabled={state.isGenerating}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>-12</span><span>+12</span>
                      </div>
                    </div>
                    {/* Volume */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Volume: {voiceSettings.volume}</Label>
                      <input
                        type="range" min={0} max={10} step={1}
                        value={voiceSettings.volume}
                        onChange={(e) => setVoiceSettings(prev => ({ ...prev, volume: parseInt(e.target.value) }))}
                        disabled={state.isGenerating}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0</span><span>10</span>
                      </div>
                    </div>
                    {/* Emotion */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Emotion</Label>
                      <Select
                        value={voiceSettings.emotion}
                        onValueChange={(emotion: MinimaxEmotion) => setVoiceSettings(prev => ({ ...prev, emotion }))}
                        disabled={state.isGenerating}
                      >
                        <SelectTrigger className="h-8 text-xs">
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
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Upload Mode */}
            {!scriptTier && state.audioInputMode === 'upload' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Upload Audio File</Label>
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => audioInputRef.current?.click()}
                  >
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        // Browsers report audio types inconsistently (iPhone Voice Memos arrive as
                        // audio/mp4, some WAVs as audio/x-wav, some files with no type at all)
                        const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/m4a', 'audio/x-m4a', 'audio/mp4'];
                        const ext = (file.name.split('.').pop() || '').toLowerCase();
                        // The upload route goes by the file extension, so a type-only match
                        // would pass here and fail at Generate
                        if (!['mp3', 'wav', 'm4a'].includes(ext) || (file.type && !validTypes.includes(file.type) && !file.type.startsWith('audio/'))) {
                          toast.error('Please upload MP3, WAV, or M4A audio files only');
                          return;
                        }
                        if (file.size > 25 * 1024 * 1024) {
                          toast.error('This audio file is over 25 MB. Upload a shorter or smaller file.');
                          return;
                        }
                        // The object link is for the two players on this page only. The file
                        // itself is uploaded to storage when the video is generated.
                        const url = URL.createObjectURL(file);
                        const audio = new Audio();
                        audio.preload = 'metadata';
                        audio.addEventListener('loadedmetadata', () => {
                          if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
                            URL.revokeObjectURL(url);
                            toast.error('The length of this audio file could not be read. Try an MP3.');
                            return;
                          }
                          if (audio.duration > MAX_AUDIO_DURATION_SECONDS) {
                            URL.revokeObjectURL(url);
                            toast.error(`Audio must be ${MAX_AUDIO_DURATION_SECONDS} seconds or less.`);
                            return;
                          }
                          setUploadedAudio(url, file, audio.duration);
                          toast.success(`Audio added: ${Math.ceil(audio.duration)} seconds`);
                        });
                        audio.addEventListener('error', () => {
                          URL.revokeObjectURL(url);
                          toast.error('This audio file could not be read. Try an MP3.');
                        });
                        audio.src = url;
                        audio.load();
                        // Let the same file be picked again after an error
                        e.target.value = '';
                      }}
                    />
                    {state.uploadedAudioFile ? (
                      <div className="space-y-2">
                        <Mic className="w-8 h-8 mx-auto text-primary" />
                        <p className="text-sm font-medium">{state.uploadedAudioFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Duration: {Math.ceil(state.audioDurationSeconds)} seconds
                        </p>
                        <audio
                          key={state.uploadedAudioUrl || 'none'}
                          controls
                          className="w-full mt-2"
                          src={state.uploadedAudioUrl || undefined}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                        <p className="text-sm font-medium">Click to upload audio</p>
                        <p className="text-xs text-muted-foreground">MP3, WAV, or M4A • Max 60 seconds</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 3: Preview & Generate ===== */}
        {state.currentStep === 3 && (
          <div className="space-y-4">
            {scriptTier && fit && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Script</Label>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => goToStep(2)} disabled={state.isGenerating}>
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Edit Script
                  </Button>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm">{localScriptText}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {fit.fits
                      ? `${fit.words} words · ${fit.clipSeconds} second ${tierLabel(scriptTier)} video · the voice is picked for you`
                      : tooLongText(scriptTier, fit.overBy, fit.words)}
                  </p>
                </div>
              </div>
            )}

            {/* Voice Preview (Standard) */}
            {!scriptTier && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Voice Preview</Label>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearVoice} disabled={state.isGenerating}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Change Voice
                </Button>
              </div>

              {state.voiceAudioUrl && (
                <Card className="p-4">
                  <audio controls className="w-full" src={state.voiceAudioUrl} />
                  <p className="text-xs text-muted-foreground mt-2">
                    Length: {Math.ceil(state.audioDurationSeconds)} seconds
                  </p>
                </Card>
              )}

              {state.uploadedAudioUrl && !state.voiceAudioUrl && (
                <Card className="p-4">
                  <audio controls className="w-full" src={state.uploadedAudioUrl} />
                  <p className="text-xs text-muted-foreground mt-2">
                    Your recording · {Math.ceil(state.audioDurationSeconds)} seconds
                  </p>
                </Card>
              )}

              {/* Duration exceeded warning */}
              {state.audioDurationSeconds > MAX_AUDIO_DURATION_SECONDS && (
                <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">
                      The audio is too long ({Math.ceil(state.audioDurationSeconds)} seconds)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Maximum duration is {MAX_AUDIO_DURATION_SECONDS} seconds. Go back to shorten your script or increase the voice speed.
                    </p>
                    <Button variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={clearVoice}>
                      <ArrowLeft className="w-3 h-3 mr-1" />
                      Go Back & Adjust
                    </Button>
                  </div>
                </div>
              )}

              {localScriptText.trim() && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Script</p>
                  <p className="text-sm">{localScriptText}</p>
                </div>
              )}
            </div>
            )}

            {/* Video Settings */}
            <div className="space-y-3">
              <Label>Video Settings</Label>

              {scriptTier && !AVATAR_TIER_CONFIG[scriptTier].aspectFromResolution ? (
                <p className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  {tierLabel(scriptTier)} keeps the shape of your avatar photo. Library avatars are wide. For a tall video, upload your own tall photo in step 1.
                </p>
              ) : (
              <div className="grid grid-cols-2 gap-2">
                <Card
                  className={`p-3 cursor-pointer transition-all duration-200 ${state.isGenerating ? 'opacity-60 pointer-events-none' : ''} ${
                    state.selectedResolution === 'landscape' ? 'border-primary bg-primary/10' : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                  }`}
                  onClick={() => !state.isGenerating && setSelectedResolution('landscape')}
                >
                  <div className="flex items-center gap-2">
                    <Monitor className={`w-4 h-4 ${state.selectedResolution === 'landscape' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className={`text-xs font-medium ${state.selectedResolution === 'landscape' ? 'text-primary' : 'text-foreground'}`}>Landscape</p>
                      <p className="text-xs text-muted-foreground">For YouTube and websites</p>
                    </div>
                  </div>
                </Card>
                <Card
                  className={`p-3 cursor-pointer transition-all duration-200 ${state.isGenerating ? 'opacity-60 pointer-events-none' : ''} ${
                    state.selectedResolution === 'portrait' ? 'border-primary bg-primary/10' : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                  }`}
                  onClick={() => !state.isGenerating && setSelectedResolution('portrait')}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className={`w-4 h-4 ${state.selectedResolution === 'portrait' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className={`text-xs font-medium ${state.selectedResolution === 'portrait' ? 'text-primary' : 'text-foreground'}`}>Portrait</p>
                      <p className="text-xs text-muted-foreground">For Reels, TikTok, Shorts</p>
                    </div>
                  </div>
                </Card>
              </div>
              )}

              {/* Action Prompt */}
              <div className="space-y-2">
                <Label className="text-xs">How should the avatar move? (optional)</Label>
                <Textarea
                  value={localActionPrompt}
                  onChange={(e) => setActionPrompt(e.target.value)}
                  placeholder="Example: smiles warmly and nods while talking"
                  maxLength={300}
                  className="min-h-[50px] resize-none text-sm"
                  disabled={state.isLoading || state.isGenerating}
                />
                <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                  <span>Leave this empty and the avatar simply talks to the camera.</span>
                  <span className={`shrink-0 tabular-nums ${localActionPrompt.length >= 300 ? 'text-amber-600 dark:text-amber-400' : ''}`}>{localActionPrompt.length}/300</span>
                </div>
              </div>
            </div>

            {/* Credit Summary */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
              <span>
                {scriptTier && fit?.clipSeconds
                  ? `${fit.clipSeconds} seconds × ${creditsPerSecondText(AVATAR_TIER_CONFIG[scriptTier].creditsPerSecond)}`
                  : `${estimatedCredits} seconds × ${creditsPerSecondText(AVATAR_BASIC_CREDITS_PER_SECOND)}`}
              </span>
              <span className="font-medium text-primary">{estimatedCredits} credits</span>
            </div>
          </div>
        )}
      </TabBody>

      {/* Footer: pinned to the bottom of the screen in the one column layout */}
      <TabFooter className="max-md:sticky max-md:bottom-0 max-md:z-10 max-md:bg-background max-md:pb-3">
        {(state.currentStep === 3 || (state.currentStep === 2 && !!scriptTier)) && !creditsLoading && !state.isGenerating && estimatedCredits > 0 && credits < estimatedCredits && (
          <InsufficientCreditsNotice needed={estimatedCredits} available={credits} className="mb-2" />
        )}
        <div className="flex gap-2">
          {state.currentStep > 1 && (
            <Button
              variant="outline"
              onClick={() => goToStep(state.currentStep - 1)}
              disabled={state.isLoading || state.isGenerating}
              className="h-12 px-4 shrink-0"
              size="lg"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}

          <Button
            onClick={handleStepAction}
            disabled={!canProceed() || state.isLoading || state.isGenerating}
            className={`${state.currentStep === 1 ? 'w-full' : 'flex-1 min-w-0'} h-auto min-h-12 py-2 whitespace-normal font-medium`}
            size="lg"
          >
            {getButtonIcon()}
            {getButtonLabel()}
            {showNextArrow && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
        {state.currentStep === 2 && !scriptTier && state.audioInputMode === 'tts' && !!localScriptText.trim() && !selectedVoice && (
          <p className="text-xs text-muted-foreground text-center mt-2">Pick a voice to continue</p>
        )}
        {state.currentStep === 3 && state.isGenerating && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            You can keep working. The finished video also lands in History. Usually ready in {waitLabelFor(state.qualityTier)}.
          </p>
        )}
      </TabFooter>

      {/* Clone Voice Modal */}
      <Dialog open={showCloneModal} onOpenChange={setShowCloneModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clone a Voice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Audio Upload */}
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center transition-colors border-muted-foreground/25 hover:border-primary/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) validateAndSetCloneFile(e.dataTransfer.files[0]);
              }}
            >
              {cloneFile ? (
                <div className="space-y-2">
                  <Mic2 className="w-8 h-8 mx-auto text-primary" />
                  <p className="text-sm font-medium">{cloneFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(cloneFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <Button variant="outline" size="sm" onClick={() => setCloneFile(null)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer space-y-2 block">
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) validateAndSetCloneFile(e.target.files[0]);
                    }}
                  />
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">Drop audio or click to upload</p>
                  <p className="text-xs text-muted-foreground">MP3, WAV or M4A · 10 seconds to 5 minutes · up to 20 MB</p>
                </label>
              )}
            </div>

            {/* Voice Name */}
            <div className="space-y-1">
              <Label>Voice Name</Label>
              <Input
                value={cloneVoiceName}
                onChange={(e) => setCloneVoiceName(e.target.value)}
                placeholder="e.g. My Custom Voice"
                maxLength={50}
                disabled={state.isCloning}
              />
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="clone-nr" checked={cloneNoiseReduction}
                  onCheckedChange={(checked) => setCloneNoiseReduction(checked as boolean)} disabled={state.isCloning} />
                <label htmlFor="clone-nr" className="text-sm cursor-pointer">Noise reduction</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="clone-vn" checked={cloneVolumeNorm}
                  onCheckedChange={(checked) => setCloneVolumeNorm(checked as boolean)} disabled={state.isCloning} />
                <label htmlFor="clone-vn" className="text-sm cursor-pointer">Volume normalization</label>
              </div>
            </div>

            {/* Clone Button */}
            <Button
              onClick={handleCloneSubmit}
              disabled={!cloneFile || !cloneVoiceName.trim() || state.isCloning || credits < 50}
              className="w-full"
            >
              {state.isCloning ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Cloning Voice...
                </>
              ) : (
                <>
                  <Mic2 className="w-4 h-4 mr-2" />
                  Clone Voice (50 credits)
                </>
              )}
            </Button>
            {credits < 50 && cloneFile && cloneVoiceName.trim() && (
              <p className="text-xs text-destructive text-center">
                Not enough credits. A cloned voice costs 50 credits.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TabContentWrapper>
  );
}
