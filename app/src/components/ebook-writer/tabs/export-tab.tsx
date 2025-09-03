'use client';

import type { EbookMetadata } from '../store/ebook-writer-store';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { GoogleDocsConnection } from '../components/google-docs-connection';
import { TabContentWrapper, TabBody } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { SharedEbookEmptyState } from '../components/shared-empty-state';
import { Download } from 'lucide-react';

interface ExportTabProps {
  ebook: EbookMetadata | null;
  isGenerating: boolean;
  error?: string;
}

export function ExportTab({ ebook, isGenerating, error }: ExportTabProps) {
  const { setActiveTab } = useEbookWriterStore();

  // Check what step we need to go back to
  if (!ebook?.topic) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Download}
            title="No Topic Selected"
            backTo="topic"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  if (!ebook?.title) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Download}
            title="No Title Selected"
            backTo="title"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  if (!ebook?.outline) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Download}
            title="No Outline Created"
            backTo="outline"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }

  // Check if content is generated
  const hasContent = ebook?.outline?.chapters?.some(chapter => chapter.content && chapter.content.trim() !== '');
  
  if (!hasContent) {
    return (
      <TabContentWrapper>
        <TabBody>
          <SharedEbookEmptyState
            icon={Download}
            title="No Content Generated"
            backTo="content"
          />
        </TabBody>
      </TabContentWrapper>
    );
  }
  
  // Convert ebook format for Google Docs export
  const convertedEbook = ebook && ebook.outline ? {
    title: ebook.title,
    author: ebook.cover?.author_name || '', // Get from cover settings
    chapters: ebook.outline.chapters.map(chapter => ({
      title: chapter.title,
      content: chapter.content || 'Chapter content will be generated here...'
    })),
    cover: ebook.cover ? {
      image_url: ebook.cover.image_url
    } : undefined
  } : null;

  return (
    <TabContentWrapper>
      <TabBody>
        <StandardStep
          stepNumber={1}
          title="Export to Google Docs"
          description="Save your ebook directly to Google Docs for easy editing and sharing"
        >
          <GoogleDocsConnection 
            ebook={convertedEbook}
          />
        </StandardStep>
      </TabBody>
    </TabContentWrapper>
  );
}