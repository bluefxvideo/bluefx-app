'use client';

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useVideoEditorStore } from "../store/video-editor-store";
import { AlertCircle, CheckCircle, RefreshCw, Volume2 } from "lucide-react";

/**
 * Subtle timeline sync status indicator
 * Shows when audio/captions are out of sync with visual timeline
 */
export function TimelineSyncIndicator() {
  const { 
    timeline, 
    regenerateTimelineSync,
    checkSyncStatus 
  } = useVideoEditorStore();

  const syncStatus = checkSyncStatus();
  const segmentsNeedingVoice = timeline.segments_needing_voice.length;

  // Don't show anything if timeline is synced
  if (syncStatus === 'synced') {
    return null;
  }

  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'out_of_sync':
        return {
          icon: AlertCircle,
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700',
          badge: 'warning',
          title: 'Timeline Out of Sync',
          description: `${segmentsNeedingVoice} segment${segmentsNeedingVoice !== 1 ? 's' : ''} need voice generation`
        };
      case 'regenerating':
        return {
          icon: RefreshCw,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700',
          badge: 'default',
          title: 'Regenerating Audio',
          description: 'Syncing voice and captions...'
        };
      default:
        return {
          icon: CheckCircle,
          color: 'text-blue-600 dark:text-blue-600',
          bgColor: 'bg-blue-100 dark:bg-blue-100/20 border-green-300 dark:border-green-700',
          badge: 'secondary',
          title: 'Timeline Synced',
          description: 'Audio and visuals are synchronized'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bgColor} transition-all`}>
        {/* Status Icon */}
        <Icon className={`w-4 h-4 ${config.color} ${syncStatus === 'regenerating' ? 'animate-spin' : ''}`} />
        
        {/* Status Text */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {config.title}
          </span>
          
          {segmentsNeedingVoice > 0 && syncStatus === 'out_of_sync' && (
            <Badge variant="secondary" className="text-xs bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 hover:bg-orange-300 dark:hover:bg-orange-700">
              {segmentsNeedingVoice} segments
            </Badge>
          )}
        </div>

        {/* Action Button */}
        {syncStatus === 'out_of_sync' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={regenerateTimelineSync}
              >
                <Volume2 className="w-3 h-3 mr-1" />
                Sync Audio
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <div className="font-medium">Regenerate Timeline Audio</div>
                <div className="text-xs text-muted-foreground mt-1">
                  This will regenerate voice and captions<br />
                  for all modified segments
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}