'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { Card } from '@/components/ui/card';
import { VideoPreview } from './panels/video-preview';
import { ContextualOutput } from './output-panel/contextual-output';
import { HistoryOutput } from './output-panel/history-output';
import { useScriptToVideo } from './hooks/use-script-to-video';
import { useVideoEditorStore } from './store/video-editor-store';
import { createClient } from '@/app/supabase/client';
import { FileText, Edit, History } from 'lucide-react';

// Tab content components
import { GeneratorTabNew as GeneratorTab, type MultiStepState } from './tabs/generator-tab-new';
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
    totalSteps: 5,
    useMyScript: false,
    ideaText: '',
    generatedScript: '',
    finalScript: '',
    isGeneratingScript: false,
    aspectRatio: '9:16', // Default to portrait
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

  // Wrapper to also reset video generated state
  const handleClearResults = () => {
    clearResults();
    setVideoGenerated(false);
  };

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

  // Reset videoGenerated when starting new generation or going back to step 1
  useEffect(() => {
    if (isGeneratingVideo) {
      console.log('🔄 Starting generation, setting videoGenerated = false');
      setVideoGenerated(false);
    }
  }, [isGeneratingVideo]);

  // Reset videoGenerated when user goes back to step 1 (Start Over)
  useEffect(() => {
    if (multiStepState.currentStep === 1 && !multiStepState.generatedScript && !multiStepState.finalScript) {
      setVideoGenerated(false);
    }
  }, [multiStepState.currentStep, multiStepState.generatedScript, multiStepState.finalScript]);

  // Monitor the exact moment when isGeneratingVideo changes from true to false
  const prevIsGeneratingVideo = useRef(isGeneratingVideo);
  useEffect(() => {
    // Debug: Step 3 monitoring (can be removed in production)
    // console.log('🔍 Step 3 monitoring:', { currentStep: multiStepState.currentStep, videoGenerated });
    
    // Detect transition: was generating -> stopped generating
    if (prevIsGeneratingVideo.current === true && isGeneratingVideo === false) {
      // If we're on step 4 and the loader just stopped, show checkmark
      if (multiStepState.currentStep >= 4) {
        setVideoGenerated(true);
      }
    }
    
    // Update previous value for next comparison
    prevIsGeneratingVideo.current = isGeneratingVideo;
    
    // Reset when starting new generation
    if (isGeneratingVideo && !videoGenerated) {
      setVideoGenerated(false);
    }
  }, [isGeneratingVideo, result, videoGenerated, multiStepState.currentStep]);

  // Track if we were generating to distinguish from restored results
  const wasGeneratingVideo = useRef(false);
  useEffect(() => {
    if (isGeneratingVideo) {
      wasGeneratingVideo.current = true;
    }
  }, [isGeneratingVideo]);

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
        return null; // No left panel content for history
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

  // Render appropriate right panel content for editor only
  const renderRightPanel = () => {
    return (
      <ContextualOutput
        activeTab={activeTab}
        result={result}
        isGenerating={isGenerating || isLocalGenerating}
        isEditing={isEditing}
        error={error}
        onClearResults={handleClearResults}
      />
    );
  };

  return (
    <StandardToolPage
      icon={FileText}
      title="Script to Video"
      description="Transform scripts into professional video content"
      iconGradient="bg-primary"
      toolName="Script to Video"
      tabs={<StandardToolTabs tabs={scriptToVideoTabs} activeTab={activeTab} basePath="/dashboard/script-to-video" />}
    >
      {activeTab === 'history' ? (
        <Card className="h-full bg-card border-border/30 p-4">
          <HistoryOutput />
        </Card>
      ) : activeTab === 'generate' ? (
        // Single-panel layout for generator tab (like ebook writer)
        <div className="h-full overflow-hidden">
          <GeneratorTab
            credits={credits}
            onGeneratingChange={setIsLocalGenerating}
            multiStepState={multiStepState}
            onMultiStepStateChange={setMultiStepState}
            onVoiceSelected={setVoiceSelected}
            onGeneratingVoiceChange={setIsGeneratingVoice}
            onGeneratingVideoChange={setIsGeneratingVideo}
          />
        </div>
      ) : (
        // Two-panel layout for editor tab
        <StandardToolLayout>
          {/* Left Panel - Content Only */}
          <div className="h-full overflow-hidden">
            {renderTabContent()}
          </div>
          
          {/* Right Panel - Video Preview */}
          {renderRightPanel()}
        </StandardToolLayout>
      )}
      
      {/* User Choice Dialog - Global Modal */}
      <UserChoiceDialog />
    </StandardToolPage>
  );
}

export default ScriptToVideoPage;