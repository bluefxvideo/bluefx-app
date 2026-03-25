'use client';

import { useState, useRef } from 'react';
import { Film, Upload, Plus, X, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const MAX_REFERENCE_IMAGES = 14;

export interface AnalyzerToAIPayload {
  analysisText: string;
  customizationInstructions: string;
  referenceImages: Array<{ dataUrl: string; name: string; type: string }>;
  aspectRatio: '9:16' | '16:9';
  productFidelityEnabled: boolean;
  sourceVideoUrl?: string;
}

interface SendToAIPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisText: string;
  sourceVideoUrl?: string;
}

export function SendToAIPanel({ open, onOpenChange, analysisText, sourceVideoUrl }: SendToAIPanelProps) {
  const [customization, setCustomization] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [productFidelity, setProductFidelity] = useState(true);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newImages: { file: File; preview: string }[] = [];
    const remainingSlots = MAX_REFERENCE_IMAGES - images.length;
    for (let i = 0; i < Math.min(fileArray.length, remainingSlots); i++) {
      const file = fileArray[i];
      if (file.type.startsWith('image/')) {
        newImages.push({ file, preview: URL.createObjectURL(file) });
      }
    }
    if (newImages.length > 0) {
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      // Convert images to data URLs for localStorage
      const serializedImages: Array<{ dataUrl: string; name: string; type: string }> = [];
      for (const img of images) {
        const dataUrl = await fileToDataUrl(img.file);
        serializedImages.push({ dataUrl, name: img.file.name, type: img.file.type });
      }

      const payload: AnalyzerToAIPayload = {
        analysisText,
        customizationInstructions: customization.trim(),
        referenceImages: serializedImages,
        aspectRatio,
        productFidelityEnabled: productFidelity,
        sourceVideoUrl: sourceVideoUrl || undefined,
      };

      const analysisId = `video-analysis-${Date.now()}`;
      localStorage.setItem(analysisId, JSON.stringify(payload));
      window.open(`/dashboard/ai-recreate?analysisId=${analysisId}`, '_blank');
      onOpenChange(false);
      toast.success('Sent to AI Recreate');
    } catch {
      toast.error('Failed to prepare data. Try with fewer images.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            Send to AI Recreate
          </DialogTitle>
          <DialogDescription>
            Configure your product details and preferences before generating the storyboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Analysis Preview */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Analysis Preview</label>
            <div className="p-3 bg-secondary/30 rounded-lg border border-border/30 text-zinc-400 text-sm max-h-[80px] overflow-hidden relative">
              {analysisText.slice(0, 300)}
              {analysisText.length > 300 && (
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-secondary/80 to-transparent" />
              )}
            </div>
          </div>

          {/* Customization Instructions */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Customization Instructions</label>
            <Textarea
              placeholder="e.g., Replace the product with my own product. Change the language to English. Don't mention ashwagandha — my product only contains magnesium glycinate..."
              value={customization}
              onChange={(e) => setCustomization(e.target.value)}
              className="min-h-[100px] resize-y"
            />
            <p className="text-xs text-zinc-500 mt-1">
              These instructions will be applied when generating the storyboard scenes.
            </p>
          </div>

          {/* Product / Reference Images */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Product / Reference Images
            </label>
            <div
              ref={dropZoneRef}
              className={`p-3 rounded-lg transition-colors ${
                isDragging ? 'bg-primary/10 border-2 border-dashed border-primary' : 'border-2 border-dashed border-border/50'
              }`}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
              onDragLeave={(e) => {
                e.preventDefault(); e.stopPropagation();
                if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) setIsDragging(false);
              }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation(); setIsDragging(false);
                if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
              }}
            >
              {isDragging ? (
                <div className="flex items-center justify-center py-4 text-primary font-medium">
                  <Upload className="w-5 h-5 mr-2" />
                  Drop images here
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {images.map((img, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted/30 group">
                      <img src={img.preview} alt={`Reference ${index + 1}`} className="w-full h-full object-cover" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-0.5 right-0.5 h-5 w-5 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {images.length < MAX_REFERENCE_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 flex flex-col items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Add</span>
                    </button>
                  )}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }} className="hidden" />
              <p className="text-xs text-zinc-500 mt-2">
                {images.length > 0
                  ? `${images.length} image${images.length > 1 ? 's' : ''} — will be pre-loaded into all storyboard batches`
                  : 'Upload your product images so the AI uses them in every scene'}
              </p>
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Aspect Ratio</label>
            <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as '9:16' | '16:9')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">9:16 — Vertical (TikTok / Reels)</SelectItem>
                <SelectItem value="16:9">16:9 — Horizontal (YouTube)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Product Fidelity */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="product-fidelity"
              checked={productFidelity}
              onCheckedChange={(checked) => setProductFidelity(checked === true)}
              className="mt-0.5"
            />
            <div>
              <label htmlFor="product-fidelity" className="text-sm font-medium text-zinc-300 cursor-pointer">
                Enforce product appearance from reference image
              </label>
              <p className="text-xs text-zinc-500 mt-0.5">
                The AI will use your uploaded image as the source of truth for product appearance — ignoring any color or shape descriptions in the original video analysis.
              </p>
            </div>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={isSending}
            className="w-full h-11"
            size="lg"
          >
            <Film className="w-4 h-4 mr-2" />
            {isSending ? 'Preparing...' : 'Send to AI Recreate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
