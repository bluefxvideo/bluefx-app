'use client';

import { EbookOutput } from './ebook-output';
import { TitleOutput } from './title-output';
import { HistoryOutput } from './history-output';
import { TopicPreview } from './topic-preview';
import { OutlineOutput } from './outline-output';
import { ContentOutput } from './content-output';
import { CoverOutput } from './cover-output';
import type { EbookMetadata, TitleOptions } from '../store/ebook-writer-store';
import type { UploadedDocument } from '@/actions/tools/ebook-document-handler';
import type { EbookHistoryFilters } from '../tabs/ebook-history-filters';

interface ContextualOutputProps {
  activeTab: string;
  ebook: EbookMetadata | null;
  titleOptions: TitleOptions | null;
  isGenerating: boolean;
  topic?: string;
  uploadedDocuments?: UploadedDocument[];
  historyFilters?: EbookHistoryFilters;
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
  uploadedDocuments = [],
  historyFilters
}: ContextualOutputProps) {

  switch (activeTab) {
    case 'history':
      return <HistoryOutput filters={historyFilters} />;
    
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
          topic={topic}
          ebook={ebook}
          uploadedDocuments={uploadedDocuments}
        />
      );
    
    case 'outline':
      return (
        <OutlineOutput
          ebook={ebook}
          uploadedDocuments={uploadedDocuments}
        />
      );
    
    case 'content':
      return (
        <ContentOutput
          ebook={ebook}
        />
      );
    
    case 'cover':
      return (
        <CoverOutput
          ebook={ebook}
        />
      );
    
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