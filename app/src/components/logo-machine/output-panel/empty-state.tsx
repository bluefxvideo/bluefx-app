'use client';

import { Badge } from "@/components/ui/badge";
import Image from "next/image";

/**
 * Empty state when no results are available
 * Shows a single logo placeholder example
 */
export function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="space-y-6 text-center max-w-2xl w-full">
        {/* Single Logo Placeholder */}
        <div className="relative aspect-square rounded-lg overflow-hidden border border-zinc-700/50 shadow-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-8 flex items-center justify-center max-w-md mx-auto">
          <div className="relative w-full h-full">
            <Image
              src="https://trjkxgkbkyzthrgkbwfe.supabase.co/storage/v1/object/public/images/placeholders/placeholder-logo-1.png"
              alt="Logo example"
              width={400}
              height={400}
              className="w-full h-full object-contain"
            />
          </div>
          {/* Badge in Top Right */}
          <div className="absolute top-3 right-3">
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-lg">
              <span className="text-xs font-bold">Example</span>
            </Badge>
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Generate Professional Logos</h3>
          <p className="text-sm text-muted-foreground">
            Create stunning logo designs powered by AI. Enter your company name and describe your ideal logo.
          </p>
        </div>

        {/* Sample Prompt Text */}
        <p className="text-xs text-zinc-500">
          Sample: "Modern tech startup logo, clean minimalist design with blue gradient"
        </p>
      </div>
    </div>
  );
}