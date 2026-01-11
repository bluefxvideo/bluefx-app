'use client';

import { useState, useRef } from 'react';
import { ScanSearch, Upload, Play, Loader2, Copy, Check, Clock, Trash2, History, Youtube, FileVideo, Wand2, ChevronDown, ChevronUp, Send, LayoutGrid } from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCredits } from '@/hooks/useCredits';
import { BuyCreditsDialog } from '@/components/ui/buy-credits-dialog';
import { toast } from 'sonner';
import { analyzeVideo, analyzeYouTubeVideo, fetchVideoAnalyses, deleteVideoAnalysis } from '@/actions/tools/video-analyzer';
import { generateStoryboardPrompts, Shot, StoryboardPrompt } from '@/actions/tools/ad-recreator';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PromptRefiner } from './prompt-refiner';

// Analysis type options
const ANALYSIS_TYPES = [
  { value: 'storyboard_recreation', label: 'Storyboard Recreation', description: 'Precise timecoded shots for recreating as storyboard' },
  { value: 'full_breakdown', label: 'Full Breakdown', description: 'Complete scene-by-scene analysis with all details' },
  { value: 'shot_list', label: 'Shot List Only', description: 'Focus on shots, camera work, and timing' },
  { value: 'script_extraction', label: 'Script/Dialogue Extraction', description: 'Extract narration, dialogue, and on-screen text' },
  { value: 'custom_only', label: 'Custom Prompt Only', description: 'Use only your custom instructions' },
] as const;

type AnalysisType = typeof ANALYSIS_TYPES[number]['value'];

interface VideoAnalysis {
  id: string;
  title: string;
  video_url: string | null;
  video_duration_seconds: number | null;
  analysis_result: string;
  custom_prompt: string | null;
  credits_used: number;
  created_at: string;
}

type InputMode = 'file' | 'youtube';

