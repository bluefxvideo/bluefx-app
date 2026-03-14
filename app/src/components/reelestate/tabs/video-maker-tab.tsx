'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { ZillowInput } from '../components/zillow-input';
import { PhotoGrid } from '../components/photo-grid';
import { ScriptEditor } from '../components/script-editor';
import { Loader2, Scan, FileText, Film, Mic, RefreshCw, Download } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { VoiceSelector } from '../components/voice-selector';
import type { ReelEstateProject, TargetDuration, ZillowListingData } from '@/types/reelestate';
import { TARGET_DURATIONS } from '@/types/reelestate';

interface VideoMakerTabProps {
  project: ReelEstateProject;
  credits: number;
  isLoadingCredits?: boolean;
  isWorking: boolean;
  onStartProject: (input: {
    zillow_url?: string;
    manual_photos?: string[];
    manual_listing_data?: Partial<ZillowListingData>;
  }) => void;
  onAnalyzePhotos: () => void;
  onGenerateScript: () => void;
  onGenerateVoiceover: () => void;
  onOpenInEditor: () => void;
  onSetSelectedIndices: (indices: number[]) => void;
  onUpdateScriptSegment: (index: number, voiceover: string) => void;
  onDeleteScriptSegment: (index: number) => void;
  onMoveScriptSegment: (index: number, direction: 'up' | 'down') => void;
  onSetAspectRatio: (ratio: '16:9' | '9:16') => void;
  onSetTargetDuration: (duration: TargetDuration) => void;
  onSetVoiceId: (voiceId: string) => void;
  onSetVoiceSpeed: (speed: number) => void;
  userId?: string;
  onCleanupPhoto?: (index: number) => void;
  cleaningIndices?: number[];
}

