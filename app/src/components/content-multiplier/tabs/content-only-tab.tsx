'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Upload, 
  FileText, 
  Image, 
  Video, 
  Music, 
  X, 
  Wand2,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useContentMultiplierStore } from '../store/content-multiplier-store';
import { toast } from 'sonner';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

/**
 * Content-Only Tab Component
 * Clean, focused content input matching ebook writer style
 */
export function ContentOnlyTab() {
  const [dragActive, setDragActive] = useState(false);
  
  const {
    original_input,
    uploaded_files,
    selected_platforms,
    generation_progress,
    setOriginalInput,
    uploadFile,
    removeFile,
    generatePlatformContent,
    togglePlatform,
  } = useContentMultiplierStore();

  // Debug: Force re-render when uploaded_files change
  useEffect(() => {
    console.log('📁 ContentOnlyTab - Uploaded files updated:', uploaded_files.map(f => ({
      name: f.name,
      processing: f.processing,
      type: f.type,
      transcription: !!f.transcription,
      extracted_text: !!f.extracted_text,
    })));
  }, [uploaded_files]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      await uploadFile(file);
    }
    setDragActive(false);
  }, [uploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi'],
      'audio/*': ['.mp3', '.wav', '.m4a'],
      'application/pdf': ['.pdf'],
      'text/*': ['.txt', '.md'],
    },
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  const handleGenerate = async () => {
    if (!original_input.trim() && uploaded_files.length === 0) {
      toast.error('Please enter content or upload files');
      return;
    }

    if (selected_platforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    await generatePlatformContent();
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image')) return Image;
    if (type.startsWith('video')) return Video;
    if (type.startsWith('audio')) return Music;
    return FileText;
  };

  // Available platforms for selection
  const availablePlatforms = [
    { id: 'twitter', label: 'Twitter', checked: selected_platforms.includes('twitter') },
    { id: 'instagram', label: 'Instagram', checked: selected_platforms.includes('instagram') },
    { id: 'tiktok', label: 'TikTok', checked: selected_platforms.includes('tiktok') },
    { id: 'linkedin', label: 'LinkedIn', checked: selected_platforms.includes('linkedin') },
    { id: 'facebook', label: 'Facebook', checked: selected_platforms.includes('facebook') },
  ];

  return (
    <TabContentWrapper>
      <TabBody>
        <StandardStep
          stepNumber={1}
          title="Original Content"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={original_input}
                onChange={(e) => setOriginalInput(e.target.value)}
                placeholder="Enter your content here..."
                rows={8}
                className="text-base resize-y"
              />
            </div>

            {/* File Upload Area */}
            <div className="space-y-2">
              <Label>Upload Files (Optional)</Label>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                  transition-colors duration-200
                  ${isDragActive || dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                  }
                `}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Images, videos, audio, PDFs, and text files supported
                </p>
              </div>
            </div>

            {/* Uploaded Files List */}
            {uploaded_files.length > 0 && (
              <div className="space-y-2">
                <Label>Uploaded Files</Label>
                <div className="space-y-1">
                  {uploaded_files.map(file => {
                    const FileIcon = getFileIcon(file.mime_type);
                    const isMediaFile = file.type === 'audio' || file.type === 'video';
                    const isProcessing = Boolean(file.processing);
                    
                    return (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-2 rounded-md transition-all ${
                          isProcessing ? 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800' : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span>({(file.size / 1024).toFixed(1)} KB)</span>
                            {isProcessing && isMediaFile && (
                              <span className="text-blue-500 inline-flex items-center">
                                • Processing
                                <span className="inline-flex ml-0.5">
                                  <span className="animate-[pulse_1.4s_ease-in-out_infinite]">.</span>
                                  <span className="animate-[pulse_1.4s_ease-in-out_0.2s_infinite]">.</span>
                                  <span className="animate-[pulse_1.4s_ease-in-out_0.4s_infinite]">.</span>
                                </span>
                              </span>
                            )}
                            {file.transcription && (
                              <span className="text-green-600">• ✓ Transcribed</span>
                            )}
                            {file.extracted_text && (
                              <span className="text-green-600">• ✓ Extracted</span>
                            )}
                            {file.error && (
                              <span className="text-red-500">• ⚠ Error</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          className="h-6 w-6 p-0"
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </StandardStep>

        <StandardStep
          stepNumber={2}
          title="Select Platforms"
        >
          <div className="space-y-3">
            {availablePlatforms.map(platform => (
              <div key={platform.id} className="flex items-center space-x-3">
                <Checkbox
                  id={platform.id}
                  checked={platform.checked}
                  onCheckedChange={() => togglePlatform(platform.id as any)}
                />
                <Label
                  htmlFor={platform.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {platform.label}
                </Label>
              </div>
            ))}
          </div>
        </StandardStep>
      </TabBody>
      
      <TabFooter>
        <Button 
          onClick={handleGenerate}
          disabled={generation_progress.is_generating || (!original_input.trim() && uploaded_files.length === 0) || selected_platforms.length === 0}
          className="w-full bg-primary hover:from-blue-600 hover:to-cyan-600"
        >
          {generation_progress.is_generating ? (
            'Generating Content...'
          ) : (
            <>
              Generate Content
              <Wand2 className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </TabFooter>
    </TabContentWrapper>
  );
}