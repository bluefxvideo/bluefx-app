'use client';

import { Home } from 'lucide-react';

/**
 * Dashboard Header Component
 * Provides consistent header styling matching tool tab headers
 * Includes dashboard title and icon
 */
export function DashboardHeader() {
  return (
    <div className="w-full">
      <div className="relative flex items-center py-3 px-4 border-b border-border/30">
        {/* Dashboard Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
            <Home className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </div>
      </div>
    </div>
  );
}