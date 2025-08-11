'use client';

import { 
  Upload,
  CheckCircle,
  History,
} from 'lucide-react';
import { XIcon, InstagramIcon, TikTokIcon, LinkedInIcon, FacebookIcon } from '../components/brand-icons';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';

interface TabEmptyStatesProps {
  activeTab: string;
}

/**
 * Tab Empty States Component
 * Shows appropriate empty state for each tab
 */
export function TabEmptyStates({ activeTab }: TabEmptyStatesProps) {
  const emptyStates = {
    input: {
      icon: Upload,
      title: 'Ready to Create Magic ✨',
      description: 'Add your content and select platforms to get started'
    },
    twitter: {
      icon: XIcon,
      title: 'Twitter/X Content',
      description: 'Generate content to see Twitter/X optimization'
    },
    instagram: {
      icon: InstagramIcon,
      title: 'Instagram Content',
      description: 'Generate content to see Instagram optimization'
    },
    tiktok: {
      icon: TikTokIcon,
      title: 'TikTok Content',
      description: 'Generate content to see TikTok optimization'
    },
    linkedin: {
      icon: LinkedInIcon,
      title: 'LinkedIn Content',
      description: 'Generate content to see LinkedIn optimization'
    },
    facebook: {
      icon: FacebookIcon,
      title: 'Facebook Content',
      description: 'Generate content to see Facebook optimization'
    },
    review: {
      icon: CheckCircle,
      title: 'Review All Platforms',
      description: 'Generate content to review all platforms'
    },
    history: {
      icon: History,
      title: 'Content History',
      description: 'Your past content variants will appear here'
    },
  };

  const state = emptyStates[activeTab as keyof typeof emptyStates] || emptyStates.input;

  return (
    <UnifiedEmptyState
      icon={state.icon}
      title={state.title}
      description={state.description}
    />
  );
}