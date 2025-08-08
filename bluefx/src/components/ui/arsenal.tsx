'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from './button';
import { Play, Pause } from 'lucide-react';

// Voice Sample Player Component
function VoiceSamplePlayer({ audioUrl, label, icon }: { audioUrl: string; label: string; icon: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });
    
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });
    
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });
    
    return () => {
      audio.pause();
      audio.remove();
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center w-full bg-zinc-900 rounded-lg p-3 border border-zinc-800">
      <span className="text-2xl mb-1">{icon}</span>
      <p className="text-xs text-gray-300 mb-2 font-semibold">{label}</p>
      <div className="flex items-center gap-2 w-full">
        <Button 
          size="icon" 
          variant="secondary" 
          onClick={togglePlay}
          className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <div className="flex-1 h-8 bg-zinc-800 rounded-md relative overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-blue-600/30 rounded-md transition-all"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 tabular-nums">
          {formatTime(currentTime)}/{formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

export function Arsenal() {
  const [visibleCards, setVisibleCards] = useState<number[]>([0]);
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set([0]));
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  
  const apps = [
    {
      name: "AI Cinematographer",
      value: "$997 Value",
      description: "Transform any photo into a dynamic video with natural movement. Upload an image, describe the motion you want, and watch AI bring it to life with cinema-quality animation.",
      demo: <img src="/1.gif" alt="AI Cinematographer Demo" className="w-full rounded-lg" loading="lazy" />,
      traditional: "Hire animator: $500-$1,000\nWait days for delivery",
      withAI: "Create in 2 minutes",
      capacity: "Create approximately 20 professional videos"
    },
    {
      name: "Script-to-Video Generator", 
      value: "$1,497 Value",
      description: "Type one sentence and get a complete video with script, voiceover, visuals, and captions. Perfect for YouTube Shorts, TikTok, and Instagram Reels.",
      demo: <img src="/2.gif" alt="Script to Video Demo" className="w-full rounded-lg" loading="lazy" />,
      traditional: "Writer + Editor + Voice: $700\n3-5 days turnaround",
      withAI: "Complete video in 60 seconds", 
      capacity: "Produce approximately 20 viral-ready videos"
    },
    {
      name: "AI Thumbnail Maker",
      value: "$797 Value", 
      description: "Create eye-catching thumbnails with advanced face-swap technology. Get professional thumbnails that boost click-through rates by 300% or more.",
      demo: <img src="/6 thumbnail_1.gif" alt="Thumbnail Maker Demo" className="w-full rounded-lg" loading="lazy" />,
      traditional: "Designer: $50-100 each\n24 hour turnaround",
      withAI: "Instant thumbnails",
      capacity: "Design approximately 50 viral thumbnails"
    },
    {
      name: "Talking AI Avatar",
      value: "$1,497 Value",
      description: "Create spokesperson videos without being on camera. Choose from dozens of ultra-realistic avatars for sales videos, tutorials, and presentations.", 
      demo: <img src="/4 ai avatar_1.gif" alt="AI Avatar Demo" className="w-full rounded-lg" loading="lazy" />,
      traditional: "Hire actors: $500-$2,000/day\nPlus studio rental",
      withAI: "Instant avatar videos",
      capacity: "Create approximately 20 professional avatar videos"
    },
    {
      name: "AI Voiceover Studio",
      value: "$997 Value",
      description: "Natural voices in ANY language with emotion and emphasis. Dozens of premium voices with unlimited usage for all your content needs.",
      demo: (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <h4 className="text-lg font-bold text-blue-400 mb-3 text-center">🎤 Voice Samples</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <VoiceSamplePlayer audioUrl="/1.mp3" label="Professional Male" icon="👨‍💼" />
            <VoiceSamplePlayer audioUrl="/2.mp3" label="Friendly Voice" icon="🗣️" />
            <VoiceSamplePlayer audioUrl="/3.mp3" label="Energetic Youthful" icon="🧑‍🎤" />
          </div>
        </div>
      ),
      traditional: "Voice actor: $100-$500/script",
      withAI: "Unlimited voiceovers",
      unlimited: true
    },
    {
      name: "AI Ebook Writer", 
      value: "$1,997 Value",
      description: "Create complete ebooks with professional covers, formatting, and graphics. Perfect for lead magnets, info products, and Amazon publishing.",
      demo: <img src="/3 Ebook 2.gif" alt="Ebook Creation Demo" className="w-full rounded-lg" loading="lazy" />,
      traditional: "Writer: $500-$2,000\nDesigner: $500\nFormatter: $300",
      withAI: "Complete ebook in hours",
      unlimited: true
    },
    {
      name: "Content Multiplier",
      value: "$797 Value",
      description: "Turn one piece of content into dozens. Paste a YouTube link and get blog posts, emails, social media posts, and more.",
      demo: <img src="/8 multiply.gif" alt="Content Multiplier Demo" className="w-full rounded-lg" loading="lazy" />,
      traditional: "Content writer: $100-$300/piece",
      withAI: "Instant repurposing",
      unlimited: true
    },
    {
      name: "AI Logo Generator",
      value: "$497 Value",
      description: "Professional logos for any business or brand. Modify any element with simple text commands for the perfect design.",
      demo: <img src="/7 logo.gif" alt="Logo Generator Demo" className="w-full rounded-lg" loading="lazy" />,
      traditional: "Logo designer: $300-$5,000",
      withAI: "Unlimited designs",
      unlimited: true
    },
    {
      name: "AI Music Maker",
      value: "$597 Value", 
      description: "Create copyright-free music in any style. Never worry about copyright strikes or licensing fees again.",
      demo: (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <h4 className="text-lg font-bold text-purple-400 mb-3 text-center">🎵 Music Samples</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <VoiceSamplePlayer audioUrl="/music_2025-05-25T062942277Z.mp3" label="Cinematic Beat" icon="🎬" />
            <VoiceSamplePlayer audioUrl="/music_2025-05-26T164211454Z.mp3" label="Uplifting Pop" icon="🎹" />
          </div>
        </div>
      ),
      traditional: "Music licensing: $20-$100/track",
      withAI: "Unlimited tracks",
      unlimited: true
    },
    {
      name: "Trending Keywords Finder",
      value: "$497 Value",
      description: "Find exactly what people are searching for. See search volume, competition levels, and trending topics in real-time.",
      demo: <img src="/10 top keywords.gif" alt="Keywords Finder Demo" className="w-full rounded-lg" loading="lazy" />,
      traditional: "SEO tools: $100-$300/month",
      withAI: "Real-time data",
      unlimited: true
    },
    {
      name: "Top Offers Finder", 
      value: "$997 Value",
      description: "Find the highest-converting affiliate offers paying $50-150 per sale. Monetize your content from day one.",
      demo: <img src="/11 top offer.gif" alt="Top Offers Demo" className="w-full rounded-lg" loading="lazy" />,
      traditional: "Research team: $2,000/month",
      withAI: "Updated daily",
      unlimited: true
    },
    {
      name: "YouTube Trend Finder",
      value: "$297 Value",
      description: "See what's going viral RIGHT NOW. Discover videos getting millions of views and ride the wave.",
      demo: <img src="/12 youube trend.gif" alt="YouTube Trends Demo" className="w-full rounded-lg" loading="lazy" />,
      traditional: "Trend analyst: $1,500/month",
      withAI: "Real-time alerts",
      unlimited: true
    }
  ];

  useEffect(() => {
    const handleScroll = () => {
      const newVisibleCards: number[] = [];
      const newRevealed = new Set(revealedCards);
      
      cardsRef.current.forEach((card, index) => {
        if (card) {
          const rect = card.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          
          // Card starts becoming visible when it's within 1.2x viewport height
          // This makes the next card start appearing as the current one scrolls up
          if (rect.top < windowHeight * 1.2 && rect.bottom > -windowHeight * 0.2) {
            newVisibleCards.push(index);
            // Once revealed, always revealed
            newRevealed.add(index);
          }
        }
      });
      
      setVisibleCards(newVisibleCards);
      setRevealedCards(newRevealed);
    };

    handleScroll(); // Initial check
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [revealedCards]);

  return (
    <section className="w-full py-24 bg-zinc-950/50 text-white" id="arsenal">
      <div className="container mx-auto max-w-5xl px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6 uppercase tracking-wider">
            THE ARSENAL
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-[1.2]">
            12 Professional AI Apps
          </h2>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Each app individually worth hundreds of dollars • All included in your membership
          </p>
        </div>

        {/* Stacking Cards */}
        <div className="space-y-4">
          {apps.map((app, index) => (
            <div
              key={index}
              ref={el => cardsRef.current[index] = el}
              className={`
                bg-background rounded-xl p-8 border border-zinc-800 
                shadow-[0px_4px_20px_rgba(0,0,0,0.15)]
                transform
                ${revealedCards.has(index)
                  ? 'translate-y-0 opacity-100' 
                  : `transition-all duration-700 ease-out ${
                      visibleCards.includes(index) 
                        ? 'translate-y-0 opacity-100' 
                        : 'translate-y-32 opacity-20'
                    }`
                }
              `}
              style={{
                transitionDelay: revealedCards.has(index) ? '0ms' : `${index * 50}ms`
              }}
            >
              {/* App Header */}
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-2xl font-bold text-white">{app.name}</h3>
                <span className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold">
                  {app.value}
                </span>
              </div>
              
              <p className="text-gray-400 mb-6 leading-relaxed">{app.description}</p>

              {/* Demo */}
              {app.demo && (
                <div className="mb-6 bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  {app.demo}
                </div>
              )}

              {/* Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-gradient-to-br from-red-950/20 to-zinc-900 rounded-lg p-4 border border-red-900/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-500">❌</span>
                    <p className="text-sm font-semibold text-red-400">Traditional Way</p>
                  </div>
                  <p className="text-red-300 text-sm whitespace-pre-line">{app.traditional}</p>
                </div>
                
                <div className="bg-gradient-to-br from-emerald-950/20 to-zinc-900 rounded-lg p-4 border border-emerald-900/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-emerald-500">✅</span>
                    <p className="text-sm font-semibold text-emerald-400">With AI Media Machine</p>
                  </div>
                  <p className="text-emerald-300 text-sm whitespace-pre-line">{app.withAI}</p>
                </div>
              </div>

              {/* Capacity or Unlimited */}
              {app.capacity && (
                <div className="bg-blue-950/20 border border-blue-900/50 rounded-lg p-4 text-center">
                  <p className="text-blue-400 font-semibold mb-1">Monthly Capacity:</p>
                  <p className="text-blue-300 text-sm">{app.capacity}</p>
                </div>
              )}

              {app.unlimited && (
                <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-emerald-500">✅</span>
                    <p className="text-emerald-400 font-semibold">Unlimited Usage</p>
                  </div>
                  <p className="text-emerald-300 text-sm">Create as much as you want - no restrictions!</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Final CTA */}
        <div className="mt-24 bg-background rounded-xl p-10 border border-zinc-800 text-center shadow-[0px_4px_20px_rgba(0,0,0,0.15)]">
          <h3 className="text-3xl font-bold mb-8 text-white">What 50+ Pieces Weekly Really Means</h3>
          
          <p className="text-gray-300 text-lg mb-8">Picture this 30 days from now:</p>
          
          <div className="space-y-4 mb-8 text-left max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-xl">✓</span>
              <p className="text-gray-300">50 professional videos created (without showing your face)</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-xl">✓</span>
              <p className="text-gray-300">10 ebooks ready to sell or give away</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-xl">✓</span>
              <p className="text-gray-300">A month's worth of social content scheduled</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-xl">✓</span>
              <p className="text-gray-300">Your first affiliate commissions coming in</p>
            </div>
          </div>
          
          <p className="text-gray-400 text-lg italic mb-8">All for the price of a candy bar.</p>
          
          <div className="bg-blue-950/20 border border-blue-900/50 rounded-lg p-6 mb-8">
            <p className="text-blue-300 text-lg">
              While your competitors burn out trying to post daily,<br/>
              you'll have content for WEEKS ready to go.
            </p>
          </div>
          
          <Button 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            Start Building Your Content Empire →
          </Button>
        </div>
      </div>
    </section>
  );
}