'use client';

import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';

/** The app's toasts in the theme the user sees (light or dark). */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'} position="top-right" richColors closeButton />;
}
