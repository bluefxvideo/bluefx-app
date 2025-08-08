'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Linkedin, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContentMultiplierStore } from '../store/content-multiplier-store';

export function LinkedInTab() {
  const { current_variant, setActiveTab } = useContentMultiplierStore();

  if (!current_variant) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="max-w-md text-center bg-white dark:bg-gray-800/40">
          <CardContent className="pt-6">
            <Linkedin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">No Content Generated</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate content first to see LinkedIn optimization.
            </p>
            <Button variant="outline" onClick={() => setActiveTab('input')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Input
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hover p-4">
      <Card className="bg-white dark:bg-gray-800/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-blue-600" />
            LinkedIn
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            LinkedIn tab coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}