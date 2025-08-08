'use client';

import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface ToolPanelProps {
  children: ReactNode;
  className?: string;
}

interface ToolPanelHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  error?: string;
}

interface ToolPanelContentProps {
  children: ReactNode;
  className?: string;
}

interface ToolPanelFooterProps {
  children: ReactNode;
  className?: string;
}

/**
 * Main container for all tool panels
 * Provides consistent structure: header → content → footer
 */
export function ToolPanel({ children, className = "" }: ToolPanelProps) {
  return (
    <div className={`h-full flex flex-col ${className}`}>
      {children}
    </div>
  );
}

/**
 * Standardized header for all tools
 * - Blue gradient icon container (consistent branding)
 * - Tool title and description
 * - Error display area
 */
export function ToolPanelHeader({ icon: Icon, title, description, error }: ToolPanelHeaderProps) {
  return (
    <div className="space-y-6 p-6 pb-0">
      {/* Tool Branding */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-2xl font-semibold">{title}</h2>
        </div>
        <p className="text-base text-muted-foreground" style={{ lineHeight: '1.5' }}>
          {description}
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-base text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Scrollable content area with elderly-friendly design
 * - Overlay scrollbar (no layout shifts)
 * - Proper spacing and padding
 * - Accessible contrast and typography
 */
export function ToolPanelContent({ children, className = "" }: ToolPanelContentProps) {
  return (
    <div 
      className={`flex-1 space-y-4 overflow-y-auto scrollbar-hover p-6 pr-2 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Footer with generate button and credits info
 * - Consistent spacing and elevation
 * - Blue gradient buttons for primary actions
 * - Loading states and disabled handling
 */
export function ToolPanelFooter({ children, className = "" }: ToolPanelFooterProps) {
  return (
    <div className={`p-6 pt-0 ${className}`}>
      {children}
    </div>
  );
}