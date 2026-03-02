export type ChatterboxPresetVoice =
  | 'Aurora'
  | 'Blade'
  | 'Britney'
  | 'Carl'
  | 'Cliff'
  | 'Richard'
  | 'Rico'
  | 'Siobhan'
  | 'Vicky';

export const CHATTERBOX_PRESET_VOICES: { id: ChatterboxPresetVoice; name: string; gender: string }[] = [
  { id: 'Aurora', name: 'Aurora', gender: 'female' },
  { id: 'Britney', name: 'Britney', gender: 'female' },
  { id: 'Siobhan', name: 'Siobhan', gender: 'female' },
  { id: 'Vicky', name: 'Vicky', gender: 'female' },
  { id: 'Blade', name: 'Blade', gender: 'male' },
  { id: 'Carl', name: 'Carl', gender: 'male' },
  { id: 'Cliff', name: 'Cliff', gender: 'male' },
  { id: 'Richard', name: 'Richard', gender: 'male' },
  { id: 'Rico', name: 'Rico', gender: 'male' },
];
