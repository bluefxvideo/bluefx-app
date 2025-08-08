'use client';

import { Button } from './button';
import { Check } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="w-full py-24 bg-zinc-950/50 text-white">
      <div className="container mx-auto max-w-4xl px-4">
        {/* Main CTA Section */}
        <div className="text-center bg-background rounded-xl p-10 border border-zinc-800 shadow-[0px_4px_20px_rgba(0,0,0,0.15)]">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
            Try Everything for Just <span className="text-blue-400">$1</span>
          </h2>
          
          <p className="text-gray-300 mb-8 text-lg">
            30 days • All 12 apps • Create 50+ pieces of content • Cancel anytime
          </p>

          <div className="flex flex-col items-center gap-3">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              🚀 Get Instant Access for $1
            </Button>
            <p className="text-sm text-gray-400">
              Then $37/month • Cancel anytime • No hidden fees
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center text-center">
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-400 mb-3">
              <div className="flex items-center">
                <Check className="w-4 h-4 mr-1 text-emerald-400" /> Secure SSL checkout
              </div>
              <div className="flex items-center">
                <Check className="w-4 h-4 mr-1 text-emerald-400" /> Instant access
              </div>
              <div className="flex items-center">
                <Check className="w-4 h-4 mr-1 text-emerald-400" /> Cancel anytime
              </div>
            </div>
            <div className="text-gray-500 text-xs flex items-center">
              <span className="mr-2">🔒</span>
              <span>256-bit SSL Encrypted • Your information is 100% secure</span>
            </div>
          </div>
        </div>
        
        {/* P.P.S. Section */}
        <div className="mt-16 max-w-3xl mx-auto text-center">
          <h3 className="text-lg font-bold mb-4 text-gray-300">P.P.S. Still thinking about it?</h3>
          <p className="text-gray-400 text-lg leading-relaxed mb-3">
            Ask yourself: What's the REAL cost of NOT taking action?
          </p>
          <p className="text-gray-400 text-lg leading-relaxed mb-3">
            Of watching everyone else succeed with AI while you're still doing things the old way?
          </p>
          <p className="text-red-400 font-semibold text-lg">
            That's the price you can't afford to pay.
          </p>
        </div>
      </div>
    </section>
  );
}