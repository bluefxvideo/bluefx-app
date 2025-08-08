'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
}

/**
 * Error display component for generation failures
 */
export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const isInsufficientCredits = error.includes('credits');
  const isNSFWError = error.includes('NSFW') || error.includes('content policy');
  const isTimeoutError = error.includes('timeout');
  
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card className="p-6 max-w-md text-center space-y-4">
        <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        
        <div>
          <h3 className="font-medium text-destructive mb-2">
            {isInsufficientCredits ? 'Insufficient Credits' :
             isNSFWError ? 'Content Policy Violation' :
             isTimeoutError ? 'Generation Timeout' :
             'Generation Failed'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {error}
          </p>
        </div>

        {/* Specific Error Actions */}
        <div className="space-y-2">
          {isInsufficientCredits ? (
            <Button className="w-full" variant="default">
              <ExternalLink className="w-4 h-4 mr-2" />
              Buy More Credits
            </Button>
          ) : isNSFWError ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Try modifying your prompt to:</p>
              <ul className="list-disc list-inside text-left space-y-1">
                <li>Use more general descriptions</li>
                <li>Focus on visual elements and style</li>
                <li>Avoid sensitive content</li>
              </ul>
            </div>
          ) : (
            <Button onClick={onRetry} variant="outline" className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>

        {/* Help Link */}
        <div className="pt-2 border-t">
          <Button variant="ghost" size="sm" className="text-sm">
            <ExternalLink className="w-3 h-3 mr-1" />
            Need Help?
          </Button>
        </div>
      </Card>
    </div>
  );
}