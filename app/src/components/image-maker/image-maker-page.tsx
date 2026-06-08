'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ImagePlus, Sparkles, Loader2, Download, AlertCircle, Upload, X, Wand2, History } from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';
import { generateImage, getImageHistory, type ImageHistoryItem } from '@/actions/tools/image-maker';
import { uploadImageToStorage } from '@/actions/supabase-storage';

type AspectRatio = 'auto' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9';
type Resolution = '1K' | '2K' | '4K';

const ASPECTS: AspectRatio[] = ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'];
const RESOLUTIONS: Resolution[] = ['1K', '2K', '4K'];
const COUNTS = [1, 2, 3, 4];
const COST: Record<Resolution, number> = { '1K': 2, '2K': 3, '4K': 6 };
const MAX_REFS = 14;

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
        active ? 'bg-primary text-white border-primary' : 'bg-card text-zinc-400 border-border hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function DownloadableImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  return (
    <div className={cn('group relative rounded-xl overflow-hidden border border-border bg-card', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="w-full h-full object-cover" />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-lg p-2"
        aria-label="Download image"
      >
        <Download className="w-4 h-4" />
      </a>
    </div>
  );
}

function HistoryView() {
  const [items, setItems] = useState<ImageHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getImageHistory().then((res) => {
      if (res.success && res.items) setItems(res.items);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const allImages = items.flatMap((it) => (it.image_urls || []).map((url) => ({ url, prompt: it.prompt })));

  if (allImages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
        <History className="w-10 h-10" />
        <p className="text-sm">No images yet — generate your first one.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {allImages.map((img, i) => (
          <DownloadableImage key={i} url={img.url} alt={img.prompt || `Image ${i + 1}`} className="aspect-square" />
        ))}
      </div>
    </div>
  );
}

export function ImageMakerPage() {
  const pathname = usePathname();
  const activeTab = pathname.includes('/history') ? 'history' : 'generate';

  const { refetch } = useCredits();
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<AspectRatio>('1:1');
  const [resolution, setResolution] = useState<Resolution>('2K');
  const [count, setCount] = useState(1);

  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cost = COST[resolution] * count;
  const hasRefs = referenceImages.length > 0;

  const imageTabs = [
    { id: 'generate', label: 'Generate', icon: Wand2, path: '/dashboard/image-maker' },
    { id: 'history', label: 'History', icon: History, path: '/dashboard/image-maker/history' },
  ];

  const uploadFiles = async (files: File[]) => {
    const remaining = MAX_REFS - referenceImages.length;
    const toUpload = files.filter((f) => f.type.startsWith('image/')).slice(0, remaining);
    if (toUpload.length === 0) return;
    setIsUploadingRef(true);
    try {
      for (const file of toUpload) {
        const result = await uploadImageToStorage(file, {
          folder: 'image-maker-refs',
          contentType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
        });
        if (result.success && result.url) setReferenceImages((prev) => [...prev, result.url!]);
      }
    } finally {
      setIsUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) uploadFiles(Array.from(e.dataTransfer.files));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceImages.length]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await generateImage({
        prompt,
        aspect_ratio: aspect,
        resolution,
        num_outputs: count,
        reference_image_urls: hasRefs ? referenceImages : undefined,
      });
      if (res.success && res.image_urls?.length) {
        setImages(res.image_urls);
        refetch();
      } else {
        setError(res.error || 'Generation failed.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const inputPanel = (
    <div className="h-full flex flex-col gap-5 overflow-y-auto pr-1">
      <div>
        <label className="block text-sm font-medium mb-2">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={hasRefs ? 'Describe how to combine or edit your reference image(s)…' : 'Describe the image you want to create…'}
          rows={5}
          className="w-full rounded-lg border border-border bg-card p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Reference images <span className="text-zinc-500 font-normal">· optional, up to {MAX_REFS}</span>
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {referenceImages.map((url, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`ref ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setReferenceImages((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove reference image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {referenceImages.length < MAX_REFS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDrop={onDrop}
              className={cn(
                'w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors',
                dragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-zinc-400'
              )}
            >
              {isUploadingRef ? <Loader2 className="w-5 h-5 animate-spin text-zinc-400" /> : <Upload className="w-5 h-5 text-zinc-400" />}
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(Array.from(e.target.files))}
        />
        <p className="text-xs text-zinc-500">Add images to edit, restyle, or combine them. Leave empty for pure text-to-image.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Aspect ratio</label>
        <div className="flex flex-wrap gap-2">
          {ASPECTS.map((a) => (
            <Pill key={a} active={aspect === a} onClick={() => setAspect(a)}>{a === 'auto' ? 'Auto' : a}</Pill>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Resolution</label>
        <div className="flex flex-wrap gap-2">
          {RESOLUTIONS.map((r) => (
            <Pill key={r} active={resolution === r} onClick={() => setResolution(r)}>{r}</Pill>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Number of images</label>
        <div className="flex flex-wrap gap-2">
          {COUNTS.map((c) => (
            <Pill key={c} active={count === c} onClick={() => setCount(c)}>{c}</Pill>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-auto pt-2">
        <Button onClick={handleGenerate} disabled={!prompt.trim() || isGenerating || isUploadingRef} className="w-full h-11">
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Generate · {cost} credits</>
          )}
        </Button>
      </div>
    </div>
  );

  const outputPanel = (
    <div className="h-full">
      {isGenerating ? (
        <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Creating your image{count > 1 ? 's' : ''}…</p>
        </div>
      ) : images.length > 0 ? (
        <div className={cn('grid gap-4', images.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
          {images.map((url, i) => (
            <DownloadableImage key={i} url={url} alt={`Generated ${i + 1}`} />
          ))}
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
          <ImagePlus className="w-10 h-10" />
          <p className="text-sm">Your generated images will appear here</p>
        </div>
      )}
    </div>
  );

  return (
    <StandardToolPage
      icon={ImagePlus}
      title="Image Maker"
      description="Generate and edit AI images"
      iconGradient="bg-primary"
      toolName="Image Maker"
      tabs={<StandardToolTabs tabs={imageTabs} activeTab={activeTab} basePath="/dashboard/image-maker" />}
    >
      {activeTab === 'history' ? (
        <HistoryView />
      ) : (
        <StandardToolLayout>
          {inputPanel}
          {outputPanel}
        </StandardToolLayout>
      )}
    </StandardToolPage>
  );
}

export default ImageMakerPage;
