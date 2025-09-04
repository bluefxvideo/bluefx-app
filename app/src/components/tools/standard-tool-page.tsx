'use client';

import { ReactNode } from 'react';
import { LucideIcon, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TutorialDialog } from '@/components/ui/tutorial-dialog';
import { cn } from '@/lib/utils';

interface StandardToolPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconGradient?: string;
  tabs?: ReactNode;
  children: ReactNode;
  className?: string;
  toolName?: string; // For fetching the correct tutorial
}

export function StandardToolPage({ 
  icon: Icon, 
  title, 
  description, 
  iconGradient = "bg-primary",
  tabs,
  children, 
  className,
  toolName
}: StandardToolPageProps) {
  return (
    <div className={cn("h-full bg-background", className)}>
      {/* Main Content Area */}
      <div className="h-full flex flex-col p-4 lg:p-6">
        {/* Tool Header Card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                iconGradient
              )}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {title}
                </h2>
                <p className="text-sm text-zinc-400">
                  {description}
                </p>
              </div>
            </div>
            <TutorialDialog toolName={toolName || title}>
              <Button
                variant="outline"
                size="sm"
                className="border-border text-zinc-300 hover:bg-secondary gap-1.5"
              >
                <BookOpen className="w-4 h-4" />
                Tutorial
              </Button>
            </TutorialDialog>
          </div>

          {/* Tool-specific Tab Navigation */}
          {tabs && (
            <div className="bg-secondary/30 rounded-lg p-1">
              {tabs}
            </div>
          )}
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}