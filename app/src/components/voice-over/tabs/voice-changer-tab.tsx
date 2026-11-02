'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Repeat2, Upload, Mic2, AlertCircle, Sparkles, FileVideo, Download } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { toast } from 'sonner';
import { VOICE_CHANGER_CREDITS_PER_MINUTE, VOICE_CHANGER_TOO_LONG, voiceChangerCredits, voiceChangerTooLong } from '@/lib/voice-pricing';

interface VoiceChangerTabProps {
  onChangeVoice: (
    sourceFile: File,
    targetVoiceFile: File,
    highQuality?: boolean
  ) => Promise<void>;
  credits: number;
  isChanging: boolean;
  changedAudioUrl: string | null;
  changedVideoUrl: string | null;
  changedResultType: 'audio' | 'video' | null;
}

const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
const MAX_AUDIO_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;

/** The length of a local audio or video file in seconds, read by the browser; null when it cannot tell. */
function readFileSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement(isVideoFile(file) ? 'video' : 'audio');
    const done = (seconds: number | null) => {
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    media.preload = 'metadata';
    media.onloadedmetadata = () => done(Number.isFinite(media.duration) && media.duration > 0 ? media.duration : null);
    media.onerror = () => done(null);
    media.src = url;
  });
}

function isVideoFile(file: File): boolean {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
  return VIDEO_TYPES.includes(file.type) || VIDEO_EXTENSIONS.includes(ext);
}

