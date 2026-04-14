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
  Monitor, Smartphone, Type, Mic, Volume2,
} from 'lucide-react';
import type { ReelEstateProject, TargetDuration } from '@/types/reelestate';
import { TARGET_DURATIONS } from '@/types/reelestate';

const VOICE_OPTIONS = [
  { id: 'Friendly_Person', label: 'Friendly' },
  { id: 'Deep_Voice_Man', label: 'Deep Voice' },
  { id: 'Calm_Woman', label: 'Calm Woman' },
  { id: 'Inspirational_girl', label: 'Inspirational' },
  { id: 'Warm_Man', label: 'Warm Man' },
  { id: 'Wise_Lady', label: 'Wise Lady' },
  { id: 'Confident_Man', label: 'Confident Man' },
  { id: 'Gentle_Woman', label: 'Gentle Woman' },
];

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
}

export function VideoMakerTab({
  project,
  credits,
  isLoadingCredits,
  isWorking,
  onStartProject,
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
}: VideoMakerTabProps) {
  const hasPhotos = project.photos.length > 0;
  const hasAnalyses = project.analyses.length > 0;
  const hasSelection = project.selectedIndices.length > 0;

  const isPreparing = ['scripting', 'generating_voiceover'].includes(project.status);

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Photos */}
        <StandardStep
          stepNumber={1}
          title="Property Photos"
          description="Import from Zillow / Realtor.com or upload photos"
        >
          <ZillowInput
            onSubmitUrl={(url) => onStartProject({ zillow_url: url })}
            onUploadPhotos={(urls) => onStartProject({ manual_photos: urls })}
            isLoading={project.status === 'scraping'}
            disabled={isWorking}
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
                    {/* Voice selector */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Voice</label>
                      <Select
                        value={project.voiceId}
                        onValueChange={onSetVoiceId}
                        disabled={isWorking}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VOICE_OPTIONS.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

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
                          <span className="text-xs font-medium">Script ({project.script.segments.length} segments · {project.script.total_duration_seconds}s)</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] gap-1 px-2"
                            onClick={onRegenerateScript}
                            disabled={isWorking}
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            Regenerate
                          </Button>
                        </div>
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
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            Voiceover ready
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] gap-1 px-2"
                            onClick={onRegenerateVoiceover}
                            disabled={isWorking}
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            Regenerate
                          </Button>
                        </div>
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

      {/* Footer — Open in Editor */}
      {hasAnalyses && hasSelection && (
        <TabFooter>
          <Button
            onClick={onOpenInEditor}
            disabled={isWorking || isPreparing}
            className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
            size="lg"
          >
            {isPreparing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {project.status === 'scripting' ? 'Writing script...' : 'Generating voiceover...'}
              </>
            ) : (
              <>
                <Film className="w-4 h-4 mr-2" />
                Open in Studio
                {project.voiceoverEnabled && !project.voiceover && (
                  <span className="ml-1 text-xs opacity-70">(+3 credits)</span>
                )}
              </>
            )}
          </Button>

          {project.error && (
            <p className="text-xs text-destructive text-center mt-2">{project.error}</p>
          )}
        </TabFooter>
      )}
    </TabContentWrapper>
  );
}