export function VideoMakerTab({
  project,
  credits,
  isLoadingCredits,
  isWorking,
  onStartProject,
  onAnalyzePhotos,
  onGenerateScript,
  onGenerateVoiceover,
  onOpenInEditor,
  onSetSelectedIndices,
  onUpdateScriptSegment,
  onDeleteScriptSegment,
  onMoveScriptSegment,
  onSetAspectRatio,
  onSetTargetDuration,
  onSetVoiceId,
  onSetVoiceSpeed,
  userId,
  onCleanupPhoto,
  cleaningIndices,
}: VideoMakerTabProps) {
  const hasPhotos = project.photos.length > 0;
  const hasAnalyses = project.analyses.length > 0;
  const hasScript = project.script !== null;
  const hasSelection = project.selectedIndices.length > 0;
  const hasVoiceover = project.voiceover !== null;
  // Determine which step is active
  const getActiveStep = () => {
    if (!hasPhotos) return 1;
    if (!hasAnalyses) return 2;
    if (!hasScript) return 3;
    return 4;
  };

  const activeStep = getActiveStep();

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Input */}
        <StandardStep
          stepNumber={1}
          title="Listing Source"
          description="Paste a Zillow URL or upload property photos"
        >
          <ZillowInput
            onSubmitUrl={(url) => onStartProject({ zillow_url: url })}
            onUploadPhotos={(urls) => onStartProject({ manual_photos: urls })}
            isLoading={project.status === 'scraping'}
            disabled={isWorking}
          />

          {/* Listing summary after scrape */}
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
        </StandardStep>

        {/* Step 2: Review Photos (visible after photos loaded) */}
        {hasPhotos && (
          <StandardStep
            stepNumber={2}
            title="Review Photos"
            description={hasAnalyses ? 'Select photos to include in the video' : 'AI will analyze each photo for quality and room type'}
          >
            {!hasAnalyses ? (
              <Button
                onClick={onAnalyzePhotos}
                disabled={isWorking}
                className="w-full"
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
            ) : (
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
        )}

        {/* Step 3: Script (visible after analysis + selection) */}
        {hasAnalyses && hasSelection && (
          <StandardStep
            stepNumber={3}
            title="Voiceover Script"
            description={hasScript ? 'Edit the generated script for each segment' : 'AI writes a voiceover script matched to your photos'}
          >
            {/* Settings above script */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Target Duration</label>
                <Select
                  value={String(project.targetDuration)}
                  onValueChange={(v) => onSetTargetDuration(Number(v) as TargetDuration)}
                  disabled={isWorking || hasScript}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_DURATIONS.map(d => (
                      <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <VoiceSelector
                voiceId={project.voiceId}
                onVoiceChange={onSetVoiceId}
                speed={project.voiceSpeed}
                onSpeedChange={onSetVoiceSpeed}
                disabled={isWorking}
                userId={userId}
              />
            </div>

            {!hasScript ? (
              <Button
                onClick={onGenerateScript}
                disabled={isWorking}
                className="w-full"
              >
                {project.status === 'scripting' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating script...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Script (1 credit)
                  </>
                )}
              </Button>
            ) : (
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
            )}
          </StandardStep>
        )}

        {/* Step 4: Voiceover (visible after script) */}
        {hasScript && (
          <StandardStep
            stepNumber={4}
            title="Voiceover"
            description={hasVoiceover ? 'Voiceover ready — regenerate anytime' : 'Generate a voiceover from your script'}
          >
            {hasVoiceover ? (
              <div className="space-y-3">
                <audio
                  src={project.voiceover!.url}
                  controls
                  className="w-full h-10 rounded-lg"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onGenerateVoiceover}
                  disabled={isWorking}
                  className="w-full"
                >
                  {project.status === 'generating_voiceover' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate Voiceover (2 credits)
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                onClick={onGenerateVoiceover}
                disabled={isWorking}
                className="w-full"
              >
                {project.status === 'generating_voiceover' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating voiceover...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Generate Voiceover (2 credits)
                  </>
                )}
              </Button>
            )}
          </StandardStep>
        )}

        {/* Step 5: Render Video (visible after voiceover) */}
        {hasVoiceover && (
          <StandardStep
            stepNumber={5}
            title="Render Video"
            description={project.finalVideoUrl
              ? 'Video rendered — download or re-render'
              : 'Configure aspect ratio and render the final video'}
          >
            <div className="space-y-4">
              {/* Aspect ratio */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Aspect Ratio</label>
                <div className="flex gap-2">
                  {(['16:9', '9:16'] as const).map(ratio => (
                    <Button
                      key={ratio}
                      variant={project.aspectRatio === ratio ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => onSetAspectRatio(ratio)}
                      disabled={isWorking}
                    >
                      {ratio === '16:9' ? 'Landscape' : 'Portrait'} ({ratio})
                    </Button>
                  ))}
                </div>
              </div>

              {/* Render progress */}
              {project.status === 'rendering' && project.renderProgress !== null && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Rendering video...</span>
                    <span>{Math.round(project.renderProgress * 100)}%</span>
                  </div>
                  <Progress value={project.renderProgress * 100} className="h-2" />
                </div>
              )}

              {/* Final video player */}
              {project.finalVideoUrl && (
                <div className="space-y-3">
                  <video
                    src={project.finalVideoUrl}
                    controls
                    className="w-full rounded-lg bg-black"
                    style={{ maxHeight: '300px' }}
                  />
                  <a
                    href={project.finalVideoUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="w-4 h-4 mr-2" />
                      Download Video
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </StandardStep>
        )}
      </TabBody>

      {/* Open in Editor button */}
      {hasVoiceover && (
        <TabFooter>
          <Button
            onClick={onOpenInEditor}
            disabled={isWorking}
            className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
            size="lg"
          >
            <Film className="w-4 h-4 mr-2" />
            Open in Video Editor
          </Button>

          {project.error && (
            <p className="text-xs text-destructive text-center mt-2">{project.error}</p>
          )}
        </TabFooter>
      )}
    </TabContentWrapper>
  );
}
