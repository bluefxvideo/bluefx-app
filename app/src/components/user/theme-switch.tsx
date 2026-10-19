'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Light or dark, one tap away in the sidebar (owner 2026-10-19: the app starts in light, the tutorial videos show
 * dark, so the switch has to be easy to find). Wide sidebar: two labelled buttons; the narrow phone rail: one icon.
 */
export function ThemeSwitch({ collapsed }: { collapsed: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known in the browser: until then the switch keeps its place without showing a choice.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';

  if (collapsed) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setTheme(dark ? 'light' : 'dark')}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-card text-foreground transition-colors hover:bg-secondary"
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{dark ? 'Light mode' : 'Dark mode'}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const option = (value: 'light' | 'dark', label: string, Icon: typeof Sun) => {
    const on = mounted && (value === 'dark') === dark;
    return (
      <button
        type="button"
        onClick={() => setTheme(value)}
        aria-pressed={on}
        className={cn(
          'flex h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors',
          on ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </button>
    );
  };

  return (
    <div className="flex gap-1 rounded-lg border border-border bg-card/60 p-1" role="group" aria-label="Light or dark">
      {option('light', 'Light', Sun)}
      {option('dark', 'Dark', Moon)}
    </div>
  );
}
