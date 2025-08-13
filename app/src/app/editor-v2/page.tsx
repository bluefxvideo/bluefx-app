'use client';

import { Suspense } from 'react';
import { AIVideoEditor } from '@/components/editor-v2/ai-video-editor';

/**
 * AI-Enhanced Video Editor V2
 * Built using React Video Editor patterns with AI integration
 */
export default function EditorV2Page() {
  return (
    <div className="h-screen w-screen bg-background">
      <Suspense 
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-sm text-muted-foreground">Loading AI Video Editor...</p>
            </div>
          </div>
        }
      >
        <AIVideoEditor />
      </Suspense>
    </div>
  );
}