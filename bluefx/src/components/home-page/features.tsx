'use client';

import { cn } from "@/lib/utils"
import {
  Video,
  Paintbrush,
  Mic,
  BookOpen,
  Layers
} from 'lucide-react';

export function Features() {
  const teamShovelCosts = [
    { item: "Video editing", cost: "$500-$1,000", subtext: "per video", icon: <Video className="w-4 h-4 text-red-400" /> },
    { item: "Graphic design", cost: "$300-$500", subtext: "per project", icon: <Paintbrush className="w-4 h-4 text-red-400" /> },
    { item: "Voice actors", cost: "$100-$500", subtext: "per script", icon: <Mic className="w-4 h-4 text-red-400" /> },
    { item: "Ebook design", cost: "$500-$1,500", subtext: "per book", icon: <BookOpen className="w-4 h-4 text-red-400" /> },
    { item: "Design tools", cost: "$200-$500", subtext: "per month", icon: <Layers className="w-4 h-4 text-red-400" /> },
  ];

  const teamBulldozerBenefits = [
    { item: "All video creation", cost: "$37", subtext: "unlimited videos", icon: <Video className="w-4 h-4 text-emerald-400" /> },
    { item: "All graphic design", cost: "$0", subtext: "included", icon: <Paintbrush className="w-4 h-4 text-emerald-400" /> },
    { item: "All AI voices", cost: "$0", subtext: "57 languages", icon: <Mic className="w-4 h-4 text-emerald-400" /> },
    { item: "All ebook creation", cost: "$0", subtext: "included", icon: <BookOpen className="w-4 h-4 text-emerald-400" /> },
    { item: "All tools included", cost: "$0", subtext: "12 AI apps", icon: <Layers className="w-4 h-4 text-emerald-400" /> },
  ];

  return (
    <section className="relative bg-zinc-950/50 text-foreground py-20">
      <div className="container mx-auto max-w-7xl px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium mb-6 uppercase tracking-wider">
            THE PROBLEM
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-foreground leading-[1.2]">
            Content Creation is Broken
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Traditional methods are slow, expensive, and require showing your face
            <br />
            on camera
          </p>
        </div>

        {/* Main Comparison Section with Story */}
        <div className="max-w-6xl mx-auto">
          {/* Story Header */}
          <div className="text-center mb-12">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
              The Bulldozer Story That Changed Everything
            </h3>
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="w-20 h-1 bg-gradient-to-r from-transparent to-red-500"></div>
              <span className="text-4xl">🚜</span>
              <div className="w-20 h-1 bg-gradient-to-r from-emerald-500 to-transparent"></div>
            </div>
          </div>

          {/* Visual Story + Comparison */}
          <div className="grid lg:grid-cols-2 gap-8 items-stretch mb-12">
            {/* Team Shovel - Left Side */}
            <div className="relative">
              <div className="bg-gradient-to-br from-red-950/20 to-gray-900 rounded-xl p-8 border-2 border-red-900/50 h-full shadow-[0px_4px_20px_rgba(0,0,0,0.15)]">
                <div className="absolute -top-4 left-8 bg-zinc-950 px-4 border border-red-900/50 rounded-lg shadow-lg">
                  <span className="text-red-400 font-bold text-lg flex items-center gap-2">
                    <span className="text-2xl">😰</span> TEAM SHOVEL
                  </span>
                </div>
                
                {/* Story Part for Team Shovel */}
                <div className="mb-6 mt-4">
                  <p className="text-muted-foreground text-sm mb-3">
                    <span className="text-red-400 font-bold">1950:</span> 20 men. Shovels. All day in the blazing sun.
                  </p>
                  <p className="text-2xl font-bold text-red-400 mb-4">Working 80-hour weeks</p>
                </div>

                {/* Image */}
                <div className="relative w-full aspect-[16/9] mb-6 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700">
                  <img 
                    src="/team-shovel-s.jpg" 
                    alt="Team Shovel - Working harder, not smarter"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                </div>

                {/* Costs */}
                <div className="space-y-3 mb-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">THE HARD WAY COSTS:</p>
                  {teamShovelCosts.map((cost, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {cost.icon}
                        <div>
                          <span className="text-foreground text-sm">{cost.item}</span>
                          <span className="text-xs text-muted-foreground ml-1">({cost.subtext})</span>
                        </div>
                      </div>
                      <span className="font-bold text-red-400">{cost.cost}</span>
                    </div>
                  ))}
                </div>
                
                {/* Total */}
                <div className="border-t border-red-500/20 pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-muted-foreground">Total to get started:</span>
                    <span className="text-2xl font-bold text-red-400">$5,000-$10,000</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>❌ Plus weeks of learning</p>
                    <p>❌ Plus ongoing monthly costs</p>
                    <p>❌ Plus inevitable burnout</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Bulldozer - Right Side */}
            <div className="relative">
              <div className="bg-gradient-to-br from-emerald-950/20 to-gray-900 rounded-xl p-8 border-2 border-emerald-900/50 h-full transform hover:scale-[1.01] transition-transform shadow-[0px_4px_20px_rgba(0,0,0,0.15)]">
                <div className="absolute -top-4 right-8 bg-zinc-950 px-4 border border-emerald-900/50 rounded-lg shadow-lg">
                  <span className="text-emerald-400 font-bold text-lg flex items-center gap-2">
                    TEAM BULLDOZER <span className="text-2xl">😎</span>
                  </span>
                </div>
                
                {/* Story Part for Team Bulldozer */}
                <div className="mb-6 mt-4">
                  <p className="text-muted-foreground text-sm mb-3">
                    <span className="text-emerald-400 font-bold">TODAY:</span> 1 person. AI tools. Coffee in hand.
                  </p>
                  <p className="text-2xl font-bold text-emerald-400 mb-4">Working 4-hour weeks</p>
                </div>

                {/* Image */}
                <div className="relative w-full aspect-[16/9] mb-6 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700">
                  <img 
                    src="/team-bulldozer-s.jpg" 
                    alt="Team Bulldozer - Working smarter with AI"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                </div>

                {/* Benefits */}
                <div className="space-y-3 mb-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">THE AI WAY INCLUDES:</p>
                  {teamBulldozerBenefits.map((benefit, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {benefit.icon}
                        <div>
                          <span className="text-foreground text-sm">{benefit.item}</span>
                          <span className="text-xs text-muted-foreground ml-1">({benefit.subtext})</span>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-400">{benefit.cost}</span>
                    </div>
                  ))}
                </div>
                
                {/* Total */}
                <div className="border-t border-emerald-500/20 pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-muted-foreground">Everything included:</span>
                    <span className="text-2xl font-bold text-emerald-400">$37/month</span>
                  </div>
                  <div className="text-xs text-emerald-400/80 space-y-1">
                    <p>✅ Start creating in minutes</p>
                    <p>✅ No contractors needed</p>
                    <p>✅ Create 50+ pieces weekly</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* The Harsh Truth */}
          <div className="bg-gradient-to-r from-red-950/30 via-gray-900 to-emerald-950/30 rounded-xl p-8 text-center border border-gray-800 shadow-[0px_4px_20px_rgba(0,0,0,0.15)]">
            <p className="text-xl font-bold text-foreground mb-4">
              Here's the harsh truth:
            </p>
            <p className="text-muted-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
              AI is YOUR bulldozer. Except it's even MORE powerful.
              Because a bulldozer can only work in one place. But with AI? 
              You create content that reaches MILLIONS around the world.
            </p>
            <div className="flex items-center justify-center gap-8 text-3xl font-bold">
              <span className="text-red-400">Team Shovel</span>
              <span className="text-muted-foreground">vs.</span>
              <span className="text-emerald-400">Team Bulldozer</span>
            </div>
            <p className="text-2xl text-primary font-bold mt-6">
              Which team do YOU want to be on?
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}