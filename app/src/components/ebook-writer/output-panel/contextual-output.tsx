'use client';

import { EbookOutput } from './ebook-output';
import { TitleOutput } from './title-output';
import { HistoryOutput } from './history-output';
import { TopicPreview } from './topic-preview';
import type { EbookMetadata, TitleOptions } from '../store/ebook-writer-store';
import type { UploadedDocument } from '@/actions/tools/ebook-document-handler';

interface ContextualOutputProps {
  activeTab: string;
  ebook: EbookMetadata | null;
  titleOptions: TitleOptions | null;
  isGenerating: boolean;
  topic?: string;
  uploadedDocuments?: UploadedDocument[];
}

/**
 * Contextual Output - Right panel adapts based on active tab
 * Following the proven thumbnail machine pattern
 */
export function ContextualOutput({
  activeTab,
  ebook,
  titleOptions,
  isGenerating,
  topic = '',
  uploadedDocuments = []
}: ContextualOutputProps) {

  switch (activeTab) {
    case 'history':
      return <HistoryOutput />;
    
    case 'topic':
      return (
        <TopicPreview
          topic={topic}
          documents={uploadedDocuments}
        />
      );
    
    case 'title':
      return (
        <TitleOutput
          titleOptions={titleOptions}
          isGenerating={isGenerating}
        />
      );
    
    case 'outline':
    case 'content':
    case 'cover':
    case 'export':
    default:
      return (
        <EbookOutput
          ebook={ebook}
          isGenerating={isGenerating}
          activeTab={activeTab}
        />
      );
  }
}