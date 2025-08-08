'use client';

import { useEffect } from 'react';
import { useContentMultiplierStore } from '@/components/content-multiplier/store/content-multiplier-store';
import { ContentMultiplierPage } from '@/components/content-multiplier/content-multiplier-page';

export default function ReviewPage() {
  const setActiveWorkflowTab = useContentMultiplierStore((state) => state.setActiveWorkflowTab);

  useEffect(() => {
    setActiveWorkflowTab('review');
  }, [setActiveWorkflowTab]);

  return <ContentMultiplierPage />;
}