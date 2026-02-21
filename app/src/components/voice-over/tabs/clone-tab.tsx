'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Square, Trash2, Upload, Mic2, AlertCircle } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { toast } from 'sonner';

interface ClonedVoice {
  id: string;
  name: string;
  minimax_voice_id: string;
  preview_url: string | null;
  created_at: string;
}

interface CloneTabProps {
  clonedVoices: ClonedVoice[];
  onCloneVoice: (file: File, name: string, options: { noiseReduction: boolean; volumeNormalization: boolean }) => Promise<void>;
  onDeleteVoice: (voiceId: string) => Promise<void>;
  onSelectVoice: (minimaxVoiceId: string) => void;
  onPlayPreview: (voiceId: string, previewUrl: string) => void;
  playingVoiceId: string | null;
  credits: number;
  isCloning: boolean;
}

const CLONE_CREDIT_COST = 50; // ~$4 revenue, $3 Replicate cost = $1 margin

/**
 * Clone Tab - Voice cloning interface
 * Upload audio to create custom cloned voices
 */
export function CloneTab({
  clonedVoices,
  onCloneVoice,
  onDeleteVoice,
  onSelectVoice,
  onPlayPreview,
  playingVoiceId,
  credits,
  isCloning
}: CloneTabProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [volumeNormalization, setVolumeNormalization] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  }, []);

  const validateAndSetFile = async (file: File) => {
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'];
    const validExtensions = ['.mp3', '.wav', '.m4a'];
    const maxSize = 20 * 1024 * 1024; // 20MB
    const minDuration = 10; // seconds
    const maxDuration = 300; // 5 minutes (Minimax API hard limit)

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.includes(fileExtension);

    if (!hasValidType && !hasValidExtension) {
      toast.error('Invalid file type. Please upload MP3, WAV, or M4A.');
      return;
    }

    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 20MB.');
      return;
    }

    // Check audio duration
    try {
      const duration = await getAudioDuration(file);
      if (duration < minDuration) {
        toast.error(`Audio too short. Minimum ${minDuration} seconds required. Your file is ${Math.round(duration)} seconds.`);
        return;
      }
      if (duration > maxDuration) {
        toast.error(`Audio too long (${Math.round(duration)}s). Maximum 5 minutes allowed.`);
        return;
      }
    } catch {
      // If we can't check duration, proceed anyway (server will validate)
      console.warn('Could not check audio duration');
    }

    setSelectedFile(file);

    // Auto-generate voice name from filename
    if (!voiceName) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setVoiceName(nameWithoutExt.slice(0, 50));
    }
  };

  // Helper to get audio duration with timeout to prevent hanging
  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(audio.src);
        reject(new Error('Timeout loading audio metadata'));
      }, 5000);
      audio.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve(audio.duration);
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Could not load audio'));
        URL.revokeObjectURL(audio.src);
      };
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleClone = async () => {
    if (!selectedFile || !voiceName.trim()) return;

    try {
      await onCloneVoice(selectedFile, voiceName.trim(), {
        noiseReduction,
        volumeNormalization
      });

      // Reset form on success
      setSelectedFile(null);
      setVoiceName('');
      toast.success('Voice cloned successfully!');
    } catch (error) {
      toast.error('Voice cloning failed. Please try again.');
    }
  };

  const canClone = selectedFile && voiceName.trim() && credits >= CLONE_CREDIT_COST && !isCloning;

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Upload Audio */}
        <StandardStep
          stepNumber={1}
          title="Upload Voice Sample"
          description="Upload 10 seconds to 5 minutes of clear audio"
        >
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-2">
                <Mic2 className="w-10 h-10 mx-auto text-primary" />
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop your audio file here, or
                </p>
                <label>
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  MP3, WAV, or M4A • 10s-5min • Max 20MB
                </p>
              </div>
            )}
          </div>
        </StandardStep>

        {/* Step 2: Voice Name */}
        <StandardStep
          stepNumber={2}
          title="Name Your Voice"
          description="Give your cloned voice a memorable name"
        >
          <Input
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            placeholder="e.g., My Custom Voice"
            maxLength={50}
            disabled={isCloning}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {voiceName.length}/50 characters
          </p>
        </StandardStep>

        {/* Step 3: Options */}
        <StandardStep
          stepNumber={3}
          title="Processing Options"
          description="Enhance your voice clone quality"
        >
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="noise-reduction"
                checked={noiseReduction}
                onCheckedChange={(checked) => setNoiseReduction(checked as boolean)}
                disabled={isCloning}
              />
              <Label htmlFor="noise-reduction" className="text-sm cursor-pointer">
                Noise reduction (recommended)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="volume-normalization"
                checked={volumeNormalization}
                onCheckedChange={(checked) => setVolumeNormalization(checked as boolean)}
                disabled={isCloning}
              />
              <Label htmlFor="volume-normalization" className="text-sm cursor-pointer">
                Volume normalization (recommended)
              </Label>
            </div>
          </div>
        </StandardStep>

        {/* Info Box */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Tips for best results:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Use clear audio without background music</li>
                <li>Record in a quiet environment</li>
                <li>Speak naturally at a consistent volume</li>
                <li>Longer samples (1-2 minutes) produce better clones</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* My Cloned Voices */}
        {clonedVoices.length > 0 && (
          <div className="space-y-3 mt-6">
            <h3 className="font-medium">My Cloned Voices ({clonedVoices.length})</h3>
            <div className="grid gap-2">
              {clonedVoices.map((voice) => (
                <Card key={voice.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{voice.name}</p>
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          Cloned
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(voice.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex gap-1">
                      {voice.preview_url && voice.preview_url.startsWith('http') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPlayPreview(voice.minimax_voice_id, voice.preview_url!)}
                        >
                          {playingVoiceId === voice.minimax_voice_id ? (
                            <Square className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectVoice(voice.minimax_voice_id)}
                      >
                        Use
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDeleteVoice(voice.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleClone}
          disabled={!canClone}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isCloning ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Cloning Voice...
            </>
          ) : (
            <>
              <Mic2 className="w-4 h-4 mr-2" />
              Clone Voice ({CLONE_CREDIT_COST} credits)
            </>
          )}
        </Button>
        {credits < CLONE_CREDIT_COST && selectedFile && voiceName.trim() && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {CLONE_CREDIT_COST} credits to clone a voice.
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
