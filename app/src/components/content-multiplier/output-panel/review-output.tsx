'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export function ReviewOutput() {
  return (
    <div className="h-full overflow-y-auto scrollbar-hover p-6 space-y-6">
      <div className="text-center space-y-2">
        <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" />
        <h2 className="text-2xl font-bold">Review & Publish</h2>
        <p className="text-muted-foreground">
          Review all platform content before publishing
        </p>
      </div>

      <Card >
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Review and bulk publishing features will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}