'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

const valueBreakdown = [
  { item: "AI Cinematographer", value: "$997" },
  { item: "Script-to-Video Generator", value: "$1,497" },
  { item: "AI Ebook Writer", value: "$1,997" },
  { item: "Talking AI Avatar", value: "$1,497" },
  { item: "AI Voiceover Studio", value: "$997" },
  { item: "AI Thumbnail Maker", value: "$797" },
  { item: "Content Multiplier", value: "$797" },
  { item: "AI Logo Generator", value: "$497" },
  { item: "AI Music Maker", value: "$597" },
  { item: "Trending Keywords Finder", value: "$497" },
  { item: "Top Offers Finder", value: "$997" },
  { item: "YouTube Trend Finder", value: "$297" }
];

// Countdown Timer Component
function CountdownTimer() {
  const initialTime = (8 * 60 * 60) + (32 * 60) + 11;
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return {
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      seconds: remainingSeconds.toString().padStart(2, '0')
    };
  };

  const { hours, minutes, seconds } = formatTime(timeLeft);

  return (
    <div className="text-center mb-16">
      <h3 className="text-2xl font-bold text-white mb-4">⏰ Founding Member Pricing Expires Soon</h3>
      <p className="text-gray-400 mb-6">This $37/month rate is only available during launch. Regular price will be $67/month.</p>
      
      <div className="flex justify-center gap-4 mb-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 min-w-[80px]">
          <div className="text-3xl font-bold text-red-400">{hours}</div>
          <div className="text-xs text-gray-400 uppercase">Hours</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 min-w-[80px]">
          <div className="text-3xl font-bold text-red-400">{minutes}</div>
          <div className="text-xs text-gray-400 uppercase">Minutes</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 min-w-[80px]">
          <div className="text-3xl font-bold text-red-400">{seconds}</div>
          <div className="text-xs text-gray-400 uppercase">Seconds</div>
        </div>
      </div>
      
      <p className="text-sm text-gray-500">Don't miss out on this limited-time offer!</p>
    </div>
  );
}