export function VideoAnalyzerPage() {
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('storyboard_recreation');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const queryClient = useQueryClient();

  // Create Storyboard Prompts state
  const [showStoryboardPrompts, setShowStoryboardPrompts] = useState(false);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [generatedShots, setGeneratedShots] = useState<Shot[]>([]);
  const [generatedPrompts, setGeneratedPrompts] = useState<StoryboardPrompt[]>([]);
  const [videoSummary, setVideoSummary] = useState<string>('');
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);
  // Track modified prompts (key: grid index, value: modified prompt)
  const [modifiedPrompts, setModifiedPrompts] = useState<Record<number, string>>({});

  const { credits, deductCredits, hasEnoughCredits, isLoading: creditsLoading } = useCredits();

  // Fetch saved analyses
  const { data: savedAnalyses, isLoading: historyLoading } = useQuery({
    queryKey: ['video-analyses'],
    queryFn: async () => {
      const result = await fetchVideoAnalyses();
      if (result.success) {
        return result.analyses || [];
      }
      return [];
    },
  });

  // Calculate credits needed (3 per minute, minimum 3)
  const calculateCreditsNeeded = (durationSeconds: number): number => {
    const minutes = Math.ceil(durationSeconds / 60);
    return Math.max(3, minutes * 3);
  };

  const creditsNeeded = videoDuration ? calculateCreditsNeeded(videoDuration) : 3;

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid video file (MP4, WebM, MOV, AVI)');
      return;
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Video file is too large. Maximum size is 100MB');
      return;
    }

    setSelectedFile(file);
    setAnalysisResult(null);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);

    // Get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      // Validate duration (max 3 minutes = 180 seconds)
      if (duration > 180) {
        toast.error('Video is too long. Maximum duration is 3 minutes');
        setSelectedFile(null);
        setVideoPreviewUrl(null);
        URL.revokeObjectURL(url);
        return;
      }
      setVideoDuration(duration);
      URL.revokeObjectURL(video.src);
    };
    video.src = url;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // Validate YouTube URL
  const isValidYoutubeUrl = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const handleAnalyze = async () => {
    // Validate input based on mode
    if (inputMode === 'file' && !selectedFile) {
      toast.error('Please select a video file first');
      return;
    }
    if (inputMode === 'youtube' && !youtubeUrl) {
      toast.error('Please enter a YouTube URL');
      return;
    }
    if (inputMode === 'youtube' && !isValidYoutubeUrl(youtubeUrl)) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }
    if (analysisType === 'custom_only' && !customPrompt.trim()) {
      toast.error('Please enter custom instructions when using "Custom Prompt Only" mode');
      return;
    }

    if (!hasEnoughCredits(creditsNeeded)) {
      setShowBuyCredits(true);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Deduct credits first
      deductCredits({ credits: creditsNeeded, service: 'video_analyzer' });

      let result;

      if (inputMode === 'youtube') {
        // Analyze YouTube video
        result = await analyzeYouTubeVideo({
          youtubeUrl,
          analysisType,
          customPrompt: customPrompt || undefined,
        });
      } else {
        // Analyze uploaded file
        const arrayBuffer = await selectedFile!.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = '';
        uint8Array.forEach((byte) => {
          binary += String.fromCharCode(byte);
        });
        const base64 = btoa(binary);

        result = await analyzeVideo({
          videoBase64: base64,
          videoMimeType: selectedFile!.type,
          videoDurationSeconds: videoDuration || 0,
          analysisType,
          customPrompt: customPrompt || undefined,
          title: selectedFile!.name,
        });
      }

      if (result.success && result.analysis) {
        setAnalysisResult(result.analysis);
        toast.success('Video analysis complete!');
        // Refresh history
        queryClient.invalidateQueries({ queryKey: ['video-analyses'] });
      } else {
        toast.error(result.error || 'Failed to analyze video');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze video');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = async () => {
    if (!analysisResult) return;
    await navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteAnalysis = async (id: string) => {
    const result = await deleteVideoAnalysis(id);
    if (result.success) {
      toast.success('Analysis deleted');
      queryClient.invalidateQueries({ queryKey: ['video-analyses'] });
    } else {
      toast.error('Failed to delete analysis');
    }
  };

  const loadAnalysis = (analysis: VideoAnalysis) => {
    setAnalysisResult(analysis.analysis_result);
    setShowHistory(false);
    toast.success('Analysis loaded');
  };

  // Generate storyboard prompts from analysis
  const handleGeneratePrompts = async () => {
    if (!analysisResult) {
      toast.error('Please analyze a video first');
      return;
    }

    setIsGeneratingPrompts(true);
    setGeneratedShots([]);
    setGeneratedPrompts([]);
    setVideoSummary('');
    setModifiedPrompts({});

    try {
      const result = await generateStoryboardPrompts({
        analysisText: analysisResult,
      });

      if (result.success) {
        setGeneratedShots(result.shots || []);
        setGeneratedPrompts(result.storyboardPrompts || []);
        setVideoSummary(result.videoSummary || '');
        toast.success(`Generated ${result.gridsNeeded} storyboard prompt(s) from ${result.totalShots} shots!`);
      } else {
        toast.error(result.error || 'Failed to generate prompts');
      }
    } catch (error) {
      console.error('Error generating prompts:', error);
      toast.error('Failed to generate prompts');
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  // Copy a specific prompt to clipboard
  const handleCopyPrompt = async (prompt: string, index: number) => {
    await navigator.clipboard.writeText(prompt);
    setCopiedPromptIndex(index);
    toast.success('Prompt copied to clipboard');
    setTimeout(() => setCopiedPromptIndex(null), 2000);
  };

  // Send prompt to Storyboard Generator (opens in new tab to preserve current state)
  const handleSendToStoryboard = (prompt: string) => {
    const encodedPrompt = encodeURIComponent(prompt);
    window.open(`/dashboard/ai-cinematographer/storyboard?prompt=${encodedPrompt}`, '_blank');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <StandardToolPage
      icon={ScanSearch}
      title="Video Analyzer"
      description="Break down videos with AI-powered scene analysis"
      toolName="Video Analyzer"
    >
      <div className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Left Panel - Upload & Settings */}
          <div className="space-y-4">
            {/* Input Mode Toggle */}
            <div className="flex gap-2">
              <Button
                variant={inputMode === 'file' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setInputMode('file')}
              >
                <FileVideo className="w-4 h-4 mr-2" />
                Upload File
              </Button>
              <Button
                variant={inputMode === 'youtube' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setInputMode('youtube')}
              >
                <Youtube className="w-4 h-4 mr-2" />
                YouTube URL
              </Button>
            </div>

            {/* Video Input - File Upload or YouTube URL */}
            {inputMode === 'file' ? (
              <Card
                className="relative p-6 border border-border/50 cursor-pointer transition-all duration-300
                         backdrop-blur-sm hover:border-border group/upload overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />

                {selectedFile && videoPreviewUrl ? (
                  <div className="space-y-4">
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                      <video
                        ref={videoRef}
                        src={videoPreviewUrl}
                        className="w-full h-full object-contain"
                        controls
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold truncate max-w-[200px]">{selectedFile.name}</p>
                        <p className="text-zinc-400 text-sm flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {videoDuration ? formatDuration(videoDuration) : 'Loading...'}
                          <span className="text-zinc-500">•</span>
                          {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setVideoPreviewUrl(null);
                          setVideoDuration(null);
                          setAnalysisResult(null);
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-secondary/50 to-card/50 rounded-2xl flex items-center justify-center
                                   border border-border/30 group-hover/upload:border-border/70 transition-all duration-300">
                      <Upload className="w-7 h-7 text-zinc-400 group-hover/upload:text-zinc-300 transition-colors duration-300" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-zinc-200 font-semibold text-lg">Upload your video</p>
                      <p className="text-zinc-400">MP4, WebM, MOV, AVI • Max 3 minutes • Max 100MB</p>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-6 border border-border/50">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                      <Youtube className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">YouTube Video</p>
                      <p className="text-zinc-400 text-sm">Paste a YouTube video URL to analyze</p>
                    </div>
                  </div>
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="bg-background border-border"
                  />
                  {youtubeUrl && isValidYoutubeUrl(youtubeUrl) && (
                    <p className="text-green-400 text-sm flex items-center gap-1">
                      <Check className="w-3 h-3" /> Valid YouTube URL
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* Analysis Type Dropdown */}
            <Card className="p-4 border border-border/50">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Analysis Type
              </label>
              <Select value={analysisType} onValueChange={(v) => setAnalysisType(v as AnalysisType)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANALYSIS_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex flex-col">
                        <span>{type.label}</span>
                        <span className="text-xs text-zinc-400">{type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            {/* Custom Prompt */}
            <Card className="p-4 border border-border/50">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {analysisType === 'custom_only' ? 'Custom Instructions (Required)' : 'Additional Instructions (Optional)'}
              </label>
              <Textarea
                placeholder={analysisType === 'custom_only'
                  ? "Enter your custom analysis instructions..."
                  : "Add specific focus areas... (e.g., 'Focus on the product placement moments' or 'Pay attention to the color grading')"
                }
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[100px] bg-background border-border"
              />
              {analysisType !== 'custom_only' && (
                <p className="text-xs text-zinc-500 mt-2">
                  These instructions will be added to the {ANALYSIS_TYPES.find(t => t.value === analysisType)?.label} analysis
                </p>
              )}
            </Card>

            {/* Credits Info & Analyze Button */}
            <Card className="p-4 border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-zinc-400">
                  Credits needed: <span className="text-white font-semibold">{creditsNeeded}</span>
                </div>
                <div className="text-sm text-zinc-400">
                  Available: <span className="text-primary font-semibold">{credits?.available_credits || 0}</span>
                </div>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleAnalyze}
                disabled={(inputMode === 'file' ? !selectedFile : !youtubeUrl) || isAnalyzing || creditsLoading}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing Video...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Analyze Video
                  </>
                )}
              </Button>
            </Card>

            {/* History Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="w-4 h-4 mr-2" />
              {showHistory ? 'Hide' : 'View'} Analysis History
            </Button>
          </div>

          {/* Right Panel - Results or History */}
          <div className="space-y-4">
            {showHistory ? (
              <Card className="p-4 border border-border/50 h-full overflow-auto">
                <h3 className="text-lg font-semibold text-white mb-4">Saved Analyses</h3>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                  </div>
                ) : savedAnalyses && savedAnalyses.length > 0 ? (
                  <div className="space-y-3">
                    {savedAnalyses.map((analysis: VideoAnalysis) => (
                      <div
                        key={analysis.id}
                        className="p-3 bg-secondary/30 rounded-lg border border-border/30 hover:border-border/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{analysis.title}</p>
                            <p className="text-zinc-400 text-sm">
                              {new Date(analysis.created_at).toLocaleDateString()} • {analysis.credits_used} credits
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => loadAnalysis(analysis)}
                            >
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAnalysis(analysis.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-400 text-center py-8">No saved analyses yet</p>
                )}
              </Card>
            ) : (
              <Card className="p-4 border border-border/50 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Analysis Result</h3>
                  {analysisResult && (
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  )}
                </div>

                <div className="flex-1 overflow-auto">
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-zinc-400">Analyzing video...</p>
                      <p className="text-zinc-500 text-sm">This may take a minute for longer videos</p>
                    </div>
                  ) : analysisResult ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-zinc-300 text-sm font-sans leading-relaxed">
                        {analysisResult}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <ScanSearch className="w-12 h-12 text-zinc-600 mb-4" />
                      <p className="text-zinc-400">Upload a video and click analyze to get started</p>
                      <p className="text-zinc-500 text-sm mt-2">
                        Get detailed breakdowns of scenes, shots, lighting, and more
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Create Storyboard Prompts Section - Full Width */}
        {analysisResult && (
          <div className="mt-6 border-t border-border/50 pt-6">
            {/* Toggle Button */}
            <Button
              variant="outline"
              className="w-full mb-4 justify-between"
              onClick={() => setShowStoryboardPrompts(!showStoryboardPrompts)}
            >
              <span className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                Create Storyboard Prompts
                <span className="text-xs text-muted-foreground ml-2">
                  Convert shots to ready-to-use 3x3 grid prompts
                </span>
              </span>
              {showStoryboardPrompts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {showStoryboardPrompts && (
              <div className="space-y-6">
                {/* Generate Button + Info */}
                {generatedPrompts.length === 0 && !isGeneratingPrompts && (
                  <Card className="p-6 border border-border/50">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
                        <LayoutGrid className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-lg">Generate Storyboard Prompts</h4>
                        <p className="text-zinc-400 text-sm mt-1">
                          Convert the shot breakdown into ready-to-use 3x3 grid prompts.
                          <br />
                          You can edit the prompts in the Storyboard Generator before generating.
                        </p>
                      </div>
                      <Button
                        size="lg"
                        onClick={handleGeneratePrompts}
                        disabled={isGeneratingPrompts}
                      >
                        <Wand2 className="w-4 h-4 mr-2" />
                        Generate Storyboard Prompts
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Loading State */}
                {isGeneratingPrompts && (
                  <Card className="p-8 border border-border/50">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-zinc-400">Converting shots to storyboard prompts...</p>
                    </div>
                  </Card>
                )}

                {/* Shot Breakdown + Generated Prompts */}
                {generatedPrompts.length > 0 && (
                  <>
                    {/* Summary */}
                    {videoSummary && (
                      <div className="p-3 bg-secondary/30 rounded-lg border border-border/30">
                        <p className="text-sm text-zinc-300">{videoSummary}</p>
                      </div>
                    )}

                    {/* Two Column Layout: Shots + Prompts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left: Shot List */}
                      <Card className="p-4 border border-border/50">
                        <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Shot Breakdown ({generatedShots.length} shots)
                        </h4>
                        <div className="space-y-2 max-h-[400px] overflow-auto">
                          {generatedShots.map((shot) => (
                            <div
                              key={shot.shotNumber}
                              className="p-3 bg-secondary/20 rounded-lg border border-border/30"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-primary">
                                  Shot {shot.shotNumber} • {shot.shotType}
                                </span>
                                <span className="text-xs text-zinc-500">
                                  {shot.startTime} - {shot.endTime} ({shot.duration})
                                </span>
                              </div>
                              <p className="text-sm text-zinc-300">{shot.description}</p>
                            </div>
                          ))}
                        </div>
                      </Card>

                      {/* Right: Generated Prompts */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-white flex items-center gap-2">
                          <LayoutGrid className="w-4 h-4" />
                          Storyboard Prompts ({generatedPrompts.length} grid{generatedPrompts.length > 1 ? 's' : ''})
                        </h4>

                        {generatedPrompts.map((promptData, index) => {
                          const currentPrompt = modifiedPrompts[index] ?? promptData.prompt;
                          const isModified = modifiedPrompts[index] !== undefined;

                          return (
                            <Card key={index} className={`p-4 border ${isModified ? 'border-green-500/30 bg-green-500/5' : 'border-primary/30 bg-primary/5'}`}>
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-medium text-white flex items-center gap-2">
                                  Grid {promptData.gridNumber} - Shots {promptData.shotsCovered}
                                  {isModified && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                                      Modified
                                    </span>
                                  )}
                                </span>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopyPrompt(currentPrompt, index)}
                                  >
                                    {copiedPromptIndex === index ? (
                                      <>
                                        <Check className="w-3 h-3 mr-1" />
                                        Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3 mr-1" />
                                        Copy
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSendToStoryboard(currentPrompt)}
                                  >
                                    <Send className="w-3 h-3 mr-1" />
                                    Send to Storyboard
                                  </Button>
                                </div>
                              </div>
                              <pre className="text-xs text-zinc-300 whitespace-pre-wrap bg-black/20 p-3 rounded max-h-[200px] overflow-auto">
                                {currentPrompt}
                              </pre>

                              {/* AI Prompt Customizer */}
                              <PromptRefiner
                                prompt={currentPrompt}
                                onPromptChange={(newPrompt) => {
                                  setModifiedPrompts(prev => ({
                                    ...prev,
                                    [index]: newPrompt,
                                  }));
                                }}
                                disabled={isGeneratingPrompts}
                              />
                            </Card>
                          );
                        })}
                      </div>
                    </div>

                    {/* Regenerate Button */}
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={handleGeneratePrompts}
                        disabled={isGeneratingPrompts}
                      >
                        <Wand2 className="w-4 h-4 mr-2" />
                        Regenerate Prompts
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <BuyCreditsDialog open={showBuyCredits} onOpenChange={setShowBuyCredits} />
    </StandardToolPage>
  );
}
