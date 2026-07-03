'use client';

import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CloneProject } from '@/types/clone-studio';
import { SceneCard } from './scene-card';

interface SceneBoardProps {
  project: CloneProject;
  onProjectUpdate: (project: CloneProject) => void;
  onBack: () => void;
}

export function SceneBoard({ project, onProjectUpdate, onBack }: SceneBoardProps) {
  const [showSummary, setShowSummary] = useState(false);
  const summary = project.analysis_summary;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 space-y-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-zinc-400 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> All projects
          </Button>
          <h3 className="text-xl font-bold text-white">{project.title || 'Untitled clone'}</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{project.source_platform}</Badge>
            <Badge variant="secondary">{Math.round(project.video_duration_seconds || 0)}s</Badge>
            <Badge variant="secondary">{project.scenes.length} scenes</Badge>
            <Badge variant="secondary">{project.aspect_ratio}</Badge>
            <Badge variant="secondary">{project.credits_spent} credits spent</Badge>
          </div>
        </div>
        {project.source_video_url && (
          <video
            src={project.source_video_url}
            controls
            preload="metadata"
            className="w-full lg:w-64 rounded-lg border border-border/50 bg-black"
          />
        )}
      </div>

      {/* How it works */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex gap-3 text-sm text-zinc-300">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-white">How to clone:</span> for each scene, tell it
            what to swap (&quot;replace the man with the woman in my reference photo&quot;), upload your
            reference images, and generate until the frame looks right. Use the <span className="text-white">same
            2–3 photos of your person in every scene</span> so they stay consistent. Animation comes
            after your images are approved.
          </div>
        </div>
      </Card>

      {/* Analysis summary */}
      {summary && (
        <Card className="p-4">
          <button
            className="w-full flex items-center justify-between text-sm font-medium text-white"
            onClick={() => setShowSummary((v) => !v)}
          >
            <span>Ad breakdown (AI analysis)</span>
            {showSummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showSummary && (
            <div className="mt-3 space-y-3 text-sm text-zinc-300">
              <p>{summary.summary}</p>
              {summary.characters.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-zinc-400 uppercase">Characters</p>
                  {summary.characters.map((c) => (
                    <p key={c.id} className="text-xs">
                      <span className="text-white font-medium">{c.id}:</span> {c.description}
                    </p>
                  ))}
                </div>
              )}
              {summary.products.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {summary.products.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                  ))}
                </div>
              )}
              {summary.visual_style && (
                <p className="text-xs text-zinc-400"><span className="font-semibold">Style:</span> {summary.visual_style}</p>
              )}
              {summary.music_brief && (
                <p className="text-xs text-zinc-400"><span className="font-semibold">Music:</span> {summary.music_brief}</p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Scene cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {project.scenes.map((scene) => (
          <SceneCard
            key={scene.n}
            project={project}
            scene={scene}
            onProjectUpdate={onProjectUpdate}
          />
        ))}
      </div>
    </div>
  );
}
