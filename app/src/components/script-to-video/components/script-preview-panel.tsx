'use client';

interface ScriptPreviewPanelProps {
  currentStep: number;
  totalSteps: number;
  generatedScript?: string;
  finalScript?: string;
  useMyScript: boolean;
  isGeneratingScript?: boolean;
  isGeneratingVoice?: boolean;
  isGeneratingVideo?: boolean;
  voiceSelected?: boolean;
  onScriptEdit?: (script: string) => void;
  isEditable?: boolean;
}

export function ScriptPreviewPanel({
  currentStep,
  totalSteps,
  generatedScript,
  finalScript,
  useMyScript,
  isGeneratingScript = false,
  isGeneratingVoice = false,
  isGeneratingVideo = false,
  voiceSelected = false,
  onScriptEdit,
  isEditable = false
}: ScriptPreviewPanelProps) {
  return <div />;
}