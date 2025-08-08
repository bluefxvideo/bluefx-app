'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  Image, 
  Video, 
  Music, 
  X, 
  Wand2,
  Check,
} from 'lucide-react';
import { XIcon, InstagramIcon, TikTokIcon, LinkedInIcon, FacebookIcon } from '../components/brand-icons';
import { useContentMultiplierStore, usePlatformConnections } from '../store/content-multiplier-store';
import type { SocialPlatform } from '../store/content-multiplier-store';
import { PlatformConnectDialog } from '../components/platform-connect-dialog';
import { toast } from 'sonner';

/**
 * Input Tab Component
 * Main entry point for content input, file uploads, and platform selection
 */
export function InputTab() {
  const [dragActive, setDragActive] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedPlatformToConnect, setSelectedPlatformToConnect] = useState<SocialPlatform | null>(null);
  
  const {
    original_input,
    uploaded_files,
    selected_platforms,
    content_settings,
    generation_progress,
    setOriginalInput,
    uploadFile,
    removeFile,
    togglePlatform,
    updateContentSettings,
    generatePlatformContent,
    calculateCreditsEstimate,
    clearCurrentProject,
  } = useContentMultiplierStore();

  const connections = usePlatformConnections();

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
    calculateCreditsEstimate();
    
    // Show initial toast
    toast.info('Starting content generation...', {
      description: `Creating optimized content for ${selected_platforms.length} platform${selected_platforms.length > 1 ? 's' : ''}`
    });
    
    try {
      await generatePlatformContent();
      
      // Show success toast with guidance
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

  const handleConnectPlatform = (platformId: SocialPlatform) => {
    setSelectedPlatformToConnect(platformId);
    setConnectDialogOpen(true);
  };

  const canGenerate = (original_input.trim() || uploaded_files.length > 0) && 
                     selected_platforms.length > 0 && 
                     !generation_progress.is_generating;

  const platforms: { id: SocialPlatform; name: string; icon: any; color: string }[] = [
    { id: 'twitter', name: 'Twitter/X', icon: XIcon, color: 'bg-black' },
    { id: 'instagram', name: 'Instagram', icon: InstagramIcon, color: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500' },
    { id: 'tiktok', name: 'TikTok', icon: TikTokIcon, color: 'bg-black' },
    { id: 'linkedin', name: 'LinkedIn', icon: LinkedInIcon, color: 'bg-blue-600' },
    { id: 'facebook', name: 'Facebook', icon: FacebookIcon, color: 'bg-blue-500' },
  ];

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
    <div className="h-full overflow-y-auto scrollbar-hover space-y-6">
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
              rows={4}
              className="text-sm"
            />
            <div className="text-xs text-muted-foreground">
              {original_input.length} characters
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

      {/* Platform Selection */}
      <Card className="bg-white dark:bg-gray-800/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-emerald-500" />
            Select Platforms
          </CardTitle>
          <CardDescription>
            Choose which social media platforms to adapt your content for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3">
            {platforms.map((platform) => {
              const isSelected = selected_platforms.includes(platform.id);
              const isConnected = connections[platform.id]?.connected || false;
              
              return (
                <div
                  key={platform.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                    isSelected 
                      ? 'border-emerald-500 bg-blue-50 dark:bg-emerald-950/20' 
                      : 'border-border'
                  }`}
                  onClick={() => togglePlatform(platform.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${platform.color}`}>
                      <platform.icon className="h-4 w-4 text-white" size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{platform.name}</span>
                        {isConnected && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                        {!isConnected && (
                          <Badge 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnectPlatform(platform.id);
                            }}
                          >
                            Connect
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isSelected ? 'Selected for content adaptation' : 'Click to select'}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected 
                        ? 'border-emerald-500 bg-blue-500' 
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selected_platforms.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <div className="text-sm text-muted-foreground mb-2">
                Selected: {selected_platforms.length} platform{selected_platforms.length > 1 ? 's' : ''}
              </div>
              <div className="flex flex-wrap gap-1">
                {selected_platforms.map((platformId) => {
                  const platform = platforms.find(p => p.id === platformId);
                  if (!platform) return null;
                  
                  return (
                    <Badge key={platformId} variant="secondary" className="text-xs">
                      {platform.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Button */}
      <div className="pb-4">
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

        {selected_platforms.length > 0 && (
          <div className="mt-2 text-center">
            <div className="text-xs text-muted-foreground">
              Estimated credits: ~{selected_platforms.length * 2} credits
            </div>
          </div>
        )}

        {/* Clear Project Button */}
        {(original_input || uploaded_files.length > 0) && (
          <Button 
            variant="outline" 
            onClick={clearCurrentProject}
            className="w-full mt-2"
            size="sm"
          >
            Clear All
          </Button>
        )}

        {/* Platform Connection Dialog */}
        <PlatformConnectDialog
          platform={selectedPlatformToConnect}
          open={connectDialogOpen}
          onOpenChange={(open) => {
            setConnectDialogOpen(open);
            if (!open) setSelectedPlatformToConnect(null);
          }}
        />
      </div>
    </div>
  );
}