'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  FileText,
  Save,
  X,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Upload,
  Video,
  Music,
  Youtube,
  Trash2,
  ChevronDown,
  ChevronRight,
  Plus,
  FileType,
  Clipboard,
  Check
} from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { AffiliateOffer, OfferMediaFile, OfferYouTubeTranscript } from '@/lib/affiliate-toolkit/types';
import { countWords } from '@/lib/affiliate-toolkit/types';
import {
  fetchAffiliateOffers,
  createAffiliateOffer,
  updateAffiliateOffer,
} from '@/actions/tools/affiliate-script-generator';
import { fetchYouTubeTranscript } from '@/actions/tools/youtube-transcript';
import { processUploadedFile } from '@/actions/tools/media-transcription';

// Content source types
interface ContentSource {
  id: string;
  type: 'text' | 'youtube' | 'media';
  name: string;
  content: string;
  wordCount: number;
  metadata?: {
    url?: string;
    title?: string;
    fileName?: string;
    mediaType?: 'video' | 'audio';
  };
  isCollapsed: boolean;
  createdAt: string;
}

interface OfferContentEditorProps {
  offerId?: string; // If provided, we're editing; otherwise creating
}

export function OfferContentEditor({ offerId }: OfferContentEditorProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(!!offerId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Basic offer info
  const [offerName, setOfferName] = useState('');
  const [offerNiche, setOfferNiche] = useState('');

  // Content sources
  const [sources, setSources] = useState<ContentSource[]>([]);

  // Master document (editable aggregated content)
  const [masterDocument, setMasterDocument] = useState('');
  const [hasManualEdits, setHasManualEdits] = useState(false);

  // Input states
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isFetchingYouTube, setIsFetchingYouTube] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showPasteInput, setShowPasteInput] = useState(false);

  // Media upload state
  const [uploadingMedia, setUploadingMedia] = useState<{id: string; name: string; status: string}[]>([]);

  // Load existing offer if editing
  useEffect(() => {
    if (offerId) {
      loadOffer();
    }
  }, [offerId]);

  const loadOffer = async () => {
    setIsLoading(true);
    try {
      const result = await fetchAffiliateOffers();
      if (result.success && result.offers) {
        const offer = result.offers.find(o => o.id === offerId);
        if (offer) {
          setOfferName(offer.name);
          setOfferNiche(offer.niche || '');

          // Convert existing data to sources
          const loadedSources: ContentSource[] = [];

          // Add text content as a source if exists
          if (offer.offer_content?.trim()) {
            loadedSources.push({
              id: 'text_original',
              type: 'text',
              name: 'Original Text Content',
              content: offer.offer_content,
              wordCount: countWords(offer.offer_content),
              isCollapsed: true,
              createdAt: offer.created_at
            });
          }

          // Add media files as sources
          for (const media of offer.media_files || []) {
            loadedSources.push({
              id: media.id,
              type: 'media',
              name: media.name,
              content: media.transcript,
              wordCount: media.word_count,
              metadata: {
                fileName: media.name,
                mediaType: media.type
              },
              isCollapsed: true,
              createdAt: media.created_at
            });
          }

          // Add YouTube transcripts as sources
          for (const yt of offer.youtube_transcripts || []) {
            loadedSources.push({
              id: yt.id,
              type: 'youtube',
              name: yt.title || 'YouTube Video',
              content: yt.transcript,
              wordCount: yt.word_count,
              metadata: {
                url: yt.url,
                title: yt.title || undefined
              },
              isCollapsed: true,
              createdAt: yt.created_at
            });
          }

          setSources(loadedSources);

          // Use aggregated_content if available (which may have manual edits)
          // Otherwise build from sources
          if (offer.aggregated_content) {
            setMasterDocument(offer.aggregated_content);
          } else {
            rebuildMasterDocument(loadedSources);
          }
        }
      }
    } catch (err) {
      setError('Failed to load offer');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Rebuild master document from sources
  const rebuildMasterDocument = (sourcesToUse: ContentSource[] = sources) => {
    const parts: string[] = [];
    for (const source of sourcesToUse) {
      if (source.content?.trim()) {
        const label = source.type === 'youtube'
          ? `[From YouTube: ${source.name}]`
          : source.type === 'media'
          ? `[From ${source.metadata?.mediaType || 'media'}: ${source.name}]`
          : `[Text: ${source.name}]`;
        parts.push(`${label}\n${source.content.trim()}`);
      }
    }
    setMasterDocument(parts.join('\n\n---\n\n'));
    setHasManualEdits(false);
  };

  // Handle file drops
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');

      if (!isVideo && !isAudio) continue;

      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      setUploadingMedia(prev => [...prev, {
        id: uploadId,
        name: file.name,
        status: 'Transcribing...'
      }]);

      try {
        const result = await processUploadedFile(file);

        if (result.success && result.transcription) {
          const newSource: ContentSource = {
            id: uploadId,
            type: 'media',
            name: file.name,
            content: result.transcription,
            wordCount: countWords(result.transcription),
            metadata: {
              fileName: file.name,
              mediaType: isVideo ? 'video' : 'audio'
            },
            isCollapsed: false,
            createdAt: new Date().toISOString()
          };

          setSources(prev => [...prev, newSource]);

          // Append to master document
          const label = `[From ${isVideo ? 'video' : 'audio'}: ${file.name}]`;
          setMasterDocument(prev => {
            const separator = prev.trim() ? '\n\n---\n\n' : '';
            return prev + separator + `${label}\n${result.transcription}`;
          });

          setUploadingMedia(prev => prev.filter(u => u.id !== uploadId));
        } else {
          setUploadingMedia(prev => prev.map(u =>
            u.id === uploadId ? { ...u, status: `Error: ${result.error || 'Failed'}` } : u
          ));
        }
      } catch (err) {
        setUploadingMedia(prev => prev.map(u =>
          u.id === uploadId ? { ...u, status: `Error: ${err instanceof Error ? err.message : 'Failed'}` } : u
        ));
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.flac']
    },
    multiple: true,
    noClick: false,
    noKeyboard: false
  });

  // Handle YouTube URL
  const handleAddYouTube = async () => {
    if (!youtubeUrl.trim()) return;

    setIsFetchingYouTube(true);
    setError(null);

    try {
      const result = await fetchYouTubeTranscript(youtubeUrl);

      if (result.success && result.transcript) {
        const sourceId = `yt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const title = result.title || 'YouTube Video';

        const newSource: ContentSource = {
          id: sourceId,
          type: 'youtube',
          name: title,
          content: result.transcript,
          wordCount: countWords(result.transcript),
          metadata: {
            url: youtubeUrl,
            title: result.title || undefined
          },
          isCollapsed: false,
          createdAt: new Date().toISOString()
        };

        setSources(prev => [...prev, newSource]);

        // Append to master document
        const label = `[From YouTube: ${title}]`;
        setMasterDocument(prev => {
          const separator = prev.trim() ? '\n\n---\n\n' : '';
          return prev + separator + `${label}\n${result.transcript}`;
        });

        setYoutubeUrl('');
      } else {
        setError(result.error || 'Failed to fetch transcript');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transcript');
    } finally {
      setIsFetchingYouTube(false);
    }
  };

  // Handle paste text
  const handleAddPasteText = () => {
    if (!pasteText.trim()) return;

    const sourceId = `text_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const newSource: ContentSource = {
      id: sourceId,
      type: 'text',
      name: `Pasted Text ${sources.filter(s => s.type === 'text').length + 1}`,
      content: pasteText,
      wordCount: countWords(pasteText),
      isCollapsed: false,
      createdAt: new Date().toISOString()
    };

    setSources(prev => [...prev, newSource]);

    // Append to master document
    const label = `[Text: ${newSource.name}]`;
    setMasterDocument(prev => {
      const separator = prev.trim() ? '\n\n---\n\n' : '';
      return prev + separator + `${label}\n${pasteText}`;
    });

    setPasteText('');
    setShowPasteInput(false);
  };

  // Remove a source
  const removeSource = (sourceId: string) => {
    setSources(prev => prev.filter(s => s.id !== sourceId));
    // Note: We don't auto-remove from master document since user may have edited it
    // They can manually remove that section if desired
  };

  // Toggle source collapse
  const toggleSourceCollapse = (sourceId: string) => {
    setSources(prev => prev.map(s =>
      s.id === sourceId ? { ...s, isCollapsed: !s.isCollapsed } : s
    ));
  };

  // Save offer
  const handleSave = async () => {
    if (!offerName.trim()) {
      setError('Offer name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Convert sources back to the expected format
      const mediaFiles: OfferMediaFile[] = sources
        .filter(s => s.type === 'media')
        .map(s => ({
          id: s.id,
          name: s.name,
          url: '',
          type: s.metadata?.mediaType || 'audio',
          transcript: s.content,
          word_count: s.wordCount,
          created_at: s.createdAt
        }));

      const youtubeTranscripts: OfferYouTubeTranscript[] = sources
        .filter(s => s.type === 'youtube')
        .map(s => ({
          id: s.id,
          url: s.metadata?.url || '',
          title: s.metadata?.title || null,
          transcript: s.content,
          word_count: s.wordCount,
          created_at: s.createdAt
        }));

      // Get text-only sources combined as offer_content
      const textContent = sources
        .filter(s => s.type === 'text')
        .map(s => s.content)
        .join('\n\n');

      if (offerId) {
        // Update existing offer
        const result = await updateAffiliateOffer(offerId, {
          name: offerName,
          niche: offerNiche,
          offer_content: textContent,
          media_files: mediaFiles,
          youtube_transcripts: youtubeTranscripts,
          aggregated_content: masterDocument, // Save the edited master document
        });

        if (result.success) {
          setSuccessMessage('Offer saved successfully!');
          setTimeout(() => setSuccessMessage(null), 3000);
        } else {
          setError(result.error || 'Failed to save offer');
        }
      } else {
        // Create new offer
        const result = await createAffiliateOffer({
          name: offerName,
          niche: offerNiche,
          offer_content: textContent,
          media_files: mediaFiles,
          youtube_transcripts: youtubeTranscripts,
          aggregated_content: masterDocument, // Save the edited master document
        });

        if (result.success && result.offer) {
          setSuccessMessage('Offer created successfully!');
          // Redirect to edit page for the new offer
          setTimeout(() => {
            router.push(`/dashboard/script-generator/offers/${result.offer!.id}`);
          }, 1000);
        } else {
          setError(result.error || 'Failed to create offer');
        }
      }
    } catch (err) {
      setError('An error occurred while saving');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalWordCount = countWords(masterDocument);

  if (isLoading) {
    return (
      <StandardToolPage
        icon={FileText}
        title="Loading..."
        description=""
        iconGradient="bg-primary"
        toolName="Offer Editor"
      >
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        </div>
      </StandardToolPage>
    );
  }

  return (
    <StandardToolPage
      icon={FileText}
      title={offerId ? 'Edit Offer Content' : 'Create New Offer'}
      description="Build your offer knowledge base from multiple sources"
      iconGradient="bg-primary"
      toolName="Offer Editor"
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/script-generator/manage-offers')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <div className="flex items-center gap-4">
            <div className="text-sm text-zinc-400">
              <span className="font-medium text-primary">{totalWordCount.toLocaleString()}</span> words
            </div>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Offer
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto p-1 h-auto">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {successMessage && (
          <div className="mx-4 mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-400 text-sm">{successMessage}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Sources */}
          <div className="w-80 border-r border-border flex flex-col overflow-hidden">
            {/* Offer Info */}
            <div className="p-4 border-b border-border space-y-3">
              <div>
                <Label htmlFor="name" className="text-xs text-zinc-500">Offer Name *</Label>
                <Input
                  id="name"
                  value={offerName}
                  onChange={(e) => setOfferName(e.target.value)}
                  placeholder="e.g., Java Burn"
                  className="bg-background border-border mt-1"
                />
              </div>
              <div>
                <Label htmlFor="niche" className="text-xs text-zinc-500">Niche</Label>
                <Input
                  id="niche"
                  value={offerNiche}
                  onChange={(e) => setOfferNiche(e.target.value)}
                  placeholder="e.g., Weight Loss"
                  className="bg-background border-border mt-1"
                />
              </div>
            </div>

            {/* Add Content Section */}
            <div className="p-4 border-b border-border space-y-3">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Add Content</p>

              {/* YouTube Input */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="YouTube URL..."
                    className="bg-background border-border text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddYouTube();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddYouTube}
                    disabled={!youtubeUrl.trim() || isFetchingYouTube}
                    className="px-3"
                  >
                    {isFetchingYouTube ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Youtube className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Upload Zone */}
              <div
                {...getRootProps()}
                className={cn(
                  "border border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors",
                  isDragActive ? "border-primary bg-primary/10" : "border-zinc-700 hover:border-zinc-500"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="w-5 h-5 text-zinc-500 mx-auto mb-1" />
                <p className="text-xs text-zinc-400">
                  Drop video/audio or click
                </p>
              </div>

              {/* Paste Text */}
              {showPasteInput ? (
                <div className="space-y-2">
                  <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste your text here..."
                    className="min-h-[80px] bg-background border-border text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddPasteText} disabled={!pasteText.trim()} className="flex-1">
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowPasteInput(false); setPasteText(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasteInput(true)}
                  className="w-full gap-2"
                >
                  <Clipboard className="w-4 h-4" />
                  Paste Text
                </Button>
              )}
            </div>

            {/* Uploading Status */}
            {uploadingMedia.length > 0 && (
              <div className="px-4 py-2 border-b border-border">
                {uploadingMedia.map(upload => (
                  <div key={upload.id} className="flex items-center gap-2 py-1">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    <span className="text-xs text-zinc-400 truncate flex-1">{upload.name}</span>
                    <span className="text-xs text-zinc-500">{upload.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Sources List */}
            <div className="flex-1 overflow-y-auto p-2">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider px-2 mb-2">
                Sources ({sources.length})
              </p>

              {sources.length === 0 ? (
                <p className="text-xs text-zinc-600 px-2 py-4 text-center">
                  No content sources yet. Add YouTube URLs, upload media, or paste text.
                </p>
              ) : (
                <div className="space-y-1">
                  {sources.map(source => (
                    <div key={source.id} className="bg-zinc-900 rounded-lg overflow-hidden">
                      <div
                        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-zinc-800"
                        onClick={() => toggleSourceCollapse(source.id)}
                      >
                        {source.isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        )}

                        {source.type === 'youtube' && <Youtube className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        {source.type === 'media' && (
                          source.metadata?.mediaType === 'video'
                            ? <Video className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            : <Music className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        )}
                        {source.type === 'text' && <FileType className="w-4 h-4 text-green-400 flex-shrink-0" />}

                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{source.name}</p>
                          <p className="text-xs text-zinc-500">{source.wordCount.toLocaleString()} words</p>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); removeSource(source.id); }}
                          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3 text-zinc-400 hover:text-red-400" />
                        </Button>
                      </div>

                      {!source.isCollapsed && (
                        <div className="px-2 pb-2">
                          <div className="bg-zinc-950 rounded p-2 max-h-32 overflow-y-auto">
                            <p className="text-xs text-zinc-400 whitespace-pre-wrap">
                              {source.content.substring(0, 500)}
                              {source.content.length > 500 && '...'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rebuild Button */}
            {sources.length > 0 && (
              <div className="p-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rebuildMasterDocument()}
                  className="w-full text-xs"
                >
                  Rebuild Document from Sources
                </Button>
                <p className="text-xs text-zinc-600 mt-1 text-center">
                  Warning: This will overwrite manual edits
                </p>
              </div>
            )}
          </div>

          {/* Right Panel - Master Document */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">Master Document</h3>
                <p className="text-xs text-zinc-500">This is what the AI will use to generate scripts. Edit freely.</p>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-hidden">
              <Textarea
                value={masterDocument}
                onChange={(e) => {
                  setMasterDocument(e.target.value);
                  setHasManualEdits(true);
                }}
                placeholder="Add content from YouTube videos, upload media files, or paste text using the panel on the left. The content will appear here and you can edit it freely.

The AI will use this exact text to generate your marketing scripts, so feel free to:
- Remove irrelevant sections
- Fix transcription errors
- Add your own notes and context
- Reorganize the content"
                className="h-full w-full bg-zinc-950 border-zinc-800 resize-none font-mono text-sm leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>
    </StandardToolPage>
  );
}
