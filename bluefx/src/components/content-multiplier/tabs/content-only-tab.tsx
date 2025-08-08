'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { 
  Upload, 
  FileText, 
  Image, 
  Video, 
  Music, 
  X, 
  Wand2,
  Layers,
} from 'lucide-react';
import { useContentMultiplierStore } from '../store/content-multiplier-store';
import { toast } from 'sonner';

/**
 * Content-Only Tab Component
 * Clean, focused content input without platform selection
 * Matches the simple, beautiful design of Thumbnail Machine
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
    clearCurrentProject,
  } = useContentMultiplierStore();

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
      toast.error('Please select platforms first', {
        description: 'Go to the Platforms tab to choose which social media platforms to create content for'
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
    } catch (error) {
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-xl font-semibold">Content Input</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter your content to multiply across social media platforms
        </p>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hover space-y-6">
        {/* Content Input Section */}
        <Card className="bg-white dark:bg-gray-800/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Content Input
            </CardTitle>
            <CardDescription>
              Enter your content or upload files to multiply across platforms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content">Original Content</Label>
              <Textarea
                id="content"
                value={original_input}
                onChange={(e) => setOriginalInput(e.target.value)}
                placeholder="Enter your content here... You can also upload files below."
                rows={6}
                className="text-sm resize-none"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {original_input.length} characters
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  💡 Be descriptive for better results
                </span>
              </div>
            </div>

            {/* File Upload Area */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive || dragActive
                  ? 'border-purple-500 bg-blue-50 dark:bg-purple-950/20'
                  : 'border-border hover:border-purple-300'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to select files (images, videos, audio, documents)
              </p>
            </div>

            {/* Uploaded Files List */}
            {uploaded_files.length > 0 && (
              <div className="space-y-2">
                <Label>Uploaded Files ({uploaded_files.length})</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {uploaded_files.map((file) => {
                    const FileIcon = getFileIcon(file.type);
                    return (
                      <div key={file.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)} • {file.type}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selected_platforms.length === 0 && (
          <Card className="bg-white dark:bg-gray-800/40">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground mb-2">
                No platforms selected
              </div>
              <div className="text-xs text-muted-foreground">
                Go to the Platforms tab to choose which social media platforms to create content for
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Fixed Bottom Button Area */}
      <div className="flex-shrink-0 pt-4 space-y-2">
        <Button 
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-purple-600 hover:to-pink-600"
          size="lg"
        >
          {generation_progress.is_generating ? (
            'Generating Content...'
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Generate Platform Content
            </>
          )}
        </Button>

        {/* Clear Project Button */}
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
  );
}