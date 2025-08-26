'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History } from 'lucide-react';

export function HistoryOutput() {
  return (
    <div className="h-full overflow-y-auto scrollbar-hover p-6 space-y-6">
      <div className="text-center space-y-2">
        <History className="h-12 w-12 mx-auto text-gray-500" />
        <h2 className="text-2xl font-bold">Content History</h2>
        <p className="text-muted-foreground">
          View and manage your past content variants
        </p>
      </div>

      <Card >
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Content history and management features will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}