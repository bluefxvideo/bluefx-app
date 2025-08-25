'use client';

import { History } from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';

export function HistoryOutput() {
  const renderEmpty = () => (
    <div className="flex items-center justify-center h-full">
      <UnifiedEmptyState
        icon={History}
        title="No Ebook History"
        description="Your created ebooks will appear here. Start by creating your first ebook."
      />
    </div>
  );

  return (
    <OutputPanelShell
      title="Ebook History"
      status="idle"
      empty={renderEmpty()}
    >
      {/* History content will be implemented here */}
    </OutputPanelShell>
  );
}