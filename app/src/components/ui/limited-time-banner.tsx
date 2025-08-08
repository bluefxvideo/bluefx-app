'use client';

export function LimitedTimeBanner() {
  return (
    <div className="w-full bg-green-900/20 border-b border-green-700/50 text-white py-3">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-2">
          <span className="text-green-400">🚀</span>
          <span className="text-green-400 text-sm font-medium">
            Limited Time: Founding Member Pricing
          </span>
        </div>
      </div>
    </div>
  )
}