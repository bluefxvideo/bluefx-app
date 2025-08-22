'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { VideoPreview } from './panels/video-preview';
import { ScriptPreviewPanel } from './components/script-preview-panel';
import { ContextualOutput } from './output-panel/contextual-output';
import { useScriptToVideo } from './hooks/use-script-to-video';
import { useVideoEditorStore } from './store/video-editor-store';
import { createClient } from '@/app/supabase/client';
import { FileText, Edit, History } from 'lucide-react';
import { ReadyToCreatePanel } from './components/ready-to-create-panel';

// Tab content components
import { GeneratorTab, type MultiStepState } from './tabs/generator-tab';
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
  
  // Local state for generation progress
  const [isLocalGenerating, setIsLocalGenerating] = useState(false);
  
  // Multi-step state - shared between generator tab and preview panel
  const [multiStepState, setMultiStepState] = useState<MultiStepState>({
    currentStep: 1,
    totalSteps: 3,
    useMyScript: false,
    ideaText: '',
    generatedScript: '',
    finalScript: '',
    isGeneratingScript: false,
  });
  
  // Additional state for workflow tracking
  const [voiceSelected, setVoiceSelected] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerated, setVideoGenerated] = useState(false);

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

  // Monitor video generation completion
  useEffect(() => {
    if (result?.success && result.video_id && !videoGenerated) {
      setVideoGenerated(true);
      // Reset after 3 seconds so user can see the checkmark
      setTimeout(() => {
        setVideoGenerated(false);
      }, 3000);
    }
  }, [result, videoGenerated]);

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
            onGeneratingChange={setIsLocalGenerating}
            multiStepState={multiStepState}
            onMultiStepStateChange={setMultiStepState}
            onVoiceSelected={setVoiceSelected}
            onGeneratingVoiceChange={setIsGeneratingVoice}
            onGeneratingVideoChange={setIsGeneratingVideo}
          />
        );
    }
  };

  // Render appropriate right panel content
  const renderRightPanel = () => {
    // Show workflow progress when user has started generation
    if (activeTab === 'generate' && (multiStepState.isGeneratingScript || isGeneratingVoice || isGeneratingVideo || multiStepState.generatedScript)) {
      return (
        <ScriptPreviewPanel
          currentStep={multiStepState.currentStep}
          totalSteps={multiStepState.totalSteps}
          generatedScript={multiStepState.generatedScript}
          finalScript={multiStepState.finalScript}
          useMyScript={multiStepState.useMyScript}
          isGeneratingScript={multiStepState.isGeneratingScript}
          isGeneratingVoice={isGeneratingVoice}
          isGeneratingVideo={isGeneratingVideo}
          voiceSelected={voiceSelected}
          isEditable={true}
          onScriptEdit={(script) => {
            setMultiStepState(prev => ({ ...prev, finalScript: script }));
          }}
        />
      );
    }

    // Show welcome panel for generate tab when idle
    if (activeTab === 'generate') {
      return (
        <ReadyToCreatePanel 
          currentStep={multiStepState.currentStep}
          scriptGenerated={!!multiStepState.generatedScript || !!multiStepState.finalScript}
          voiceSelected={voiceSelected}
          isGeneratingVideo={isGeneratingVideo}
          videoGenerated={videoGenerated}
          isGeneratingScript={multiStepState.isGeneratingScript}
        />
      );
    }

    // Show contextual output for other tabs (editor, history)
    return (
      <ContextualOutput
        activeTab={activeTab}
        result={result}
        isGenerating={isGenerating || isLocalGenerating}
        isEditing={isEditing}
        error={error}
        onClearResults={clearResults}
      />
    );
  };

  return (
    <StandardToolPage
      icon={FileText}
      title="Script to Video"
      description="Transform scripts into professional video content"
      iconGradient="bg-primary"
      tabs={<StandardToolTabs tabs={scriptToVideoTabs} activeTab={activeTab} basePath="/dashboard/script-to-video" />}
    >
      <StandardToolLayout>
        {/* Left Panel - Content Only */}
        <div className="h-full overflow-hidden">
          {renderTabContent()}
        </div>
        
        {/* Right Panel - Script Preview or Video Preview */}
        {renderRightPanel()}
      </StandardToolLayout>
      
      {/* User Choice Dialog - Global Modal */}
      <UserChoiceDialog />
    </StandardToolPage>
  );
}

export default ScriptToVideoPage;