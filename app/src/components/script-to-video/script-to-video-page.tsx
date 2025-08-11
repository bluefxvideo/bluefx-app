'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { VideoPreview } from './panels/video-preview';
import { useScriptToVideo } from './hooks/use-script-to-video';
import { useVideoEditorStore } from './store/video-editor-store';
import { createClient } from '@/app/supabase/client';
import { FileText, Edit, History } from 'lucide-react';

// Tab content components
import { GeneratorTab } from './tabs/generator-tab';
import { VideoEditorPanel } from './panels/video-editor-panel';
import { HistoryTab } from './tabs/history-tab';
import { UserChoiceDialog } from './components/user-choice-dialog';

/**
 * Script to Video - Complete AI-Orchestrated Tool with Tabs
 * Uses uniform tool layout consistent with all BlueFX tools
 */
export function ScriptToVideoPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const initializeUser = useVideoEditorStore((state) => state.initializeUser);
  const loadExistingResults = useVideoEditorStore((state) => state.loadExistingResults);
  const {
    edit,
    isGenerating,
    isEditing,
    result,
    error,
    credits,
    clearResults
  } = useScriptToVideo();

  // Initialize user in video editor store and load existing results
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          initializeUser(user.id);
          
          // Load existing generation results if on editor tab
          if (pathname.includes('/editor')) {
            loadExistingResults(user.id);
          }
        }
      } catch (error) {
        console.error('Error loading user for video editor:', error);
      }
    };

    loadUser();
  }, [initializeUser, loadExistingResults, pathname]);

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.includes('/editor')) return 'editor';
    if (pathname.includes('/history')) return 'history';
    return 'generate'; // default
  };

  const activeTab = getActiveTab();

  // Define tabs for StandardToolTabs
  const scriptToVideoTabs = [
    {
      id: 'generate',
      label: 'Generate',
      icon: FileText,
      path: '/dashboard/script-to-video'
    },
    {
      id: 'editor',
      label: 'Editor',
      icon: Edit,
      path: '/dashboard/script-to-video/editor'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/script-to-video/history'
    }
  ];

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'editor':
        return (
          <VideoEditorPanel
            onEdit={(editData) => edit({ type: 'edit', data: editData })}
            isEditing={isEditing}
            currentComposition={result}
            credits={credits}
          />
        );
      case 'history':
        return <HistoryTab />;
      default:
        return (
          <GeneratorTab
            credits={credits}
          />
        );
    }
  };

  return (
    <StandardToolPage
      icon={FileText}
      title="Script to Video"
      description="Transform scripts into engaging videos with AI"
      iconGradient="bg-primary"
      tabs={<StandardToolTabs tabs={scriptToVideoTabs} activeTab={activeTab} basePath="/dashboard/script-to-video" />}
    >
      <StandardToolLayout>
        {/* Left Panel - Content Only */}
        <div className="h-full overflow-hidden">
          {renderTabContent()}
        </div>
        
        {/* Right Panel - Video Preview/Output */}
        <VideoPreview
          result={result}
          isGenerating={isGenerating}
          isEditing={isEditing}
          error={error}
          onClearResults={clearResults}
          activeMode={activeTab as 'generate' | 'editor'}
        />
      </StandardToolLayout>
      
      {/* User Choice Dialog - Global Modal */}
      <UserChoiceDialog />
    </StandardToolPage>
  );
}

export default ScriptToVideoPage;