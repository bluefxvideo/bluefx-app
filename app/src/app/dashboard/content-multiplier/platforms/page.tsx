'use client';

import { useEffect } from 'react';
import { useContentMultiplierStore } from '@/components/content-multiplier/store/content-multiplier-store';
import { ContentMultiplierPage } from '@/components/content-multiplier/content-multiplier-page';

export default function PlatformsPage() {
  const setActiveWorkflowTab = useContentMultiplierStore((state) => state.setActiveWorkflowTab);

  useEffect(() => {
    setActiveWorkflowTab('platforms');
  }, [setActiveWorkflowTab]);

  return <ContentMultiplierPage />;
}