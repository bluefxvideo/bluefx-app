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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BuyCreditsDialog } from '@/components/ui/buy-credits-dialog';
import { LiveChatButton } from '@/components/dashboard/live-chat-button';
import { ToolsGridSkeleton, CreditBalanceSkeleton, TutorialsSkeleton } from '@/components/dashboard/dashboard-skeletons';
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

  // Fetch user profile with better caching and error handling
  const { data: userProfile, isLoading: isLoadingProfile, error: profileError } = useQuery<UserProfile | null>({
    queryKey: ['user-profile'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    queryFn: async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }
      
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        // Don't throw here - profile might not exist yet
      }

      return { ...user, profile } as UserProfile;
    }
  });

  // Handle authentication errors by redirecting to login
  useEffect(() => {
    if (profileError && !isLoadingProfile) {
      console.error('Profile query failed:', profileError);
      router.push('/login?message=Session expired. Please log in again.');
    }
  }, [profileError, isLoadingProfile, router]);

  const displayName = userProfile?.user_metadata?.full_name || 
                      userProfile?.email?.split('@')[0] || 
                      'User';

  // Fetch tutorials with better caching
  const { data: tutorials = [], isLoading: isLoadingTutorials } = useQuery<Tutorial[]>({
    queryKey: ['tutorials'],
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
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
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">
          Hey there, {displayName}!
        </h1>
        <p className="text-muted-foreground">
          Welcome back, we&apos;re happy to have you here!
        </p>
      </div>
      
      {/* Navigation Tabs */}
      <div className="flex gap-8 border-b mb-6">
        <button 
          className="pb-3 text-sm font-medium text-foreground border-b-2 border-primary"
          onClick={() => router.push('/dashboard')}
        >
          Dashboard
        </button>
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard/usage')}
        >
          Usage
        </button>
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard/profile')}
        >
          Profile
        </button>
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard/subscription')}
        >
          Subscription
        </button>
        {currentUser?.profile?.role === 'admin' && (
          <button 
            className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => router.push('/dashboard/admin')}
          >
            Admin
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Tools Grid */}
        <div className="mb-8">
          {isLoadingProfile ? (
            <ToolsGridSkeleton />
          ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Tools</CardTitle>
                  <CardDescription>Access your creative toolkit</CardDescription>
                </div>
                <span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded-full">
                  Active
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {availableTools.map((tool, index) => (
                  <div 
                    key={index} 
                    className="flex flex-col items-center justify-center p-3 cursor-pointer rounded-lg bg-secondary hover:bg-secondary/80 transition-all hover:scale-105"
                    onClick={() => handleToolClick(tool.route)}
                  >
                    <div className={`relative bg-gradient-to-br ${tool.gradient} w-12 h-12 flex items-center justify-center text-white rounded-lg shadow-sm`}>
                      <tool.icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs mt-2 text-center font-medium text-muted-foreground whitespace-nowrap">
                      {tool.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          )}
        </div>

        {/* Credit Balance and Community Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {isLoadingCredits ? (
            <CreditBalanceSkeleton />
          ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Credit Balance</CardTitle>
                  <CardDescription>Your current available credits</CardDescription>
                </div>
                <span className="px-3 py-1 ">
                  Monthly
                </span>
              </div>
            </CardHeader>
            <CardContent>
            <div className="space-y-4">
              {isPurchasing && (
                <div className="flex items-center space-x-2 text-blue-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing purchase...</span>
                </div>
              )}
              <div>
                <p className="text-3xl font-bold text-white">
                  {credits?.available_credits || 0}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  Credits remaining
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Credits refresh monthly with your subscription
              </p>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <Button 
                className=""
                disabled={isPurchasing}
                onClick={() => setIsBuyCreditsDialogOpen(true)}
              >
                {isPurchasing ? 'Processing...' : 'Buy More Credits'}
              </Button>
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={handleViewUsage}
              >
                <BarChart className="h-4 w-4" />
                View Usage
              </Button>
            </div>
            </CardContent>
          </Card>
          )}

          {/* Community & Support */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Join Our Community</CardTitle>
                  <CardDescription>Connect with other creators</CardDescription>
                </div>
                <Facebook className="w-8 h-8 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
            <p className="text-foreground mb-4">
              Get support, share your creations, and collaborate with other users in our active Facebook community.
            </p>
            <div className="space-y-3">
              <a 
                href="https://web.facebook.com/groups/1920880798699387" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="block"
              >
                <Button variant="outline" className="w-full">
                  View Community
                </Button>
              </a>
              <div className="flex justify-center">
                <LiveChatButton />
              </div>
            </div>
            </CardContent>
          </Card>
        </div>

        {/* Featured Tutorial */}
        <Card className="mb-8 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Full App Walkthrough</CardTitle>
                <CardDescription>Learn everything about AI Media Machine in one video</CardDescription>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                Featured
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <iframe
                src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
                title="Full App Walkthrough"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </CardContent>
        </Card>

        {/* Tool Tutorials */}
        <h2 className="text-xl font-semibold mb-4">Tool Tutorials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoadingTutorials || isLoadingProfile ? (
            <TutorialsSkeleton />
          ) : tutorials.length > 0 ? (
            tutorials.map((tutorial: Tutorial) => {
              const videoId = tutorial.video_url ? getYouTubeVideoId(tutorial.video_url as string) : null;
              
              return (
                <Card key={tutorial.id}>
                  <CardContent className="p-4">
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
                          className="p-2 "
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
                    <h3 className="text-base font-medium">{tutorial.title}</h3>
                    {tutorial.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {tutorial.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Tool: {tutorial.tool_name}
                    </p>
                  </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No tutorials available yet.
            </div>
          )}
          
          {currentUser?.profile?.role === 'admin' && !isLoadingProfile && (
            <Card className="border-2 border-dashed">
              <div className="aspect-video flex items-center justify-center">
                <button
                  className="p-4 text-muted-foreground hover:text-foreground transition-colors flex flex-col items-center"
                >
                  <Upload className="h-12 w-12 mb-2" />
                  <p>Upload New Tutorial</p>
                </button>
              </div>
            </Card>
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