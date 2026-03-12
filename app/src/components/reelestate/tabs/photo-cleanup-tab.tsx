'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { Upload, X, Sparkles, Loader2 } from 'lucide-react';
import { CLEANUP_PRESET_CONFIG, type CleanupPreset } from '@/types/reelestate';

interface CleanupQueueItem {
  url: string;
  preset: CleanupPreset;
  customPrompt?: string;
  filename?: string;
}

interface PhotoCleanupTabProps {
  onCleanup: (items: { url: string; preset: CleanupPreset; customPrompt?: string }[]) => void;
  isCleaning: boolean;
  credits: number;
  isLoadingCredits?: boolean;
  queue: CleanupQueueItem[];
  onAddToQueue: (item: CleanupQueueItem) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
}

export function PhotoCleanupTab({
  onCleanup,
  isCleaning,
  credits,
  isLoadingCredits,
  queue,
  onAddToQueue,
  onRemoveFromQueue,
  onClearQueue,
}: PhotoCleanupTabProps) {
  const [selectedPreset, setSelectedPreset] = useState<CleanupPreset>('remove_people');
  const [customPrompt, setCustomPrompt] = useState('');
  const [uploadedPhotos, setUploadedPhotos] = useState<{ url: string; filename: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalCost = queue.length * 2;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setUploadedPhotos(prev => [...prev, { url, filename: file.name }]);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addPhotosToQueue = () => {
    for (const photo of uploadedPhotos) {
      onAddToQueue({
        url: photo.url,
        preset: selectedPreset,
        customPrompt: selectedPreset === 'custom' ? customPrompt : undefined,
        filename: photo.filename,
      });
    }
    setUploadedPhotos([]);
  };

  const handleCleanup = () => {
    onCleanup(queue.map(item => ({ url: item.url, preset: item.preset, customPrompt: item.customPrompt })));
  };

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Upload Photos */}
        <StandardStep
          stepNumber={1}
          title="Upload Photos"
          description="Upload property photos that need cleaning up"
        >
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCleaning}
            className="w-full h-20 border-dashed flex flex-col gap-1"
          >
            <Upload className="w-5 h-5" />
            <span className="text-sm">Click to upload photos</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Uploaded previews */}
          {uploadedPhotos.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {uploadedPhotos.map((photo, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border group">
                  <img src={photo.url} alt={photo.filename} className="w-full h-full object-cover" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-5 w-5 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      URL.revokeObjectURL(photo.url);
                      setUploadedPhotos(prev => prev.filter((_, idx) => idx !== i));
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </StandardStep>

        {/* Step 2: Choose Preset */}
        <StandardStep
          stepNumber={2}
          title="Cleanup Type"
          description="Choose what to fix in your photos"
        >
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(CLEANUP_PRESET_CONFIG).map(([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPreset(key as CleanupPreset)}
                disabled={isCleaning}
                className={`text-left p-3 rounded-lg border-2 transition-all ${
                  selectedPreset === key
                    ? 'border-primary bg-primary/10'
                    : 'border-border/50 hover:border-muted-foreground/30'
                }`}
              >
                <p className="text-sm font-medium">{config.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
              </button>
            ))}
          </div>

          {selectedPreset === 'custom' && (
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="Describe what you want to change... e.g. 'Remove the car from the driveway' or 'Replace the brown grass with green lawn'"
              disabled={isCleaning}
              rows={3}
              className="mt-3 w-full rounded-lg border border-border/50 bg-background p-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none resize-none"
            />
          )}

          {uploadedPhotos.length > 0 && (
            <Button
              onClick={addPhotosToQueue}
              disabled={isCleaning || (selectedPreset === 'custom' && !customPrompt.trim())}
              className="w-full mt-3"
              variant="secondary"
            >
              Add {uploadedPhotos.length} photo{uploadedPhotos.length > 1 ? 's' : ''} to queue
            </Button>
          )}
        </StandardStep>

        {/* Step 3: Queue */}
        {queue.length > 0 && (
          <StandardStep
            stepNumber={3}
            title="Cleanup Queue"
            description={`${queue.length} photo${queue.length > 1 ? 's' : ''} ready for cleanup`}
          >
            <div className="space-y-2">
              {queue.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/20">
                  <div className="shrink-0 w-12 h-12 rounded overflow-hidden">
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.filename || `Photo ${i + 1}`}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.preset === 'custom' && item.customPrompt
                        ? item.customPrompt
                        : CLEANUP_PRESET_CONFIG[item.preset].label}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onRemoveFromQueue(i)}
                    disabled={isCleaning}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearQueue}
              disabled={isCleaning}
              className="mt-2 text-muted-foreground"
            >
              Clear queue
            </Button>
          </StandardStep>
        )}
      </TabBody>

      {queue.length > 0 && (
        <TabFooter>
          <Button
            onClick={handleCleanup}
            disabled={isCleaning || (!isLoadingCredits && credits < totalCost)}
            className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
            size="lg"
          >
            {isCleaning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cleaning up photos...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Clean Up {queue.length} Photo{queue.length > 1 ? 's' : ''} ({totalCost} credits)
              </>
            )}
          </Button>

          {!isLoadingCredits && credits < totalCost && (
            <p className="text-xs text-destructive text-center mt-2">
              Insufficient credits. Need {totalCost} (have {credits}).
            </p>
          )}
        </TabFooter>
      )}
    </TabContentWrapper>
  );
}
