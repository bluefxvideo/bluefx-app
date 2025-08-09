'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Upload, 
  FileText, 
  Image, 
  Video, 
  Music, 
  X, 
  Wand2,
  Plus,
} from 'lucide-react';
import { useContentMultiplierStore, usePlatformConnections } from '../store/content-multiplier-store';
import { PlatformSelectionPanel } from '../components/platform-selection-panel';
import { toast } from 'sonner';

/**
 * Simplified Input Tab Component
 * Clean, focused design matching Thumbnail Machine pattern
 * Single card with main content input and platform selection via right panel
 */
export function SimplifiedInputTab() {
  const [dragActive, setDragActive] = useState(false);
  const [platformPanelOpen, setPlatformPanelOpen] = useState(false);
  
  const {
    original_input,
    uploaded_files,
    selected_platforms,
    generation_progress,
    setOriginalInput,
    uploadFile,
    removeFile,
    generatePlatformContent,
    clearCurrentProject,
  } = useContentMultiplierStore();

  const _connections = usePlatformConnections();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      await uploadFile(file);
    }
    setDragActive(false);
  }, [uploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    accept: {
      'text/*': ['.txt', '.md'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const handleGenerate = async () => {
    if (selected_platforms.length === 0) {
      toast.error('Please select platforms', {
        description: 'Click "Add Platforms" to choose which social media platforms to create content for'
      });
      return;
    }
    
    toast.info('Starting content generation...', {
      description: `Creating optimized content for ${selected_platforms.length} platform${selected_platforms.length > 1 ? 's' : ''}`
    });
    
    try {
      await generatePlatformContent();
      
      toast.success('Content generated successfully!', {
        description: 'Navigate to platform tabs to review and edit your content',
        duration: 4000,
      });
    } catch (_error) {
      toast.error('Content generation failed', {
        description: 'Please try again or check your input',
      });
    }
  };

  const canGenerate = (original_input.trim() || uploaded_files.length > 0) && 
                     selected_platforms.length > 0 && 
                     !generation_progress.is_generating;

  const getFileIcon = (type: string) => {
    if (type.startsWith('image')) return Image;
    if (type.startsWith('video')) return Video;
    if (type.startsWith('audio')) return Music;
    return FileText;
  };

  const _formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPlatformNames = () => {
    const platformMap = {
      'twitter': 'Twitter/X',
      'instagram': 'Instagram', 
      'tiktok': 'TikTok',
      'linkedin': 'LinkedIn',
      'facebook': 'Facebook'
    };
    return selected_platforms.map(p => platformMap[p as keyof typeof platformMap]).join(', ');
  };

  return (
    <>
      <div className="h-full overflow-y-auto scrollbar-hover p-6">
        {/* Main Content Card - Following Thumbnail Machine pattern */}
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Wand2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Content Multiplier</h1>
                <p className="text-sm text-muted-foreground">Generate platform-optimized content from your original content</p>
              </div>
            </div>
          </div>

          {/* Content Input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content" className="text-sm font-medium">
                📝 Content
              </Label>
              <Textarea
                id="content"
                value={original_input}
                onChange={(e) => setOriginalInput(e.target.value)}
                placeholder="Describe your perfect content... (e.g., 'Share tips about productivity, include call-to-action, professional tone')"
                rows={6}
                className="text-sm resize-none"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {original_input.length}/5000 characters
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  💡 Tip: Be descriptive for better results
                </span>
              </div>
            </div>

            {/* File Upload (Optional) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                📎 Reference Files (Optional)
              </Label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  isDragActive || dragActive
                    ? 'border-purple-500 bg-blue-50 dark:bg-purple-950/20'
                    : 'border-border hover:border-purple-300'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm">
                  {isDragActive ? 'Drop files here' : 'Drop image or click to upload'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Style reference for generation
                </p>
              </div>
            </div>

            {/* Uploaded Files */}
            {uploaded_files.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {uploaded_files.map((file) => {
                    const FileIcon = getFileIcon(file.type);
                    return (
                      <div key={file.id} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md text-sm">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium truncate max-w-32">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          className="h-5 w-5 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Platform Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                🎯 Target Platforms
              </Label>
              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="flex-1">
                  {selected_platforms.length > 0 ? (
                    <div>
                      <div className="text-sm font-medium">
                        {selected_platforms.length} platform{selected_platforms.length > 1 ? 's' : ''} selected
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getPlatformNames()}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-muted-foreground">No platforms selected</div>
                      <div className="text-xs text-muted-foreground">Choose platforms to optimize content for</div>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPlatformPanelOpen(true)}
                  className="ml-3"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Platforms
                </Button>
              </div>
            </div>

            {/* Generation Options */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                ⚙️ Generation Options
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">4</div>
                  <div className="text-xs text-muted-foreground">Variations</div>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">16:9</div>
                  <div className="text-xs text-muted-foreground">Aspect Ratio</div>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <Button 
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-purple-600 hover:to-pink-600 h-12"
              size="lg"
            >
              {generation_progress.is_generating ? (
                'Generating Content...'
              ) : (
                <>
                  <Wand2 className="mr-2 h-5 w-5" />
                  Generate {selected_platforms.length > 0 ? `${selected_platforms.length} Platform` : ''} Content
                </>
              )}
            </Button>

            {/* Credits Estimate */}
            {selected_platforms.length > 0 && (
              <div className="text-center">
                <div className="text-xs text-muted-foreground">
                  Estimated: ~{selected_platforms.length * 2} credits
                </div>
              </div>
            )}

            {/* Clear Button */}
            {(original_input || uploaded_files.length > 0) && (
              <Button 
                variant="outline" 
                onClick={clearCurrentProject}
                className="w-full"
                size="sm"
              >
                Clear All
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Platform Selection Right Panel */}
      <PlatformSelectionPanel
        open={platformPanelOpen}
        onOpenChange={setPlatformPanelOpen}
      />
    </>
  );
}