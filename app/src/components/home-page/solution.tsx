'use client';

export function Solution() {
  return (
    <section className="w-full py-24 bg-zinc-950 text-white">
      <div className="container mx-auto max-w-7xl px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6 uppercase tracking-wider">
            THE SOLUTION
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-white leading-[1.2]">
            AI Media Machine
          </h2>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
            All-in-one platform to create 50+ pieces of professional content per week
          </p>
        </div>

        {/* Hero Image */}
        <div className="w-full max-w-5xl mx-auto mb-16">
          <div className="relative bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-lg overflow-hidden shadow-xl border border-zinc-800">
            <img 
              src="/mediamachineold.png" 
              alt="AI Media Machine Logo" 
              className="w-full h-auto object-cover"
            />
          </div>
        </div>

        {/* Key Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="text-center bg-background rounded-xl p-6 border border-zinc-800 shadow-[0px_4px_20px_rgba(0,0,0,0.15)]">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl font-bold">🎯</span>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-white">One Platform</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Stop juggling 20 different subscriptions
            </p>
          </div>

          <div className="text-center bg-background rounded-xl p-6 border border-zinc-800 shadow-[0px_4px_20px_rgba(0,0,0,0.15)]">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl font-bold">⚡</span>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-white">50+ Pieces Weekly</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Create more content than ever before
            </p>
          </div>

          <div className="text-center bg-background rounded-xl p-6 border border-zinc-800 shadow-[0px_4px_20px_rgba(0,0,0,0.15)]">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl font-bold">🎭</span>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-white">100% Faceless</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Build your empire without ever showing your face. Perfect for privacy-conscious creators.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}