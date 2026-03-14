'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, AlertTriangle, Camera, Sparkles, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { ImageAnalysis } from '@/types/reelestate';

interface PhotoGridProps {
  photos: string[];
  analyses: ImageAnalysis[];
  selectedIndices: number[];
  onSelectionChange: (indices: number[]) => void;
  onCleanupPhoto?: (index: number) => void;
  cleaningIndices?: number[];
  disabled?: boolean;
}

export function PhotoGrid({
  photos,
  analyses,
  selectedIndices,
  onSelectionChange,
  onCleanupPhoto,
  cleaningIndices = [],
  disabled,
}: PhotoGridProps) {
  const downloadPhoto = useCallback(async (url: string, index: number) => {
    try {
      // Use proxy for external URLs (Zillow etc. block CORS)
      const isExternal = url.startsWith('http');
      const fetchUrl = isExternal
        ? `/api/reelestate/proxy-image?url=${encodeURIComponent(url)}`
        : url;
      const res = await fetch(fetchUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `photo-${index + 1}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error(`Failed to download photo ${index + 1}`);
    }
  }, []);

  const downloadAll = useCallback(async () => {
    const indices = selectedIndices.length > 0 ? selectedIndices : photos.map((_, i) => i);
    toast.info(`Downloading ${indices.length} photos...`);
    for (const i of indices) {
      await downloadPhoto(photos[i], i);
    }
  }, [photos, selectedIndices, downloadPhoto]);

  const toggleSelection = (index: number) => {
    if (disabled) return;
    if (selectedIndices.includes(index)) {
      onSelectionChange(selectedIndices.filter(i => i !== index));
    } else {
      onSelectionChange([...selectedIndices, index]);
    }
  };

  const selectAll = () => {
    const usable = analyses.filter(a => a.is_usable).map(a => a.index);
    onSelectionChange(usable);
  };

  const selectNone = () => onSelectionChange([]);

  return (
    <div className="space-y-3">
      {analyses.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll} disabled={disabled}>
            Select All Usable
          </Button>
          <Button variant="outline" size="sm" onClick={selectNone} disabled={disabled}>
            Deselect All
          </Button>
          <span className="text-sm text-muted-foreground ml-auto mr-2">
            {selectedIndices.length}/{photos.length} selected
          </span>
          <Button variant="outline" size="sm" onClick={downloadAll} disabled={disabled}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Download {selectedIndices.length > 0 ? `(${selectedIndices.length})` : 'All'}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {photos.map((url, index) => {
          const analysis = analyses.find(a => a.index === index);
          const isSelected = selectedIndices.includes(index);
          const hasIssues = analysis?.issues && analysis.issues.length > 0;
          const isCleaning = cleaningIndices.includes(index);

          return (
            <button
              key={index}
              type="button"
              onClick={() => toggleSelection(index)}
              disabled={disabled || isCleaning}
              className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all group ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-transparent hover:border-muted-foreground/30'
              } ${disabled || isCleaning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <img
                src={url}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Cleaning overlay */}
              {isCleaning && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1.5">
                    <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    <span className="text-xs text-white font-medium">Cleaning...</span>
                  </div>
                </div>
              )}

              {/* Selection indicator */}
              {isSelected && !isCleaning && (
                <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Cleanup button */}
              {analysis?.cleanup_needed && onCleanupPhoto && !isCleaning && (
                <div
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 text-[10px] px-2 bg-amber-600 hover:bg-amber-500 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCleanupPhoto(index);
                    }}
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Clean
                  </Button>
                </div>
              )}

              {/* Analysis badges */}
              {analysis && !isCleaning && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      {analysis.room_type.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      <Camera className="w-2.5 h-2.5 mr-0.5" />
                      {analysis.camera_motion.replace(/_/g, ' ')}
                    </Badge>
                    {hasIssues && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                        <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                        {analysis.issues.length}
                      </Badge>
                    )}
                    {analysis.cleanup_needed && (
                      <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-600">
                        <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                        Cleanup
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Quality score + download */}
              {analysis && !isCleaning && (
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {!analysis.cleanup_needed && (
                    <Badge
                      variant={analysis.quality_score >= 7 ? 'default' : analysis.quality_score >= 4 ? 'secondary' : 'destructive'}
                      className="text-[10px] px-1 py-0 h-4"
                    >
                      Q:{analysis.quality_score}/10
                    </Badge>
                  )}
                  <button
                    type="button"
                    className="w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadPhoto(url, index);
                    }}
                  >
                    <Download className="w-3 h-3 text-white" />
                  </button>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
