-- Voice Changer history + Agent Clone "switch voice"
--
-- 1) generated_voices: the Voice Changer (ChatterboxHD) writes its history
--    here, but two legacy CHECK constraints only admit MiniMax-era values
--    (voice_provider in minimax/openai/elevenlabs, audio_format = mp3), so no
--    voice-changer run has ever produced a history row. Widen both.
alter table public.generated_voices
  drop constraint if exists generated_voices_voice_provider_check;
alter table public.generated_voices
  add constraint generated_voices_voice_provider_check
  check (voice_provider in ('minimax', 'openai', 'elevenlabs', 'chatterbox'));

alter table public.generated_voices
  drop constraint if exists generated_voices_audio_format_check;
alter table public.generated_voices
  add constraint generated_voices_audio_format_check
  check (audio_format in ('mp3', 'wav', 'm4a', 'mp4'));

-- 2) agent_clone_generations: keep the original clip in video_url and the
--    re-voiced clip next to it, with the settings that produced it.
alter table public.agent_clone_generations
  add column if not exists voice_video_url text,
  add column if not exists voice_swap jsonb;

comment on column public.agent_clone_generations.voice_video_url is
  'Same clip as video_url with the speech re-voiced (ChatterboxHD) to the user''s uploaded sample';
comment on column public.agent_clone_generations.voice_swap is
  '{ target_voice_url, high_quality, batch_id, converted_at, credits }';
