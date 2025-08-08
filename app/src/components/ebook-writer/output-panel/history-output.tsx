'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History } from 'lucide-react';

export function HistoryOutput() {
  return (
    <Card className="bg-white dark:bg-gray-800/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-gray-500" />
          Recent Ebooks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-8">
          History output will be implemented here
        </p>
      </CardContent>
    </Card>
  );
}