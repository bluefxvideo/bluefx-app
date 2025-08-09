'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/app/supabase/client';
import { useCredits } from '@/hooks/useCredits';
import { 
  Image, 
  UserRound, 
  Film, 
  Video, 
  Layers, 
  Mic, 
  BookOpen, 
  Palette, 
  Music, 
  BarChart,
  FileText,
  Facebook,
  Upload,
  Edit3,
  Trash2,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuyCreditsDialog } from '@/components/ui/buy-credits-dialog';
import type { Tables } from '@/types/database';
import type { User } from '@supabase/supabase-js';

// Define proper types
type UserProfile = User & {
  profile?: Tables<'profiles'> | null;
};

type Tutorial = Tables<'tutorials'>;

// Legacy-style tools array
const availableTools = [
  {
    name: "Thumbnail Machine",
    icon: Image,
    route: "/dashboard/thumbnail-machine",
    gradient: "from-blue-400 to-cyan-300",
  },
  {
    name: "Talking Avatar", 
    icon: UserRound,
    route: "/dashboard/talking-avatar",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    name: "Script Writer",
    icon: FileText,
    route: "/dashboard/script-writer",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    name: "Script to Video",
    icon: Film,
    route: "/dashboard/script-to-video",
    gradient: "from-red-400 to-orange-300",
  },
  {
    name: "AI Cinematographer",
    icon: Video,
    route: "/dashboard/ai-cinematographer",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    name: "Content Multiplier",
    icon: Layers,
    route: "/dashboard/content-multiplier",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    name: "Voice Over",
    icon: Mic,
    route: "/dashboard/voice-over",
    gradient: "from-yellow-400 to-amber-300",
  },
  {
    name: "Ebook Writer",
    icon: BookOpen,
    route: "/dashboard/ebook-writer",
    gradient: "from-teal-400 to-cyan-300",
  },
  {
    name: "Logo Generator",
    icon: Palette,
    route: "/dashboard/logo-generator",
    gradient: "from-pink-400 to-rose-300",
  },
  {
    name: "Music Maker",
    icon: Music,
    route: "/dashboard/music-maker",
    gradient: "from-blue-500 to-cyan-500",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isBuyCreditsDialogOpen, setIsBuyCreditsDialogOpen] = useState(false);
  const { credits, isLoading: isLoadingCredits, isPurchasing } = useCredits();

  // Fetch user profile
  const { data: userProfile, isLoading: isLoadingProfile } = useQuery<UserProfile | null>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return { ...user, profile } as UserProfile;
    }
  });

  const displayName = userProfile?.user_metadata?.full_name || 
                      userProfile?.email?.split('@')[0] || 
                      'User';

  // Fetch tutorials
  const { data: tutorials = [], isLoading: isLoadingTutorials } = useQuery<Tutorial[]>({
    queryKey: ['tutorials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    setCurrentUser(userProfile || null);
  }, [userProfile]);

  const handleToolClick = (route: string) => {
    router.push(route);
  };

  const handleViewUsage = () => {
    router.push('/dashboard/usage');
  };

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  return (
    <div className="h-full bg-[#0f0f0f]">
      {/* Welcome Header with Tabs */}
      <div className="px-6 pt-6 pb-4">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white mb-1">
            Hey there, {displayName}!
          </h1>
          <p className="text-sm text-zinc-400">
            Welcome back, we&apos;re happy to have you here!
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex gap-8 border-b border-zinc-800">
          <button className="pb-3 text-sm font-medium text-white border-b-2 border-blue-500">
            My Tasks
          </button>
          <button className="pb-3 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
            Profile
          </button>
          <button className="pb-3 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
            Stats
          </button>
          <button className="pb-3 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
            Inbox
          </button>
          <button className="pb-3 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
            Team
          </button>
          <button className="pb-3 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
            Settings
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 overflow-y-auto scrollbar-hover">
        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Expenses Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Total Expenses</span>
              <span className="px-2 py-1 bg-red-500/10 text-red-500 text-xs font-medium rounded">↓ Loss</span>
            </div>
            <p className="text-2xl font-bold text-white">$27,340</p>
          </div>

          {/* Total Revenue Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Total Revenue</span>
              <span className="px-2 py-1 bg-red-500/10 text-red-500 text-xs font-medium rounded">↓ Loss</span>
            </div>
            <p className="text-2xl font-bold text-white">$128.47</p>
          </div>

          {/* Total Credits Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Total Credits</span>
              <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded">✓ Label</span>
            </div>
            <p className="text-2xl font-bold text-white">$990.66</p>
          </div>
        </div>

        {/* Tools Grid - Styled like Dribbble cards */}
        <div className="mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Your Tools</h2>
                <p className="text-sm text-zinc-400">Access your creative toolkit</p>
              </div>
              <span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded-full">
                Active
              </span>
            </div>
            {isLoadingProfile ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {availableTools.map((tool, index) => (
                  <div 
                    key={index} 
                    className="flex flex-col items-center justify-center p-3 cursor-pointer rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all hover:scale-105"
                    onClick={() => handleToolClick(tool.route)}
                  >
                    <div className={`relative bg-gradient-to-br ${tool.gradient} w-12 h-12 flex items-center justify-center text-white rounded-lg shadow-sm`}>
                      <tool.icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs mt-2 text-center font-medium text-zinc-300 whitespace-nowrap">
                      {tool.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Credit Balance and Community Cards - Styled like Dribbble */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Credit Balance</h3>
                <p className="text-sm text-zinc-400">Your current available credits</p>
              </div>
              <span className="px-3 py-1 bg-blue-500/10 text-blue-500 text-xs font-medium rounded-full">
                Monthly
              </span>
            </div>
            <div className="space-y-4">
              {isPurchasing && (
                <div className="flex items-center space-x-2 text-blue-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing purchase...</span>
                </div>
              )}
              {isLoadingCredits ? (
                <div className="flex items-center space-x-2 text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading credits...</span>
                </div>
              ) : (
                <div>
                  <p className="text-3xl font-bold text-white">
                    {credits?.available_credits || 0}
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    Credits remaining
                  </p>
                </div>
              )}
              <p className="text-xs text-zinc-500 mt-2">
                Credits refresh monthly with your subscription
              </p>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <Button 
                className="bg-blue-500 hover:bg-blue-600 text-white"
                disabled={isPurchasing}
                onClick={() => setIsBuyCreditsDialogOpen(true)}
              >
                {isPurchasing ? 'Processing...' : 'Buy More Credits'}
              </Button>
              <Button 
                variant="outline" 
                className="flex items-center gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={handleViewUsage}
              >
                <BarChart className="h-4 w-4" />
                View Usage
              </Button>
            </div>
          </div>

          {/* Community & Support */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Join Our Community</h3>
                <p className="text-sm text-zinc-400">Connect with other creators</p>
              </div>
              <Facebook className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-zinc-300 mb-4">
              Get support, share your creations, and collaborate with other users in our active Facebook community.
            </p>
            <a 
              href="https://web.facebook.com/groups/1920880798699387" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="block"
            >
              <Button variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                View Community
              </Button>
            </a>
          </div>
        </div>

        {/* Tool Tutorials */}
        <h2 className="text-xl font-semibold text-white mb-4">Tool Tutorials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoadingTutorials || isLoadingProfile ? (
            <div className="col-span-full flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : tutorials.length > 0 ? (
            tutorials.map((tutorial: Tutorial) => {
              const videoId = tutorial.video_url ? getYouTubeVideoId(tutorial.video_url as string) : null;
              
              return (
                <div key={tutorial.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                  <div className="aspect-video bg-muted relative rounded-sm overflow-hidden">
                    {videoId ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title={tutorial.title as string}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        Invalid video URL
                      </div>
                    )}
                    {currentUser?.profile?.role === 'admin' && (
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button
                          className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-lg"
                          title="Edit Tutorial"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                          title="Delete Tutorial"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-medium text-white">{tutorial.title}</h3>
                    {tutorial.description && (
                      <p className="text-sm text-zinc-400 mt-1">
                        {tutorial.description}
                      </p>
                    )}
                    <p className="text-xs text-zinc-500 mt-2">
                      Tool: {tutorial.tool_name}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-8 text-zinc-500">
              No tutorials available yet.
            </div>
          )}
          
          {currentUser?.profile?.role === 'admin' && !isLoadingProfile && (
            <div className="bg-zinc-900/50 border-2 border-dashed border-zinc-700 rounded-xl overflow-hidden">
              <div className="aspect-video flex items-center justify-center">
                <button
                  className="p-4 text-zinc-500 hover:text-zinc-300 transition-colors flex flex-col items-center"
                >
                  <Upload className="h-12 w-12 mb-2" />
                  <p>Upload New Tutorial</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Buy Credits Dialog */}
      <BuyCreditsDialog
        open={isBuyCreditsDialogOpen}
        onOpenChange={setIsBuyCreditsDialogOpen}
      />
    </div>
  );
}