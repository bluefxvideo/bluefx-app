'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { ZillowInput } from '../components/zillow-input';
import { PhotoGrid } from '../components/photo-grid';
import { MusicSelector } from '../components/music-selector';
import { VoiceSelector } from '../components/voice-selector';
import { ScriptEditor } from '../components/script-editor';
import {
  Loader2, Scan, Sparkles, Film, Download, ChevronDown, ChevronUp,
  Monitor, Smartphone, Type, Mic, FileText, RefreshCw,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { ReelEstateProject, TargetDuration, ZillowListingData } from '@/types/reelestate';
import { TARGET_DURATIONS } from '@/types/reelestate';

interface VideoMakerTabProps {
  project: ReelEstateProject;
  credits: number;
  isLoadingCredits?: boolean;
  isWorking: boolean;
  // Step 1: Photos
  onStartProject: (input: {
    zillow_url?: string;
    manual_photos?: string[];
    manual_listing_data?: Partial<ZillowListingData>;
  }) => void;
  onAnalyzePhotos: () => void;
  onSetSelectedIndices: (indices: number[]) => void;
  onCleanupPhoto?: (index: number) => void;
  cleaningIndices?: number[];
  // Step 2: Style
  onSetAspectRatio: (ratio: '16:9' | '9:16') => void;
  onSetTargetDuration: (duration: TargetDuration) => void;
  onSetIntroText: (text: string | null) => void;
  onSetSpeedRamps: (enabled: boolean) => void;
  // Step 3: Music
  onSetMusicTrack: (trackId: string | null, url: string | null) => void;
  onSetMusicVolume: (volume: number) => void;
  // Step 4: Create
  onRenderVideo: (animate?: boolean) => void;
  onOpenInEditor: () => void;
  // Optional voiceover (collapsible in Step 4)
  onGenerateScript: () => void;
  onGenerateVoiceover: () => void;
  onUpdateScriptSegment: (index: number, voiceover: string) => void;
  onDeleteScriptSegment: (index: number) => void;
  onMoveScriptSegment: (index: number, direction: 'up' | 'down') => void;
  onSetVoiceId: (voiceId: string) => void;
  onSetVoiceSpeed: (speed: number) => void;
  userId?: string;
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
  onSetSpeedRamps,
  onSetMusicTrack,
  onSetMusicVolume,
  onRenderVideo,
  onOpenInEditor,
  onGenerateScript,
  onGenerateVoiceover,
  onUpdateScriptSegment,
  onDeleteScriptSegment,
  onMoveScriptSegment,
  onSetVoiceId,
  onSetVoiceSpeed,
  userId,
}: VideoMakerTabProps) {
  const [showVoiceover, setShowVoiceover] = useState(false);

  const hasPhotos = project.photos.length > 0;
  const hasAnalyses = project.analyses.length > 0;
  const hasSelection = project.selectedIndices.length > 0;
  const hasMusic = project.musicTrackId !== null;
  const hasScript = project.script !== null;
  const hasVoiceover = project.voiceover !== null;
  const isRendering = project.status === 'rendering' || project.status === 'generating_clips';

  // Credit estimate: animation (6 per photo) + render (2)
  const animationCost = project.selectedIndices.length * 6;
  const totalVideoCost = animationCost + 2;

  return (
    <TabContentWrapper>
      <TabBody>
        {/* ─── Step 1: Photos ─── */}
        <StandardStep
          stepNumber={1}
          title="Property Photos"
          description="Import from Zillow or upload photos"
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
                {project.listing.price_formatted && ` · ${project.listing.price_formatted}`}
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
                  Analyze Photos ({analysisCost} credits)
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

        {/* ─── Step 2: Style & Settings ─── */}
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

              {/* AI Animation info */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">AI Cinematic Animation</p>
                  <p className="text-xs text-muted-foreground">
                    Each photo gets cinematic camera motion via AI
                  </p>
                </div>
              </div>
            </div>
          </StandardStep>
        )}

        {/* ─── Step 3: Music ─── */}
        {hasAnalyses && hasSelection && (
          <StandardStep
            stepNumber={3}
            title="Background Music"
            description="Choose a track for your video"
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

        {/* ─── Step 4: Create Video ─── */}
        {hasAnalyses && hasSelection && hasMusic && (
          <StandardStep
            stepNumber={4}
            title="Create Video"
            description={project.finalVideoUrl ? 'Your video is ready!' : 'Review settings and create your video'}
          >
            {/* Summary */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Photos</span>
                <span>{project.selectedIndices.length} selected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span>{project.targetDuration}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Orientation</span>
                <span>{project.aspectRatio === '16:9' ? 'Landscape' : 'Portrait'}</span>
              </div>
              {project.introText && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Intro</span>
                  <span className="truncate ml-4">{project.introText}</span>
                </div>
              )}
            </div>

            {/* Render progress */}
            {isRendering && project.renderProgress !== null && (
              <div className="space-y-2 mt-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {project.status === 'generating_clips'
                      ? 'Animating photos...'
                      : 'Rendering video...'}
                  </span>
                  <span>{project.renderProgress}%</span>
                </div>
                <Progress value={project.renderProgress} className="h-2" />
              </div>
            )}

            {/* Final video */}
            {project.finalVideoUrl && (
              <div className="space-y-3 mt-3">
                <video
                  src={project.finalVideoUrl}
                  controls
                  className="w-full rounded-lg bg-black"
                  style={{ maxHeight: '300px' }}
                />
                <a href={project.finalVideoUrl} download target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Download Video
                  </Button>
                </a>
              </div>
            )}

            {/* Optional: Add Voiceover (collapsible) */}
            <div className="mt-4 border-t border-border/30 pt-3">
              <button
                type="button"
                onClick={() => setShowVoiceover(!showVoiceover)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {showVoiceover ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <Mic className="w-4 h-4" />
                <span>Add Voiceover (optional, +3 credits)</span>
              </button>

              {showVoiceover && (
                <div className="mt-3 space-y-3 pl-6">
                  <VoiceSelector
                    voiceId={project.voiceId}
                    onVoiceChange={onSetVoiceId}
                    speed={project.voiceSpeed}
                    onSpeedChange={onSetVoiceSpeed}
                    disabled={isWorking}
                    userId={userId}
                  />

                  {!hasScript ? (
                    <Button onClick={onGenerateScript} disabled={isWorking} className="w-full" size="sm">
                      {project.status === 'scripting' ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating script...</>
                      ) : (
                        <><FileText className="w-3.5 h-3.5 mr-1.5" />Generate Script (1 credit)</>
                      )}
                    </Button>
                  ) : (
                    <>
                      <ScriptEditor
                        segments={project.script!.segments.filter(s =>
                          project.selectedIndices.includes(s.image_index)
                        )}
                        photos={project.photos}
                        onUpdateSegment={onUpdateScriptSegment}
                        onDeleteSegment={onDeleteScriptSegment}
                        onMoveSegment={onMoveScriptSegment}
                        disabled={isWorking}
                      />
                      {hasVoiceover ? (
                        <div className="space-y-2">
                          <audio src={project.voiceover!.url} controls className="w-full h-10 rounded-lg" />
                          <Button variant="outline" size="sm" onClick={onGenerateVoiceover} disabled={isWorking} className="w-full">
                            {project.status === 'generating_voiceover' ? (
                              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Regenerating...</>
                            ) : (
                              <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Regenerate Voiceover (2 credits)</>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button onClick={onGenerateVoiceover} disabled={isWorking} className="w-full" size="sm">
                          {project.status === 'generating_voiceover' ? (
                            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating voiceover...</>
                          ) : (
                            <><Mic className="w-3.5 h-3.5 mr-1.5" />Generate Voiceover (2 credits)</>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </StandardStep>
        )}
      </TabBody>

      {/* Footer */}
      {hasAnalyses && hasSelection && hasMusic && (
        <TabFooter>
          <div className="flex gap-2">
            <Button
              onClick={() => onRenderVideo(true)}
              disabled={isWorking || isRendering}
              className="flex-1 h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
              size="lg"
            >
              {isRendering ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {project.status === 'generating_clips' ? 'Animating photos...' : 'Rendering video...'}
                </>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />
                  Create Video ({totalVideoCost} credits)
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onOpenInEditor}
              disabled={isWorking}
              className="h-12"
              size="lg"
            >
              <Film className="w-4 h-4" />
            </Button>
          </div>

          {project.error && (
            <p className="text-xs text-destructive text-center mt-2">{project.error}</p>
          )}
        </TabFooter>
      )}
    </TabContentWrapper>
  );
}
