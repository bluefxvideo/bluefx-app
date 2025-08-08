'use client';

import { Card, CardContent } from '@/components/ui/card';
import { 
  Upload,
  CheckCircle,
  History,
} from 'lucide-react';
import { XIcon, InstagramIcon, TikTokIcon, LinkedInIcon, FacebookIcon } from '../components/brand-icons';

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
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Add your content and select platforms to get started'
    },
    twitter: {
      icon: XIcon,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Generate content to see Twitter/X optimization'
    },
    instagram: {
      icon: InstagramIcon,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Generate content to see Instagram optimization'
    },
    tiktok: {
      icon: TikTokIcon,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Generate content to see TikTok optimization'
    },
    linkedin: {
      icon: LinkedInIcon,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Generate content to see LinkedIn optimization'
    },
    facebook: {
      icon: FacebookIcon,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Generate content to see Facebook optimization'
    },
    review: {
      icon: CheckCircle,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Generate content to review all platforms'
    },
    history: {
      icon: History,
      gradient: 'from-gray-500 to-gray-600',
      description: 'Your past content variants will appear here'
    },
  };

  const state = emptyStates[activeTab as keyof typeof emptyStates] || emptyStates.input;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${state.gradient} flex items-center justify-center mb-4`}>
        <state.icon className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground max-w-md">
        {state.description}
      </p>
    </div>
  );
}