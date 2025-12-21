'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/app/supabase/client';
import { useCredits } from '@/hooks/useCredits';
import {
  BarChart,
  Upload,
  Edit3,
  Trash2,
  Loader2,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BuyCreditsDialog } from '@/components/ui/buy-credits-dialog';
import { LiveChatButton } from '@/components/dashboard/live-chat-button';
import { CreditBalanceSkeleton, TutorialsSkeleton } from '@/components/dashboard/dashboard-skeletons';
import { toast } from 'sonner';
import type { Tables } from '@/types/database';
import type { User } from '@supabase/supabase-js';

// Define proper types
type UserProfile = User & {
  profile?: Tables<'profiles'> | null;
};

type Tutorial = Tables<'tutorials'>;

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isBuyCreditsDialogOpen, setIsBuyCreditsDialogOpen] = useState(false);
  const { credits, isLoading: isLoadingCredits, isPurchasing } = useCredits();

  // Tutorial dialog state
  const [tutorialDialogOpen, setTutorialDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
  const [tutorialForm, setTutorialForm] = useState({
    title: '',
    description: '',
    video_url: '',
    tool_name: ''
  });
  const [isSaving, setIsSaving] = useState(false);

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
        .neq('tool_name', 'featured') // Exclude featured tutorial from regular list
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  // Fetch featured tutorial separately
  const { data: featuredTutorial } = useQuery<Tutorial | null>({
    queryKey: ['featured-tutorial'],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .eq('tool_name', 'featured')
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
      return data || null;
    }
  });

  useEffect(() => {
    setCurrentUser(userProfile || null);
  }, [userProfile]);

  const handleViewUsage = () => {
    router.push('/dashboard/usage');
  };

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Tutorial handlers
  const openCreateTutorial = () => {
    setEditingTutorial(null);
    setTutorialForm({ title: '', description: '', video_url: '', tool_name: '' });
    setTutorialDialogOpen(true);
  };

  const openEditTutorial = (tutorial: Tutorial) => {
    setEditingTutorial(tutorial);
    setTutorialForm({
      title: tutorial.title || '',
      description: tutorial.description || '',
      video_url: tutorial.video_url || '',
      tool_name: tutorial.tool_name || ''
    });
    setTutorialDialogOpen(true);
  };

  const openDeleteDialog = (tutorial: Tutorial) => {
    setEditingTutorial(tutorial);
    setDeleteDialogOpen(true);
  };

  const handleSaveTutorial = async () => {
    if (!tutorialForm.title || !tutorialForm.video_url) {
      toast.error('Title and Video URL are required');
      return;
    }

    setIsSaving(true);
    try {
      if (editingTutorial) {
        // Update existing tutorial
        const { error } = await supabase
          .from('tutorials')
          .update({
            title: tutorialForm.title,
            description: tutorialForm.description,
            video_url: tutorialForm.video_url,
            tool_name: tutorialForm.tool_name
          })
          .eq('id', editingTutorial.id);

        if (error) throw error;
        toast.success('Tutorial updated successfully');
      } else {
        // Create new tutorial
        const { error } = await supabase
          .from('tutorials')
          .insert({
            title: tutorialForm.title,
            description: tutorialForm.description,
            video_url: tutorialForm.video_url,
            tool_name: tutorialForm.tool_name,
            content: '',
            category: 'tutorial'
          });

        if (error) throw error;
        toast.success('Tutorial created successfully');
      }

      setTutorialDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tutorials'] });
      queryClient.invalidateQueries({ queryKey: ['featured-tutorial'] });
    } catch (error) {
      console.error('Error saving tutorial:', error);
      toast.error('Failed to save tutorial');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTutorial = async () => {
    if (!editingTutorial) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('tutorials')
        .delete()
        .eq('id', editingTutorial.id);

      if (error) throw error;
      toast.success('Tutorial deleted successfully');
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tutorials'] });
      queryClient.invalidateQueries({ queryKey: ['featured-tutorial'] });
    } catch (error) {
      console.error('Error deleting tutorial:', error);
      toast.error('Failed to delete tutorial');
    } finally {
      setIsSaving(false);
    }
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
                  <CardTitle>Join AI Creators Club</CardTitle>
                  <CardDescription>Connect with other creators</CardDescription>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
            <p className="text-foreground mb-4">
              Get support, share your creations, and collaborate with other users in our active community.
            </p>
            <div className="space-y-3">
              <a
                href="https://www.skool.com/ai-creators-club-1525"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="outline" className="w-full">
                  Join AI Creators Club
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
        {featuredTutorial && featuredTutorial.video_url && (
          <Card className="mb-8 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{featuredTutorial.title}</CardTitle>
                  <CardDescription>{featuredTutorial.description || 'Learn everything about AI Media Machine in one video'}</CardDescription>
                </div>
                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                  Featured
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                {getYouTubeVideoId(featuredTutorial.video_url) ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(featuredTutorial.video_url)}`}
                    title={featuredTutorial.title}
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
                      className="p-2 bg-zinc-800/80 text-white rounded-full hover:bg-zinc-700 transition-colors shadow-lg"
                      title="Edit Tutorial"
                      onClick={() => openEditTutorial(featuredTutorial)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      title="Delete Tutorial"
                      onClick={() => openDeleteDialog(featuredTutorial)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
                          className="p-2 bg-zinc-800/80 text-white rounded-full hover:bg-zinc-700 transition-colors shadow-lg"
                          title="Edit Tutorial"
                          onClick={() => openEditTutorial(tutorial)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                          title="Delete Tutorial"
                          onClick={() => openDeleteDialog(tutorial)}
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
                  onClick={openCreateTutorial}
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

      {/* Tutorial Edit/Create Dialog */}
      <Dialog open={tutorialDialogOpen} onOpenChange={setTutorialDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTutorial ? 'Edit Tutorial' : 'Create New Tutorial'}</DialogTitle>
            <DialogDescription>
              {editingTutorial ? 'Update the tutorial details below.' : 'Add a new tutorial video.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={tutorialForm.title}
                onChange={(e) => setTutorialForm({ ...tutorialForm, title: e.target.value })}
                placeholder="Tutorial title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={tutorialForm.description}
                onChange={(e) => setTutorialForm({ ...tutorialForm, description: e.target.value })}
                placeholder="Brief description of the tutorial"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video_url">YouTube Video URL *</Label>
              <Input
                id="video_url"
                value={tutorialForm.video_url}
                onChange={(e) => setTutorialForm({ ...tutorialForm, video_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tool_name">Tool Name</Label>
              <Input
                id="tool_name"
                value={tutorialForm.tool_name}
                onChange={(e) => setTutorialForm({ ...tutorialForm, tool_name: e.target.value })}
                placeholder="e.g., Thumbnail Machine, featured"
              />
              <p className="text-xs text-muted-foreground">
                Use &quot;featured&quot; to make this the main featured tutorial
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTutorialDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTutorial} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingTutorial ? 'Save Changes' : 'Create Tutorial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Tutorial</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{editingTutorial?.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTutorial} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}