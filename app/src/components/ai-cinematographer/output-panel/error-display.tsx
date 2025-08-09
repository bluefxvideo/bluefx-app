'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
}

/**
 * Error display component for video generation failures
 */
export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card className="p-8 max-w-sm text-center space-y-4 border-destructive/50 bg-destructive/5">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-white" />
        </div>
        
        <div>
          <h3 className="font-medium mb-2 text-destructive">
            Video Generation Failed
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {error}
          </p>
        </div>

        <Button 
          variant="outline" 
          onClick={onRetry}
          className="w-full border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>

        <div className="space-y-2 pt-2">
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">💡 Troubleshooting:</p>
            <ul className="text-left space-y-1">
              <li>• Check your internet connection</li>
              <li>• Ensure reference image is under 10MB</li>
              <li>• Try simplifying your video description</li>
              <li>• Contact support if the issue persists</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}