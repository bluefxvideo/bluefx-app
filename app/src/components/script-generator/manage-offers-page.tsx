'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Upload,
  Video,
  Music,
  Youtube,
  FileAudio,
  Check
} from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AffiliateOffer, OfferMediaFile, OfferYouTubeTranscript } from '@/lib/affiliate-toolkit/types';
import { countWords, aggregateOfferContent } from '@/lib/affiliate-toolkit/types';
import {
  fetchAffiliateOffers,
  createAffiliateOffer,
  updateAffiliateOffer,
  deleteAffiliateOffer
} from '@/actions/tools/affiliate-script-generator';
import { fetchYouTubeTranscript } from '@/actions/tools/youtube-transcript';
import { processUploadedFile } from '@/actions/tools/media-transcription';

interface OfferFormData {
  name: string;
  niche: string;
  offer_content: string;
  media_files: OfferMediaFile[];
  youtube_transcripts: OfferYouTubeTranscript[];
}

interface PendingMedia {
  id: string;
  file: File;
  name: string;
  type: 'video' | 'audio';
  status: 'pending' | 'uploading' | 'transcribing' | 'done' | 'error';
  progress?: string;
  transcript?: string;
  error?: string;
}

interface PendingYouTube {
  id: string;
  url: string;
  status: 'pending' | 'fetching' | 'done' | 'error';
  title?: string;
  transcript?: string;
  error?: string;
}

const emptyForm: OfferFormData = {
  name: '',
  niche: '',
  offer_content: '',
  media_files: [],
  youtube_transcripts: []
};

