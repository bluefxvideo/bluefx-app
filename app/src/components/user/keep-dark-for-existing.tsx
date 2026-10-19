'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

/**
 * For accounts older than the light default (lib/theme-default.ts): dark, until the person picks Light themselves.
 * The dashboard layout's inline script covers a full page load; this covers arriving by an in-app link, where an
 * inline script does not run. A stored choice always wins.
 */
export function KeepDarkForExisting() {
  const { setTheme } = useTheme();
  useEffect(() => {
    try {
      if (!localStorage.getItem('theme')) setTheme('dark');
    } catch {
      // Storage blocked (a private window): the app stays in its default.
    }
  }, [setTheme]);
  return null;
}
