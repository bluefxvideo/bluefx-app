'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabContentWrapperProps {
  children: ReactNode;
  className?: string;
}

interface TabHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconClassName?: string; // allow optional overrides, default solid primary
}

interface TabBodyProps {
  children: ReactNode;
  className?: string;
}

/**
 * Standard wrapper for tab content - NO PADDING
 * The parent layout already provides padding via the Card component
 */
export function TabContentWrapper({ children, className }: TabContentWrapperProps) {
  return (
    <div className={cn("h-full flex flex-col", className)}>
      {children}
    </div>
  );
}

/**
 * Standard header for tabs
 * Provides consistent branding without adding padding
 */
export function TabHeader({ 
  icon: Icon, 
  title, 
  description,
  iconClassName,
}: TabHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          "w-10 h-10 rounded-xl bg-primary flex items-center justify-center",
          iconClassName
        )}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <p className="text-lg text-muted-foreground" style={{ lineHeight: "1.5" }}>
        {description}
      </p>
    </div>
  );
}

/**
 * Standard body for tab content
 * Provides scrollable area without extra padding
 */
export function TabBody({ children, className }: TabBodyProps) {
  return (
    <div className={cn(
      "pl-1 flex-1 overflow-y-auto overflow-x-visible scrollbar-hover space-y-8",
      className
    )}>
      {children}
    </div>
  );
}

/**
 * Standard footer for tab content
 * Placed after TabBody to avoid scrolling with content
 */
export function TabFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-6 pt-4 border-t border-border/50", className)}>
      {children}
    </div>
  );
}

/**
 * Error display component
 * Consistent error styling across all tabs
 */
export function TabError({ error }: { error: string }) {
  return (
    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg mb-6">
      <p className="text-sm text-destructive">{error}</p>
    </div>
  );
}