export function VoiceChangerTab({
  onChangeVoice,
  credits,
  isChanging,
  changedAudioUrl,
  changedVideoUrl,
  changedResultType,
}: VoiceChangerTabProps) {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [targetVoiceFile, setTargetVoiceFile] = useState<File | null>(null);
  const [highQuality, setHighQuality] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [targetDragActive, setTargetDragActive] = useState(false);

  // The price follows the source's length: 2 credits per started minute (the server measures it again before charging).
  const [sourceSeconds, setSourceSeconds] = useState<number | null>(null);
  useEffect(() => {
    let current = true;
    setSourceSeconds(null);
    if (sourceFile) {
      readFileSeconds(sourceFile).then((seconds) => {
        if (!current) return;
        setSourceSeconds(seconds);
        if (seconds !== null && voiceChangerTooLong(seconds)) toast.error(VOICE_CHANGER_TOO_LONG);
      });
    }
    return () => {
      current = false;
    };
  }, [sourceFile]);
  const tooLong = sourceSeconds !== null && voiceChangerTooLong(sourceSeconds);
  const creditCost = voiceChangerCredits(sourceSeconds ?? 0, highQuality);
  const sourceIsVideo = sourceFile ? isVideoFile(sourceFile) : false;

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleTargetDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setTargetDragActive(true);
    } else if (e.type === 'dragleave') {
      setTargetDragActive(false);
    }
  }, []);

  const validateSourceFile = (file: File): boolean => {
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    const allValidTypes = [...AUDIO_TYPES, ...VIDEO_TYPES];
    const allValidExtensions = [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS];

    if (!allValidTypes.includes(file.type) && !allValidExtensions.includes(ext)) {
      toast.error('Invalid file type. Please upload MP3, WAV, M4A, MP4, MOV, or WebM.');
      return false;
    }
    const maxSize = isVideoFile(file) ? MAX_VIDEO_SIZE : MAX_AUDIO_SIZE;
    if (file.size > maxSize) {
      const limitMB = maxSize / 1024 / 1024;
      toast.error(`File too large. Maximum size is ${limitMB}MB.`);
      return false;
    }
    return true;
  };

  const validateAudioFile = (file: File): boolean => {
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    if (!AUDIO_TYPES.includes(file.type) && !AUDIO_EXTENSIONS.includes(ext)) {
      toast.error('Invalid file type. Please upload MP3, WAV, or M4A.');
      return false;
    }
    if (file.size > MAX_AUDIO_SIZE) {
      toast.error('File too large. Maximum size is 20MB.');
      return false;
    }
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      if (validateSourceFile(file)) setSourceFile(file);
    }
  }, []);

  const handleTargetDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTargetDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      if (validateAudioFile(file)) setTargetVoiceFile(file);
    }
  }, []);

  const handleSourceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (validateSourceFile(file)) setSourceFile(file);
    }
  };

  const handleTargetSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (validateAudioFile(file)) setTargetVoiceFile(file);
    }
  };

  const handleGenerate = async () => {
    if (!sourceFile || !targetVoiceFile) {
      toast.error('Please upload both a source file and a target voice sample.');
      return;
    }

    try {
      await onChangeVoice(sourceFile, targetVoiceFile, highQuality);
    } catch {
      // Error handled in hook
    }
  };

  const canGenerate = sourceFile && targetVoiceFile && !isChanging && !tooLong && credits >= creditCost;

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Upload Source */}
        <StandardStep
          stepNumber={1}
          title="Upload Source"
          description="The audio or video whose voice you want to change"
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
            {sourceFile ? (
              <div className="space-y-2">
                {sourceIsVideo ? (
                  <FileVideo className="w-10 h-10 mx-auto text-primary" />
                ) : (
                  <Mic2 className="w-10 h-10 mx-auto text-primary" />
                )}
                <p className="font-medium">{sourceFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(sourceFile.size / 1024 / 1024).toFixed(2)} MB
                  {sourceSeconds !== null && ` · ${Math.floor(Math.round(sourceSeconds) / 60)}:${String(Math.round(sourceSeconds) % 60).padStart(2, '0')}`}
                  {sourceIsVideo && (
                    <span className="ml-2 text-xs bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                      Video
                    </span>
                  )}
                </p>
                <Button variant="outline" size="sm" onClick={() => setSourceFile(null)}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop your audio or video file here, or
                </p>
                <label>
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a,.mp4,.mov,.webm,audio/mpeg,audio/wav,audio/mp4,video/mp4,video/quicktime,video/webm"
                    onChange={handleSourceSelect}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  Audio: MP3, WAV, M4A (max 20MB) | Video: MP4, MOV, WebM (max 100MB) | Up to 10 minutes
                </p>
              </div>
            )}
          </div>
        </StandardStep>

        {/* Step 2: Upload Target Voice */}
        <StandardStep
          stepNumber={2}
          title="Upload Target Voice"
          description="Upload a voice sample — the AI will convert the source to sound like this voice"
        >
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              targetDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragEnter={handleTargetDrag}
            onDragLeave={handleTargetDrag}
            onDragOver={handleTargetDrag}
            onDrop={handleTargetDrop}
          >
            {targetVoiceFile ? (
              <div className="space-y-2">
                <Mic2 className="w-8 h-8 mx-auto text-primary" />
                <p className="font-medium text-sm">{targetVoiceFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(targetVoiceFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button variant="outline" size="sm" onClick={() => setTargetVoiceFile(null)}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Upload a voice sample to clone the voice style
                </p>
                <label>
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
                    onChange={handleTargetSelect}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground">
                  MP3, WAV, or M4A • Max 20MB
                </p>
              </div>
            )}
          </div>
        </StandardStep>

        {/* Step 3: Quality */}
        <StandardStep
          stepNumber={3}
          title="Quality"
          description="Choose output audio quality"
        >
          <div className="flex items-center space-x-2">
            <Checkbox
              id="high-quality"
              checked={highQuality}
              onCheckedChange={(checked) => setHighQuality(checked as boolean)}
              disabled={isChanging}
            />
            <Label htmlFor="high-quality" className="text-sm cursor-pointer">
              High Quality (48kHz) — slower but better audio fidelity
            </Label>
          </div>
        </StandardStep>

        {/* Info Box */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Upload any audio or video recording as the source</li>
                <li>Upload a voice sample of the voice you want to clone</li>
                <li>The AI will re-speak the source audio in the target voice</li>
                <li>For video files, the converted voice replaces the original audio</li>
                <li>Works best with clear speech without background music</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Result */}
        {(changedAudioUrl || changedVideoUrl) && (
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-medium text-sm">
                  {changedResultType === 'video' ? 'Converted Video' : 'Converted Audio'}
                </h3>
              </div>

              {changedResultType === 'video' && changedVideoUrl ? (
                <>
                  <video controls src={changedVideoUrl} className="w-full rounded-lg" />
                  <a href={changedVideoUrl} download="voice-changed.mp4" className="inline-block">
                    <Button variant="outline" size="sm">
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download Video
                    </Button>
                  </a>
                </>
              ) : changedAudioUrl ? (
                <>
                  <audio controls src={changedAudioUrl} className="w-full" />
                  <a href={changedAudioUrl} download="voice-changed.mp3" className="inline-block">
                    <Button variant="outline" size="sm">
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download
                    </Button>
                  </a>
                </>
              ) : null}
            </div>
          </Card>
        )}
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isChanging ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {sourceIsVideo ? 'Processing Video...' : 'Converting Voice...'}
            </>
          ) : (
            <>
              <Repeat2 className="w-4 h-4 mr-2" />
              Change Voice ({sourceFile && sourceSeconds === null ? `from ${creditCost}` : creditCost} credits)
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          {tooLong
            ? VOICE_CHANGER_TOO_LONG
            : `${VOICE_CHANGER_CREDITS_PER_MINUTE} credits per started minute of the recording, at least ${voiceChangerCredits(0, highQuality)} credits. Up to 10 minutes.`}
        </p>
        {!tooLong && credits < creditCost && sourceFile && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {creditCost} credits to change voice.
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
