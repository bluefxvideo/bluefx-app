'use client';

import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { CheckCircle, Clock, Loader2, FileText, Mic, Video, Wand2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

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
  const [editableScript, setEditableScript] = useState(finalScript || generatedScript || '');

  // Determine the current phase and status
  const getPhaseStatus = () => {
    if (isGeneratingScript) {
      return { phase: 'script', status: 'generating', message: 'Generating your script...' };
    }
    if (generatedScript && isGeneratingVoice) {
      return { phase: 'voice', status: 'generating', message: 'Creating voice narration...' };
    }
    if (generatedScript && voiceSelected && isGeneratingVideo) {
      return { phase: 'video', status: 'generating', message: 'Generating images and assembling assets...' };
    }
    if (generatedScript && !isGeneratingVoice && !isGeneratingVideo) {
      return { phase: 'complete', status: 'ready', message: 'Assets ready! Review your script below.' };
    }
    return { phase: 'idle', status: 'idle', message: 'Ready to generate' };
  };

  const { phase, status, message } = getPhaseStatus();

  // Progress steps
  const steps = [
    { id: 'script', label: 'Script Generation', icon: FileText, complete: !!generatedScript, active: isGeneratingScript },
    { id: 'voice', label: 'Voice Synthesis', icon: Mic, complete: voiceSelected, active: isGeneratingVoice },
    { id: 'assets', label: 'Image & Video Assets', icon: Video, complete: false, active: isGeneratingVideo }
  ];

  const getTitle = () => {
    if (status === 'generating') {
      return phase === 'script' ? 'Generating Script...' 
           : phase === 'voice' ? 'Creating Voice...'
           : 'Preparing Assets...';
    }
    if (status === 'ready') {
      return 'Script-to-Video Ready!';
    }
    return 'AI Script-to-Video Generator';
  };

  const getIcon = () => {
    if (status === 'generating') {
      return (
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        </div>
      );
    }
    if (status === 'ready') {
      return (
        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-white" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 bg-zinc-700 rounded-xl flex items-center justify-center">
        <Wand2 className="w-5 h-5 text-zinc-400" />
      </div>
    );
  };

  const handleScriptChange = (value: string) => {
    setEditableScript(value);
    onScriptEdit?.(value);
  };

  return (
    <OutputPanelShell
      title={getTitle()}
      subtitle={message}
      icon={getIcon()}
      status={status as any}
    >
      <div className="space-y-6">
        {/* Progress Steps */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-300">Generation Progress</h3>
                <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                  Step {Math.min(currentStep, totalSteps)} of {totalSteps}
                </Badge>
              </div>
              
              <div className="space-y-3">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        step.active ? 'bg-primary' : 
                        step.complete ? 'bg-green-500' : 'bg-zinc-700'
                      }`}>
                        {step.active ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : step.complete ? (
                          <CheckCircle className="w-4 h-4 text-white" />
                        ) : (
                          <Icon className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${
                          step.active ? 'text-white' :
                          step.complete ? 'text-green-400' : 'text-zinc-400'
                        }`}>
                          {step.label}
                        </div>
                        {step.active && (
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {step.id === 'script' && 'Creating your script...'}
                            {step.id === 'voice' && 'Synthesizing narration...'}
                            {step.id === 'assets' && 'Generating images...'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Script Preview/Editor */}
        {(generatedScript || finalScript) && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-300">Script Preview</h3>
                  {isEditable && (
                    <Badge variant="outline" className="text-xs">Editable</Badge>
                  )}
                </div>
                
                {isEditable ? (
                  <Textarea
                    value={editableScript}
                    onChange={(e) => handleScriptChange(e.target.value)}
                    className="min-h-[200px] bg-zinc-800 border-zinc-700 text-zinc-200 resize-none"
                    placeholder="Your script will appear here..."
                  />
                ) : (
                  <div className="min-h-[200px] p-3 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 leading-relaxed">
                    {generatedScript || finalScript || 'Your script will appear here...'}
                  </div>
                )}
                
                <div className="text-xs text-zinc-500">
                  {(editableScript || generatedScript || finalScript || '').split(' ').length} words
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading Message */}
        {status === 'generating' && (
          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-sm font-medium text-blue-300">Processing your request</div>
                  <div className="text-xs text-blue-400/70 mt-1">
                    This may take 30-60 seconds to complete all steps
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </OutputPanelShell>
  );
}