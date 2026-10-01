'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { uploadCloneReference, updateProjectReferences } from '@/actions/tools/clone-studio';
import type { CloneProject } from '@/types/clone-studio';

/** Photos the client adds by hand; the board can hold a few more that the director made. */
const CLIENT_PHOTOS = 6;

interface ProjectPhotosProps {
  project: CloneProject;
  onProjectUpdate: (project: CloneProject) => void;
}

/**
 * The board's photos: the client's person, product, place and logo. They are used in every
 * scene automatically (a scene can leave one out on its card), so everyone stays consistent.
 */
export function ProjectPhotos({ project, onProjectUpdate }: ProjectPhotosProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const photos = project.analysis_summary?.project_ref_urls || [];
  const locked = project.status === 'directing';

  const add = async (files: FileList | null) => {
    const slots = Math.max(0, CLIENT_PHOTOS - photos.length);
    const selected = Array.from(files || [])
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, slots);
    if (!selected.length || locked) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        const up = await uploadCloneReference(project.id, file);
        if (up.success && up.url) uploaded.push(up.url);
        else toast.error(up.error || `Upload failed for ${file.name}`);
      }
      if (uploaded.length) {
        const result = await updateProjectReferences(project.id, [...photos, ...uploaded]);
        if (result.success && result.project) onProjectUpdate(result.project);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (url: string) => {
    const result = await updateProjectReferences(project.id, photos.filter((u) => u !== url));
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  return (
    <div
      className={`flex items-center gap-2 flex-wrap rounded-md transition-colors ${dragOver ? 'ring-2 ring-primary bg-primary/10 p-1.5' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void add(e.dataTransfer.files);
      }}
    >
      {photos.map((url) => (
        <div key={url} className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Project reference" className="w-14 h-14 object-cover rounded border border-border/50" />
          {!locked && (
            <button className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white hidden group-hover:flex items-center justify-center" onClick={() => remove(url)}>
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      ))}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
      <Button variant="outline" size="sm" className="h-14" onClick={() => inputRef.current?.click()} disabled={uploading || locked || photos.length >= CLIENT_PHOTOS}>
        {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1.5" />}
        Add photos
      </Button>
      <span className="text-[10px] text-zinc-600">or drag &amp; drop images here</span>
    </div>
  );
}
