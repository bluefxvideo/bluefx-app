'use client';

import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, RotateCcw } from 'lucide-react';
import { useStartOver } from '../hooks/use-start-over';

/**
 * Shared actions menu with start over functionality
 * Eliminates duplicate dropdown menu implementations
 */
export function SharedActionsMenu() {
  const { startOver } = useStartOver();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={startOver} className="text-destructive">
          <RotateCcw className="mr-2 h-4 w-4" />
          Start Over
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}