export function ManageOffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<AffiliateOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<AffiliateOffer | null>(null);
  const [formData, setFormData] = useState<OfferFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  // Media upload state
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);

  // YouTube state
  const [pendingYouTube, setPendingYouTube] = useState<PendingYouTube[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isFetchingYouTube, setIsFetchingYouTube] = useState(false);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<AffiliateOffer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load offers on mount
  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchAffiliateOffers();
      if (result.success && result.offers) {
        setOffers(result.offers);
      } else {
        setError(result.error || 'Failed to load offers');
      }
    } catch (err) {
      setError('Failed to load offers');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingOffer(null);
    setFormData(emptyForm);
    setPendingMedia([]);
    setPendingYouTube([]);
    setYoutubeUrl('');
    setIsFormOpen(true);
  };

  const openEditForm = (offer: AffiliateOffer) => {
    setEditingOffer(offer);
    setFormData({
      name: offer.name,
      niche: offer.niche || '',
      offer_content: offer.offer_content || '',
      media_files: offer.media_files || [],
      youtube_transcripts: offer.youtube_transcripts || []
    });
    setPendingMedia([]);
    setPendingYouTube([]);
    setYoutubeUrl('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingOffer(null);
    setFormData(emptyForm);
    setPendingMedia([]);
    setPendingYouTube([]);
    setYoutubeUrl('');
  };

  // Handle file drops
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');

      if (!isVideo && !isAudio) {
        continue;
      }

      const pendingId = `pending_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Add to pending list
      setPendingMedia(prev => [...prev, {
        id: pendingId,
        file,
        name: file.name,
        type: isVideo ? 'video' : 'audio',
        status: 'uploading',
        progress: 'Uploading...'
      }]);

      // Start transcription
      try {
        setPendingMedia(prev => prev.map(m =>
          m.id === pendingId ? { ...m, status: 'transcribing', progress: 'Transcribing...' } : m
        ));

        const result = await processUploadedFile(file);

        if (result.success && result.transcription) {
          const mediaFile: OfferMediaFile = {
            id: pendingId,
            name: file.name,
            url: '', // We don't store the file, just the transcript
            type: isVideo ? 'video' : 'audio',
            transcript: result.transcription,
            word_count: countWords(result.transcription),
            created_at: new Date().toISOString()
          };

          // Add to form data
          setFormData(prev => ({
            ...prev,
            media_files: [...prev.media_files, mediaFile]
          }));

          // Update pending status
          setPendingMedia(prev => prev.map(m =>
            m.id === pendingId ? { ...m, status: 'done', transcript: result.transcription } : m
          ));
        } else {
          setPendingMedia(prev => prev.map(m =>
            m.id === pendingId ? { ...m, status: 'error', error: result.error || 'Transcription failed' } : m
          ));
        }
      } catch (err) {
        console.error('Transcription error:', err);
        setPendingMedia(prev => prev.map(m =>
          m.id === pendingId ? { ...m, status: 'error', error: err instanceof Error ? err.message : 'Transcription failed' } : m
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
    multiple: true
  });

  // Handle YouTube URL
  const handleAddYouTube = async () => {
    if (!youtubeUrl.trim()) return;

    const pendingId = `yt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    setPendingYouTube(prev => [...prev, {
      id: pendingId,
      url: youtubeUrl,
      status: 'fetching'
    }]);
    setIsFetchingYouTube(true);

    try {
      const result = await fetchYouTubeTranscript(youtubeUrl);

      if (result.success && result.transcript) {
        const ytTranscript: OfferYouTubeTranscript = {
          id: pendingId,
          url: youtubeUrl,
          title: result.title || null,
          transcript: result.transcript,
          word_count: countWords(result.transcript),
          created_at: new Date().toISOString()
        };

        // Add to form data
        setFormData(prev => ({
          ...prev,
          youtube_transcripts: [...prev.youtube_transcripts, ytTranscript]
        }));

        // Update pending status
        setPendingYouTube(prev => prev.map(yt =>
          yt.id === pendingId ? { ...yt, status: 'done', title: result.title, transcript: result.transcript } : yt
        ));
      } else {
        setPendingYouTube(prev => prev.map(yt =>
          yt.id === pendingId ? { ...yt, status: 'error', error: result.error || 'Failed to fetch transcript' } : yt
        ));
      }
    } catch (err) {
      console.error('YouTube transcript error:', err);
      setPendingYouTube(prev => prev.map(yt =>
        yt.id === pendingId ? { ...yt, status: 'error', error: err instanceof Error ? err.message : 'Failed to fetch transcript' } : yt
      ));
    } finally {
      setIsFetchingYouTube(false);
      setYoutubeUrl('');
    }
  };

  // Remove media file
  const removeMediaFile = (id: string) => {
    setFormData(prev => ({
      ...prev,
      media_files: prev.media_files.filter(m => m.id !== id)
    }));
    setPendingMedia(prev => prev.filter(m => m.id !== id));
  };

  // Remove YouTube transcript
  const removeYouTubeTranscript = (id: string) => {
    setFormData(prev => ({
      ...prev,
      youtube_transcripts: prev.youtube_transcripts.filter(yt => yt.id !== id)
    }));
    setPendingYouTube(prev => prev.filter(yt => yt.id !== id));
  };

  // Calculate aggregated content preview
  const aggregatedContent = aggregateOfferContent({
    offer_content: formData.offer_content,
    media_files: formData.media_files,
    youtube_transcripts: formData.youtube_transcripts
  });
  const totalWordCount = countWords(aggregatedContent);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Offer name is required');
      return;
    }

    // Check if any media is still processing
    const hasProcessing = pendingMedia.some(m => m.status === 'uploading' || m.status === 'transcribing') ||
                          pendingYouTube.some(yt => yt.status === 'fetching');
    if (hasProcessing) {
      setError('Please wait for all media to finish processing');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (editingOffer) {
        // Update existing offer
        const result = await updateAffiliateOffer(editingOffer.id, {
          name: formData.name,
          niche: formData.niche,
          offer_content: formData.offer_content,
          media_files: formData.media_files,
          youtube_transcripts: formData.youtube_transcripts
        });
        if (result.success) {
          await loadOffers();
          closeForm();
        } else {
          setError(result.error || 'Failed to update offer');
        }
      } else {
        // Create new offer
        const result = await createAffiliateOffer({
          name: formData.name,
          niche: formData.niche,
          offer_content: formData.offer_content,
          media_files: formData.media_files,
          youtube_transcripts: formData.youtube_transcripts
        });
        if (result.success) {
          await loadOffers();
          closeForm();
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

  const confirmDelete = (offer: AffiliateOffer) => {
    setOfferToDelete(offer);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!offerToDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteAffiliateOffer(offerToDelete.id);
      if (result.success) {
        await loadOffers();
        setDeleteConfirmOpen(false);
        setOfferToDelete(null);
      } else {
        setError(result.error || 'Failed to delete offer');
      }
    } catch (err) {
      setError('An error occurred while deleting');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to get content summary for offer card
  const getOfferContentSummary = (offer: AffiliateOffer) => {
    const parts: string[] = [];
    if (offer.offer_content) parts.push('Text');
    if (offer.media_files?.length) parts.push(`${offer.media_files.length} media`);
    if (offer.youtube_transcripts?.length) parts.push(`${offer.youtube_transcripts.length} YouTube`);
    return parts.length > 0 ? parts.join(' + ') : 'No content';
  };

  return (
    <StandardToolPage
      icon={FileText}
      title="Manage Affiliate Offers"
      description="Add, edit, and delete affiliate offers for script generation"
      iconGradient="bg-primary"
      toolName="Manage Offers"
    >
      <div className="h-full overflow-auto p-4 lg:p-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/script-generator')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Script Generator
          </Button>

          <Button onClick={openCreateForm} className="gap-2">
            <Plus className="w-4 h-4" />
            Add New Offer
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-400">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-auto"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        ) : (
          /* Offers Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <Card key={offer.id} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg text-white line-clamp-1">
                      {offer.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditForm(offer)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="w-4 h-4 text-zinc-400 hover:text-white" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDelete(offer)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-400" />
                      </Button>
                    </div>
                  </div>
                  {offer.niche && (
                    <span className="inline-block px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                      {offer.niche}
                    </span>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-400 line-clamp-2">
                    {offer.offer_content || 'No description'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                    <span>{getOfferContentSummary(offer)}</span>
                    {offer.aggregated_content && (
                      <span className="text-primary">
                        ({countWords(offer.aggregated_content)} words)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-600 mt-1">
                    Created: {new Date(offer.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}

            {offers.length === 0 && (
              <div className="col-span-full text-center py-12">
                <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-500 mb-4">No offers yet. Add your first offer to get started.</p>
                <Button onClick={openCreateForm} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add New Offer
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingOffer ? 'Edit Offer' : 'Add New Offer'}
              </DialogTitle>
              <DialogDescription>
                {editingOffer
                  ? 'Update the offer details below.'
                  : 'Fill in the details for your new affiliate offer. Add text, upload media for transcription, or fetch YouTube transcripts.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Offer Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Weight Loss Program XYZ"
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="niche">Niche / Category</Label>
                  <Input
                    id="niche"
                    value={formData.niche}
                    onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                    placeholder="e.g., Health & Wellness"
                    className="bg-background border-border"
                  />
                </div>
              </div>

              {/* Text Content */}
              <div className="space-y-2">
                <Label htmlFor="offer_content">Manual Text Content</Label>
                <Textarea
                  id="offer_content"
                  value={formData.offer_content}
                  onChange={(e) => setFormData({ ...formData, offer_content: e.target.value })}
                  placeholder="Paste sales page copy, product descriptions, benefits, testimonials, etc."
                  className="min-h-[120px] bg-background border-border resize-none"
                />
              </div>

              {/* Media Upload Zone */}
              <div className="space-y-2">
                <Label>Upload Video/Audio for Transcription</Label>
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                    isDragActive ? "border-primary bg-primary/10" : "border-zinc-700 hover:border-zinc-500"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">
                    {isDragActive ? "Drop files here..." : "Drag & drop video/audio files, or click to browse"}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Supports MP4, MOV, MP3, WAV, etc.
                  </p>
                </div>

                {/* Pending/Completed Media Files */}
                {(pendingMedia.length > 0 || formData.media_files.length > 0) && (
                  <div className="space-y-2 mt-3">
                    {pendingMedia.filter(m => m.status !== 'done').map(media => (
                      <div key={media.id} className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg">
                        {media.type === 'video' ? (
                          <Video className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Music className="w-5 h-5 text-purple-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{media.name}</p>
                          <p className={cn(
                            "text-xs",
                            media.status === 'error' ? "text-red-400" : "text-zinc-500"
                          )}>
                            {media.status === 'error' ? media.error : media.progress}
                          </p>
                        </div>
                        {(media.status === 'uploading' || media.status === 'transcribing') && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        )}
                        {media.status === 'error' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMediaFile(media.id)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="w-4 h-4 text-zinc-400" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {formData.media_files.map(media => (
                      <div key={media.id} className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg">
                        {media.type === 'video' ? (
                          <Video className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Music className="w-5 h-5 text-purple-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{media.name}</p>
                          <p className="text-xs text-green-400">
                            <Check className="w-3 h-3 inline mr-1" />
                            Transcribed ({media.word_count} words)
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMediaFile(media.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-4 h-4 text-zinc-400 hover:text-red-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* YouTube URL Input */}
              <div className="space-y-2">
                <Label>Add YouTube Video Transcript</Label>
                <div className="flex gap-2">
                  <Input
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="bg-background border-border flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddYouTube();
                      }
                    }}
                  />
                  <Button
                    onClick={handleAddYouTube}
                    disabled={!youtubeUrl.trim() || isFetchingYouTube}
                    className="gap-2"
                  >
                    {isFetchingYouTube ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Youtube className="w-4 h-4" />
                    )}
                    Get Transcript
                  </Button>
                </div>

                {/* Pending/Completed YouTube Transcripts */}
                {(pendingYouTube.length > 0 || formData.youtube_transcripts.length > 0) && (
                  <div className="space-y-2 mt-3">
                    {pendingYouTube.filter(yt => yt.status !== 'done').map(yt => (
                      <div key={yt.id} className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg">
                        <Youtube className="w-5 h-5 text-red-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{yt.url}</p>
                          <p className={cn(
                            "text-xs",
                            yt.status === 'error' ? "text-red-400" : "text-zinc-500"
                          )}>
                            {yt.status === 'error' ? yt.error : 'Fetching transcript...'}
                          </p>
                        </div>
                        {yt.status === 'fetching' && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        )}
                        {yt.status === 'error' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeYouTubeTranscript(yt.id)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="w-4 h-4 text-zinc-400" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {formData.youtube_transcripts.map(yt => (
                      <div key={yt.id} className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg">
                        <Youtube className="w-5 h-5 text-red-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{yt.title || yt.url}</p>
                          <p className="text-xs text-green-400">
                            <Check className="w-3 h-3 inline mr-1" />
                            Transcript fetched ({yt.word_count} words)
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeYouTubeTranscript(yt.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-4 h-4 text-zinc-400 hover:text-red-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Content Aggregation Preview */}
              {totalWordCount > 0 && (
                <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <FileAudio className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium text-white">Content Summary</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">{totalWordCount.toLocaleString()}</p>
                      <p className="text-xs text-zinc-500">Total Words</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {formData.media_files.length + formData.youtube_transcripts.length}
                      </p>
                      <p className="text-xs text-zinc-500">Transcriptions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {(formData.offer_content ? 1 : 0) + formData.media_files.length + formData.youtube_transcripts.length}
                      </p>
                      <p className="text-xs text-zinc-500">Content Sources</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-3 text-center">
                    All content will be combined and used to generate high-quality scripts
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeForm} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingOffer ? 'Update Offer' : 'Create Offer'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-[400px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-white">Delete Offer</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{offerToDelete?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </StandardToolPage>
  );
}
