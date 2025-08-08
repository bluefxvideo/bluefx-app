'use client';

import { useEffect } from 'react';
import { useContentMultiplierStore } from '@/components/content-multiplier/store/content-multiplier-store';
import { ContentMultiplierPage } from '@/components/content-multiplier/content-multiplier-page';

export default function Page() {
  const setActiveWorkflowTab = useContentMultiplierStore((state) => state.setActiveWorkflowTab);

  useEffect(() => {
    setActiveWorkflowTab('content');
  }, [setActiveWorkflowTab]);

  return <ContentMultiplierPage />;
}