export function Pricing() {
  return (
    <div className="w-full">
      {/* Value Section */}
      <section className="w-full py-24 bg-zinc-950/50 text-white">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6 uppercase tracking-wider">
              THE VALUE
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-white leading-[1.2]">
              What You're Getting
            </h2>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Individual value of each app if purchased separately
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <h3 className="text-2xl font-semibold mb-8 text-center text-white">Total Value Breakdown</h3>
            
            <div className="bg-background rounded-2xl p-8 border border-zinc-800 shadow-[0px_4px_20px_rgba(0,0,0,0.15)]">
              <div className="space-y-4 mb-8">
                {valueBreakdown.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-zinc-800 last:border-b-0">
                    <span className="text-gray-300">{item.item}</span>
                    <span className="font-medium text-blue-400">{item.value}</span>
                  </div>
                ))}
              </div>
              
              <div className="text-center py-8">
                <p className="text-6xl font-bold text-blue-400 mb-6">
                  $11,897
                </p>
                <p className="text-gray-300 text-base mb-2">
                  That's more than most people spend on a car...
                </p>
                <p className="text-gray-100 font-medium text-base">
                  But you're getting it all for less than a Netflix subscription.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="w-full py-24 bg-zinc-950 text-white">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium mb-6 uppercase tracking-wider">
              OUR STORY
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-white leading-[1.2]">
              From Video Templates to AI Revolution
            </h2>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              16 years of content creation experience, now powered by AI
            </p>
          </div>

          {/* Personal Story Section */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="bg-background rounded-2xl p-8 md:p-12 border border-zinc-800">
              <div className="grid md:grid-cols-3 gap-8 items-center mb-8">
                <div className="md:col-span-2">
                  <h3 className="text-2xl font-bold mb-4 text-white">A Message from the Founder</h3>
                  <p className="text-gray-300 leading-relaxed mb-4">
                    Since 2008, we've been at the forefront of digital content creation. What started as producing video templates has evolved into something extraordinary - serving over <span className="text-blue-400 font-semibold">36,000 customers</span> worldwide.
                  </p>
                  <p className="text-gray-300 leading-relaxed mb-4">
                    Our videos, blog posts, and lead magnets brought in over <span className="text-blue-400 font-semibold">200,000 leads</span> and <span className="text-blue-400 font-semibold">36,000 customers</span> to our business. I've personally created over <span className="text-blue-400 font-semibold">600 videos</span> the hard way. Days... sometimes weeks... per video.
                  </p>
                  <p className="text-gray-300 leading-relaxed">
                    Two years ago, I made a decision that changed everything - to leverage AI and completely revolutionize how we create content. The result? What used to take weeks now takes minutes, without sacrificing quality.
                  </p>
                </div>
                <div className="text-center">
                  <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                    <div className="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden bg-zinc-800">
                      <img 
                        src="/Szilard.jpg" 
                        alt="Szilard Gyorfi - Founder & Creator"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-sm text-gray-400">Szilard Gyorfi</p>
                    <p className="text-sm text-gray-400">Founder & Creator</p>
                    <p className="text-xs text-gray-500 mt-2">16 Years Experience</p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-zinc-800">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-400">2008</p>
                  <p className="text-sm text-gray-400">Founded</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-400">36K+</p>
                  <p className="text-sm text-gray-400">Customers</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-400">600+</p>
                  <p className="text-sm text-gray-400">Videos Created</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-400">200K+</p>
                  <p className="text-sm text-gray-400">Leads Generated</p>
                </div>
              </div>
            </div>
          </div>

          {/* Why This Matters Section */}
          <div className="text-center mt-12">
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              <span className="text-white font-semibold">Join us in the AI content revolution.</span> We've done the hard work, made the mistakes, and found what works. Now it's your turn to benefit from our experience.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Plans Section */}
      <section className="w-full py-24 bg-zinc-950/50 text-white" id="pricing-plans">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-6 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold mb-8 uppercase tracking-wider">
              INVESTMENT
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white leading-[1.1]">
              Choose Your Path
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed mb-12">
              Lock in founding member pricing before it's gone forever
            </p>
          </div>

          {/* Countdown Timer */}
          <CountdownTimer />

          <div className="flex flex-col md:flex-row items-center justify-center gap-12 max-w-7xl mx-auto mb-20">
            {/* If Bought Separately */}
            <div className="relative border border-zinc-800 bg-background rounded-2xl p-8 text-center min-h-[620px] w-full md:w-[340px] flex flex-col justify-center">
              <h3 className="text-xl font-medium mb-8 text-gray-400">If Bought Separately</h3>
              <div className="mb-6">
                <p className="text-5xl font-bold text-gray-500 line-through decoration-2">$11,897</p>
              </div>
              <p className="text-gray-500">Plus ongoing costs</p>
            </div>

            {/* Founding Members - Main Option */}
            <div className="mt-12 relative border-2 border-blue-500/50 bg-background rounded-2xl p-8 text-center z-10 min-h-[580px] w-full md:w-[340px] flex flex-col justify-center transform md:-translate-y-8 shadow-[0_0_50px_rgba(59,130,246,0.3)]">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold uppercase shadow-lg">
                  BEST VALUE
                </span>
              </div>
              <h3 className="text-xl font-medium mb-6 text-white mt-2">Founding Members</h3>
              <div className="mb-4">
                <span className="text-6xl font-bold text-white">$37</span>
                <span className="text-gray-400 text-xl">/month</span>
              </div>
              <p className="text-blue-400 font-bold text-lg mb-2">Discounted Price Locked in FOREVER</p>
              <div className="text-sm text-gray-400 mb-4">
                <p>Less than your weekly coffee budget</p>
                <p>Less than one dinner out</p>
                <p>Less than a tank of gas</p>
              </div>
              <p className="text-gray-400 mb-6">After $1 trial • Cancel anytime</p>
              <div className="mb-6 bg-blue-950/30 border border-blue-900/50 rounded-lg p-4">
                <p className="text-blue-300 text-sm font-semibold">
                  For the price of one dinner, you get tools that can build an entire business.
                </p>
              </div>
              <Button 
                size="lg" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Start $1 Trial →
              </Button>
            </div>

            {/* Regular Price */}
            <div className="relative border border-zinc-800 bg-background rounded-2xl p-8 text-center min-h-[620px] w-full md:w-[340px] flex flex-col justify-center">
              <h3 className="text-xl font-medium mb-8 text-gray-400">Regular Price</h3>
              <div className="mb-6">
                <p className="text-5xl font-bold text-gray-400">
                  $67<span className="text-xl">/month</span>
                </p>
              </div>
              <p className="text-gray-500">Coming soon</p>
            </div>
          </div>

          {/* $1 Trial CTA */}
          <div className="max-w-4xl mx-auto mb-20">
            <div className="bg-background rounded-3xl p-10 text-center border border-zinc-800 shadow-[0px_4px_20px_rgba(0,0,0,0.15)]">
              <h3 className="text-3xl md:text-5xl font-bold mb-6 text-white leading-tight">
                Try Everything for Just <span className="text-blue-400">$1</span>
              </h3>
              
              <p className="text-gray-300 mb-8 text-lg">
                30 days • All 12 apps • Create 50+ pieces of content • Cancel anytime
              </p>
              
              <div className="flex flex-col items-center gap-2">
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
            </div>
          </div>
        </div>
      </section>

      {/* Guarantee Section */}
      <section className="w-full py-24 bg-gray-950 text-white">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          {/* 30-Day Guarantee Badge */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <img 
                src="/images/30-day-money-back-guarantee.png" 
                alt="30 Day Money Back Guarantee" 
                className="w-52 h-52" 
              />
            </div>
          </div>

          <h3 className="text-3xl font-bold mb-6 text-white">Ironclad 30-Day Guarantee</h3>
          
          <div className="space-y-4 text-gray-300 text-lg leading-relaxed">
            <p className="font-semibold text-white">
              If you don't create at least 10 pieces of content you're proud of...<br/>
              If you don't save hours of time...<br/>
              If you don't see the massive potential...
            </p>
            <p className="font-semibold text-white text-xl">
              Just cancel before the 30 days are up. We'll even refund your dollar.
            </p>
            <p className="mt-6">
              That's how confident I am that you'll love what you get inside the AI Media Machine.
              <br />
              You have nothing to lose and an entire AI content empire to gain.
            </p>
          </div>
          
          {/* Final $1 CTA Box */}
          <div className="mt-16 bg-gray-900 rounded-xl p-6 sm:p-10 border border-gray-800">
            <h3 className="text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-white">
              Try Everything for Just <span className="text-blue-500">$1</span>
            </h3>
            
            <p className="text-gray-300 mb-6 sm:mb-8 text-base sm:text-lg">
              30 days • All 12 apps • Create 50+ pieces of content • Cancel anytime
            </p>
            
            <div className="flex flex-col items-center gap-2">
              <Button
                size="lg"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 text-lg sm:text-xl font-bold rounded-lg shadow-xl w-full sm:w-auto max-w-sm mx-auto"
              >
                🚀 Get Instant Access for $1
              </Button>
              <p className="text-sm text-gray-400">
                Then $37/month • Cancel anytime • No hidden fees
              </p>
            </div>
            
            <div className="mt-6 flex flex-col items-center text-center">
              <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400 mb-3">
                <div className="flex items-center justify-center">
                  <Check className="w-3 sm:w-4 h-3 sm:h-4 mr-1 text-gray-500" /> Secure SSL checkout
                </div>
                <div className="flex items-center justify-center">
                  <Check className="w-3 sm:w-4 h-3 sm:h-4 mr-1 text-gray-500" /> Instant access
                </div>
                <div className="flex items-center justify-center">
                  <Check className="w-3 sm:w-4 h-3 sm:h-4 mr-1 text-gray-500" /> Cancel anytime
                </div>
              </div>
              <div className="text-gray-500 text-xs flex items-center justify-center">
                <span className="mr-2">🔒</span>
                <span className="break-words">256-bit SSL Encrypted • Your information is 100% secure</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}