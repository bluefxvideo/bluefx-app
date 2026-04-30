'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { ZillowInput } from '../components/zillow-input';
import { PhotoGrid } from '../components/photo-grid';
import { MusicSelector } from '../components/music-selector';
import {
  Loader2, Scan, Film, FileText, RefreshCw,
  Monitor, Smartphone, Type, Mic, Volume2, Play, Square, AlertTriangle,
  FolderPlus, Pencil, History as HistoryIcon, Check, X,
} from 'lucide-react';
import type { ReelEstateProject, TargetDuration } from '@/types/reelestate';
import { TARGET_DURATIONS } from '@/types/reelestate';
import { useRef, useState } from 'react';
import { NewProjectModal } from '../components/new-project-modal';

// Valid Minimax voices with preview URLs matching shared/voice-constants.ts
const VOICE_OPTIONS = [
  { id: 'Friendly_Person', label: 'Alex (Friendly)', preview: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/friendly_person.mp3' },
  { id: 'Deep_Voice_Man', label: 'Marcus (Deep)', preview: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/deep_voice_man.mp3' },
  { id: 'Calm_Woman', label: 'Serena (Calm)', preview: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/calm_woman.mp3' },
  { id: 'Inspirational_girl', label: 'Maya (Inspiring)', preview: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/inspirational_girl.mp3' },
  { id: 'Wise_Woman', label: 'Victoria (Wise)', preview: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/wise_woman.mp3' },
  { id: 'Patient_Man', label: 'Thomas (Patient)', preview: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/patient_man.mp3' },
  { id: 'Casual_Guy', label: 'Jake (Casual)', preview: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/casual_guy.mp3' },
  { id: 'Lovely_Girl', label: 'Sophie (Lovely)', preview: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/voices/minimax/lovely_girl.mp3' },
];

function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface VideoMakerTabProps {
  project: ReelEstateProject;
  credits: number;
  isLoadingCredits?: boolean;
  isWorking: boolean;
  // Step 1: Photos
  onStartProject: (input: {
    zillow_url?: string;
    manual_photos?: string[];
    manual_listing_data?: Partial<import('@/types/reelestate').ZillowListingData>;
  }) => void;
  onAddPhotos: (urls: string[]) => void;
  onAnalyzePhotos: () => void;
  onSetSelectedIndices: (indices: number[]) => void;
  onCleanupPhoto?: (index: number) => void;
  cleaningIndices?: number[];
  // Step 2: Style
  onSetAspectRatio: (ratio: '16:9' | '9:16') => void;
  onSetTargetDuration: (duration: TargetDuration) => void;
  onSetIntroText: (text: string | null) => void;
  // Voiceover
  onSetVoiceoverEnabled: (enabled: boolean) => void;
  onSetVoiceId: (voiceId: string) => void;
  // Script & Voiceover
  onGenerateScript: () => void;
  onGenerateVoiceover: () => void;
  onRegenerateScript: () => void;
  onRegenerateVoiceover: () => void;
  onUpdateScriptSegment: (index: number, voiceover: string) => void;
  // Step 3: Music
  onSetMusicTrack: (trackId: string | null, url: string | null) => void;
  onSetMusicVolume: (volume: number) => void;
  // Open editor
  onOpenInEditor: () => void;
  onRenderVideo: (animate?: boolean) => void;
  // Project lifecycle
  onCreateProject: (name: string) => Promise<string | null | undefined>;
  onRenameProject: (name: string) => void;
  onGoToHistory: () => void;
}

export function VideoMakerTab({
  project,
  credits,
  isLoadingCredits,
  isWorking,
  onStartProject,
  onAddPhotos,
  onAnalyzePhotos,
  onSetSelectedIndices,
  onCleanupPhoto,
  cleaningIndices,
  onSetAspectRatio,
  onSetTargetDuration,
  onSetIntroText,
  onSetVoiceoverEnabled,
  onSetVoiceId,
  onGenerateScript,
  onGenerateVoiceover,
  onRegenerateScript,
  onRegenerateVoiceover,
  onUpdateScriptSegment,
  onSetMusicTrack,
  onSetMusicVolume,
  onOpenInEditor,
  onRenderVideo,
  onCreateProject,
  onRenameProject,
  onGoToHistory,
}: VideoMakerTabProps) {
  const hasPhotos = project.photos.length > 0;
  const hasAnalyses = project.analyses.length > 0;
  const hasSelection = project.selectedIndices.length > 0;
  const hasProject = !!project.id;

  const isPreparing = ['scripting', 'generating_voiceover'].includes(project.status);

  const [newProjectOpen, setNewProjectOpen] = useState(false);

  // ─── Empty state — no project loaded yet ──────
  if (!hasProject) {
    return (
      <TabContentWrapper>
        <TabBody>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FolderPlus className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Start a new project</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Create a project first, then add photos from Zillow or upload your own.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button onClick={() => setNewProjectOpen(true)} size="lg" className="w-full gap-2">
                <FolderPlus className="w-4 h-4" />
                New Project
              </Button>
              <Button onClick={onGoToHistory} variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
                <HistoryIcon className="w-3.5 h-3.5" />
                Continue from History
              </Button>
            </div>
          </div>
        </TabBody>
        <NewProjectModal open={newProjectOpen} onOpenChange={setNewProjectOpen} onCreate={onCreateProject} />
      </TabContentWrapper>
    );
  }

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Project header — always visible when project exists */}
        <div className="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-border/40">
          <ProjectNameEditor
            name={project.name || 'Untitled Project'}
            onRename={onRenameProject}
            disabled={isWorking}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs flex-shrink-0"
            onClick={() => setNewProjectOpen(true)}
            disabled={isWorking}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New
          </Button>
        </div>

        <NewProjectModal open={newProjectOpen} onOpenChange={setNewProjectOpen} onCreate={onCreateProject} />

        {/* Step 1: Photos */}
        <StandardStep
          stepNumber={1}
          title="Property Photos"
          description="Import from Zillow / Realtor.com or upload photos"
        >
          <ZillowInput
            onSubmitUrl={(url) => onStartProject({ zillow_url: url })}
            onUploadPhotos={(urls) => {
              // If a project already exists, append photos; else create a new one
              if (project.id) onAddPhotos(urls);
              else onStartProject({ manual_photos: urls });
            }}
            isLoading={project.status === 'scraping'}
            disabled={isWorking}
            hasExistingPhotos={project.photos.length > 0}
          />

          {project.listing && (
            <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="font-medium text-sm">{project.listing.address}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {project.listing.beds} bed · {project.listing.baths} bath · {project.listing.sqft?.toLocaleString()} sqft
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {project.photos.length} photos loaded
              </p>
            </div>
          )}

          {hasPhotos && !hasAnalyses && (
            <Button
              onClick={onAnalyzePhotos}
              disabled={isWorking}
              className="w-full mt-3"
            >
              {project.status === 'analyzing' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing {project.photos.length} photos...
                </>
              ) : (
                <>
                  <Scan className="w-4 h-4 mr-2" />
                  Analyze Photos ({Math.ceil(project.photos.length / 5)} credits)
                </>
              )}
            </Button>
          )}

          {hasAnalyses && (
            <PhotoGrid
              photos={project.photos}
              analyses={project.analyses}
              selectedIndices={project.selectedIndices}
              onSelectionChange={onSetSelectedIndices}
              onCleanupPhoto={onCleanupPhoto}
              cleaningIndices={cleaningIndices}
              disabled={isWorking}
            />
          )}
        </StandardStep>

        {/* Step 2: Style & Settings */}
        {hasAnalyses && hasSelection && (
          <StandardStep
            stepNumber={2}
            title="Style & Settings"
            description="Configure your video"
          >
            <div className="space-y-4">
              {/* Aspect ratio */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Orientation</label>
                <div className="flex gap-2">
                  <Button
                    variant={project.aspectRatio === '16:9' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => onSetAspectRatio('16:9')}
                    disabled={isWorking}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Landscape
                  </Button>
                  <Button
                    variant={project.aspectRatio === '9:16' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => onSetAspectRatio('9:16')}
                    disabled={isWorking}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Portrait
                  </Button>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Duration</label>
                <Select
                  value={String(project.targetDuration)}
                  onValueChange={(v) => onSetTargetDuration(Number(v) as TargetDuration)}
                  disabled={isWorking}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_DURATIONS.map(d => (
                      <SelectItem key={d} value={String(d)}>{d} seconds</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Intro text */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Type className="w-3 h-3" />
                  Intro Text
                </label>
                <Input
                  value={project.introText || ''}
                  onChange={(e) => onSetIntroText(e.target.value || null)}
                  placeholder="e.g. 1234 Main Street"
                  disabled={isWorking}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground mt-1">Displayed on the first photo</p>
              </div>

              {/* Voiceover toggle */}
              <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    AI Voiceover
                  </label>
                  <Switch
                    checked={project.voiceoverEnabled}
                    onCheckedChange={onSetVoiceoverEnabled}
                    disabled={isWorking}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {project.voiceoverEnabled
                    ? 'AI writes a script and narrates your video (3 credits)'
                    : 'Music-only mode — no narration'}
                </p>

                {project.voiceoverEnabled && (
                  <>
                    {/* Voice selector with preview */}
                    <VoicePickerWithPreview
                      voiceId={project.voiceId}
                      onVoiceChange={onSetVoiceId}
                      disabled={isWorking}
                    />

                    {/* Generate Script button */}
                    {!project.script && (
                      <Button
                        onClick={onGenerateScript}
                        disabled={isWorking}
                        variant="outline"
                        className="w-full"
                        size="sm"
                      >
                        {project.status === 'scripting' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                            Generating script...
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5 mr-2" />
                            Generate Script (1 credit)
                          </>
                        )}
                      </Button>
                    )}

                    {/* Script segments — editable */}
                    {project.script && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium">Script ({project.script.segments.length} segments · {project.script.total_duration_seconds}s)</span>
                            {project.scriptGeneratedAt && (
                              <span className="text-[10px] text-muted-foreground">Generated {formatTimeAgo(project.scriptGeneratedAt)}</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] gap-1 px-2"
                            onClick={onRegenerateScript}
                            disabled={isWorking}
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            Regenerate (1 cr)
                          </Button>
                        </div>

                        {/* Script stale warning */}
                        {project.scriptStale && (
                          <div className="flex items-start gap-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-400">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span>Photos or duration changed — regenerate to refresh the script.</span>
                          </div>
                        )}

                        <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1">
                          {project.script.segments.map((segment) => (
                            <div key={segment.index} className="flex gap-2 p-1.5 rounded bg-background/50 border border-border/30">
                              {project.photos[segment.image_index] && (
                                <img
                                  src={project.photos[segment.image_index]}
                                  alt={`Photo ${segment.image_index + 1}`}
                                  className="w-12 h-8 rounded object-cover flex-shrink-0"
                                />
                              )}
                              <textarea
                                className="text-[11px] leading-relaxed w-full bg-transparent resize-none border-0 p-0 focus:outline-none focus:ring-0 min-h-[2rem]"
                                value={segment.voiceover}
                                onChange={(e) => onUpdateScriptSegment(segment.index, e.target.value)}
                                rows={2}
                                disabled={isWorking}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Generate Voiceover button */}
                    {project.script && !project.voiceover && (
                      <Button
                        onClick={onGenerateVoiceover}
                        disabled={isWorking}
                        variant="outline"
                        className="w-full"
                        size="sm"
                      >
                        {project.status === 'generating_voiceover' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                            Generating voiceover...
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 mr-2" />
                            Generate Voiceover (2 credits)
                          </>
                        )}
                      </Button>
                    )}

                    {/* Voiceover audio player */}
                    {project.voiceover && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-1.5 text-xs ${project.voiceoverStale ? 'text-amber-400' : 'text-emerald-400'}`}>
                            <div className={`w-2 h-2 rounded-full ${project.voiceoverStale ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                            {project.voiceoverStale ? 'Voiceover out of date' : 'Voiceover ready'}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] gap-1 px-2"
                            onClick={onRegenerateVoiceover}
                            disabled={isWorking}
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            Regenerate (2 cr)
                          </Button>
                        </div>

                        {/* Voiceover stale warning */}
                        {project.voiceoverStale && (
                          <div className="flex items-start gap-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-400">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span>Script text or voice changed — regenerate voiceover to update the audio.</span>
                          </div>
                        )}

                        <audio
                          key={project.voiceover.url}
                          controls
                          src={project.voiceover.url}
                          className="w-full h-8"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </StandardStep>
        )}

        {/* Step 3: Background Music */}
        {hasAnalyses && hasSelection && (
          <StandardStep
            stepNumber={3}
            title="Background Music"
            description={project.voiceoverEnabled ? 'Plays underneath the voiceover' : 'Choose a track for your video'}
          >
            <MusicSelector
              selectedTrackId={project.musicTrackId}
              volume={project.musicVolume}
              onSelectTrack={onSetMusicTrack}
              onVolumeChange={onSetMusicVolume}
              disabled={isWorking}
            />
          </StandardStep>
        )}
      </TabBody>

      {/* Footer — Make Video / Open in Studio */}
      {hasAnalyses && hasSelection && (
        <TabFooter>
          {/* Primary action: Render directly */}
          <Button
            onClick={() => onRenderVideo(false)}
            disabled={isWorking || isPreparing || project.status === 'rendering' || project.status === 'generating_clips'}
            className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
            size="lg"
          >
            {isPreparing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {project.status === 'scripting' ? 'Writing script...' : 'Generating voiceover...'}
              </>
            ) : project.status === 'rendering' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Rendering... {project.renderProgress != null ? `${Math.round(project.renderProgress)}%` : ''}
              </>
            ) : project.status === 'generating_clips' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Animating photos...
              </>
            ) : (
              <>
                <Film className="w-4 h-4 mr-2" />
                Make Video
                {(() => {
                  let extra = 2; // Assembly cost
                  if (project.voiceoverEnabled) {
                    if (!project.script) extra += 1;
                    if (!project.voiceover) extra += 2;
                  }
                  return <span className="ml-1 text-xs opacity-70">({extra} credit{extra === 1 ? '' : 's'})</span>;
                })()}
              </>
            )}
          </Button>

          {/* Secondary: Open in Studio for fine-tuning */}
          <Button
            onClick={onOpenInEditor}
            disabled={isWorking || isPreparing || project.status === 'rendering'}
            variant="outline"
            className="w-full mt-2"
            size="sm"
          >
            <Film className="w-3.5 h-3.5 mr-2" />
            Open in Studio (fine-tune first)
          </Button>

          {project.error && (
            <p className="text-xs text-destructive text-center mt-2">{project.error}</p>
          )}
        </TabFooter>
      )}
    </TabContentWrapper>
  );
}

// ─────────────────────────────────────────────
// Inline project name editor
// ─────────────────────────────────────────────
function ProjectNameEditor({
  name,
  onRename,
  disabled,
}: {
  name: string;
  onRename: (name: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(name);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          className="h-8 text-sm font-medium"
          disabled={disabled}
        />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0" onClick={commit}>
          <Check className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0" onClick={cancel}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={disabled}
      className="group flex items-center gap-1.5 min-w-0 flex-1 text-left hover:text-foreground"
    >
      <h3 className="text-sm font-semibold truncate">{name}</h3>
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

// ─────────────────────────────────────────────
// Voice picker with preview play button
// ─────────────────────────────────────────────
function VoicePickerWithPreview({
  voiceId,
  onVoiceChange,
  disabled,
}: {
  voiceId: string;
  onVoiceChange: (id: string) => void;
  disabled?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handlePreview = (e: React.MouseEvent, voice: typeof VOICE_OPTIONS[0]) => {
    e.preventDefault();
    e.stopPropagation();

    // If this voice is currently playing — stop it
    if (playingId === voice.id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }

    // Stop any other playing voice
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Play new preview
    const audio = new Audio(voice.preview);
    audioRef.current = audio;
    setPlayingId(voice.id);
    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.play().catch(() => {
      setPlayingId(null);
      audioRef.current = null;
    });
  };

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">Voice</label>
      <div className="grid grid-cols-2 gap-1.5">
        {VOICE_OPTIONS.map((v) => {
          const isSelected = voiceId === v.id;
          const isPlaying = playingId === v.id;
          return (
            <div
              key={v.id}
              className={`flex items-center gap-1 p-1.5 rounded border text-[11px] cursor-pointer transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border/50 bg-background/30 hover:border-border'
              } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => onVoiceChange(v.id)}
            >
              <button
                type="button"
                className={`flex items-center justify-center w-5 h-5 rounded flex-shrink-0 ${
                  isPlaying ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'
                }`}
                onClick={(e) => handlePreview(e, v)}
                disabled={disabled}
                aria-label={isPlaying ? 'Stop preview' : 'Play preview'}
              >
                {isPlaying ? <Square className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5 ml-0.5" />}
              </button>
              <span className="truncate flex-1">{v.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
