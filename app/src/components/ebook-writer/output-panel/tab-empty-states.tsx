'use client';

import { Card, CardContent } from '@/components/ui/card';
import { 
  BookOpen, 
  Type, 
  List, 
  FileText, 
  Image, 
  Download, 
  History,
  Sparkles 
} from 'lucide-react';

export function TabEmptyStates({ activeTab }: { activeTab: string }) {
  const emptyStateConfig = {
    topic: {
      icon: BookOpen,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Choose a topic to start generating your comprehensive ebook with AI assistance.'
    },
    title: {
      icon: Type,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'AI will create compelling title options based on your topic, or you can write your own.'
    },
    outline: {
      icon: List,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Create a structured chapter outline that will guide your ebook\'s content generation.'
    },
    content: {
      icon: FileText,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Generate detailed content for each chapter and section of your ebook.'
    },
    cover: {
      icon: Image,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Create a professional book cover that attracts readers and represents your content.'
    },
    export: {
      icon: Download,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Download your completed ebook in various formats for distribution.'
    },
    history: {
      icon: History,
      gradient: 'from-gray-500 to-gray-600',
      description: 'View, edit, and manage all your previously created ebooks.'
    }
  };

  const config = emptyStateConfig[activeTab as keyof typeof emptyStateConfig] || emptyStateConfig.topic;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${config.gradient} flex items-center justify-center mb-4`}>
        <config.icon className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground max-w-md">
        {config.description}
      </p>
    </div>
  );
}