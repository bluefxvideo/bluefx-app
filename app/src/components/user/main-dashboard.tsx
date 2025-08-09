'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/app/supabase/client'
import { useCredits } from '@/hooks/useCredits'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { BuyCreditsDialog } from '@/components/ui/buy-credits-dialog'

// Legacy-style tools array (flat structure like the original)
const availableTools = [
  {
    name: "Thumbnail Machine",
    icon: Image,
    route: "/thumbnail-machine",
    gradient: "from-blue-400 to-cyan-300",
  },
  {
    name: "Talking Avatar",
    icon: UserRound,
    route: "/talking-avatar",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    name: "Script Writer",
    icon: FileText,
    route: "/script-writer",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    name: "Script to Video",
    icon: Film,
    route: "/script-to-video",
    gradient: "from-red-400 to-orange-300",
  },
  {
    name: "AI Cinematographer",
    icon: Video,
    route: "/ai-cinematographer",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    name: "Content Multiplier",
    icon: Layers,
    route: "/content-multiplier",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    name: "Voice Over",
    icon: Mic,
    route: "/voice-over",
    gradient: "from-yellow-400 to-amber-300",
  },
  {
    name: "Ebook Writer",
    icon: BookOpen,
    route: "/ebook-writer",
    gradient: "from-teal-400 to-cyan-300",
  },
  {
    name: "Logo Generator",
    icon: Palette,
    route: "/logo-generator",
    gradient: "from-pink-400 to-rose-300",
  },
  {
    name: "Music Maker",
    icon: Music,
    route: "/music-maker",
    gradient: "from-blue-500 to-cyan-500",
  },
]

export function MainDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<Record<string, unknown> | null>(null)
  const [isBuyCreditsDialogOpen, setIsBuyCreditsDialogOpen] = useState(false)
  const { credits, isLoading: isLoadingCredits, isPurchasing } = useCredits()

  // Fetch user profile
  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      return { ...user, profile }
    }
  })

  // Fetch tutorials
  const { data: tutorials = [], isLoading: isLoadingTutorials } = useQuery({
    queryKey: ['tutorials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  useEffect(() => {
    setCurrentUser(userProfile as any)
  }, [userProfile])

  const handleToolClick = (route: string) => {
    router.push(route)
  }

  const handleViewUsage = () => {
    router.push('/dashboard/usage')
  }

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/
    const match = url.match(regex)
    return match ? match[1] : null
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hover">
      {/* Welcome Header */}
      <div className="mb-8 bg-background border border-border/30 text-card-foreground p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">Welcome back!</h1>
            <p className="text-muted-foreground">Join our community and get help from fellow members.</p>
            <a 
              href="https://web.facebook.com/groups/1920880798699387" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="mt-2 inline-block"
            >
              <Button variant="outline">Join our Facebook Group</Button>
            </a>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="mb-8">
        <Card className="bg-background border-border/30 shadow-md">
          <CardHeader>
            <CardTitle>Your Membership is Active</CardTitle>
            <CardDescription>Unlimited access to all courses and premium features</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingProfile ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                {availableTools.map((tool, index) => (
                  <div 
                    key={index} 
                    className="flex flex-col items-center justify-center p-2 cursor-pointer relative transition-all hover:scale-105"
                    onClick={() => handleToolClick(tool.route)}
                  >
                    <div className={`relative bg-gradient-to-br ${tool.gradient} w-12 h-12 flex items-center justify-center text-white rounded-lg shadow-sm`}>
                      <tool.icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs mt-1 text-center font-medium text-foreground whitespace-nowrap">
                      {tool.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Credit Balance and Community Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="bg-background border-border/30 shadow-md">
          <CardHeader>
            <CardTitle>Credit Balance</CardTitle>
            <CardDescription>Your current available credits</CardDescription>
          </CardHeader>
          <CardContent>
            {isPurchasing && (
              <div className="flex items-center space-x-2 text-blue-500 mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Processing purchase...</span>
              </div>
            )}
            {isLoadingCredits ? (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading credits...</span>
              </div>
            ) : (
              <p className="text-2xl font-semibold">
                You have {credits?.available_credits || 0} credits left
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Credits refresh monthly with your subscription
            </p>
          </CardContent>
          <CardFooter className="flex items-center gap-3">
            <Button 
              className="bg-blue-500 hover:bg-blue-600 text-white"
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
          </CardFooter>
        </Card>

        {/* Community & Support */}
        <Card className="flex flex-col bg-background border-border/30 shadow-md">
          <CardHeader>
            <CardTitle>Join Our Facebook Community</CardTitle>
            <CardDescription>
              Stay connected and grow with our community.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="flex items-center">
              <Facebook className="w-10 h-10 mr-4 text-blue-600" />
              <p className="text-muted-foreground">
                Get support, share your creations, and collaborate with other users.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <a 
              href="https://web.facebook.com/groups/1920880798699387" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full"
            >
              <Button variant="outline" className="w-full">View Community</Button>
            </a>
          </CardFooter>
        </Card>
      </div>

      {/* Tool Tutorials */}
      <h2 className="text-2xl font-bold mb-4">Tool Tutorials</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoadingTutorials || isLoadingProfile ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tutorials.length > 0 ? (
          tutorials.map((tutorial) => {
            const videoId = tutorial.video_url ? getYouTubeVideoId(tutorial.video_url) : null
            
            return (
              <Card key={tutorial.id} className="overflow-hidden p-4 bg-background border-border/30 shadow-md">
                <div className="aspect-video bg-muted relative rounded-sm overflow-hidden">
                  {videoId ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title={tutorial.title}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      Invalid video URL
                    </div>
                  )}
                  {(currentUser as any)?.profile?.role === 'admin' && (
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
                <CardHeader>
                  <CardTitle>{tutorial.title}</CardTitle>
                  {tutorial.description && (
                    <CardDescription>
                      {tutorial.description}
                    </CardDescription>
                  )}
                  <CardDescription className="text-xs text-muted-foreground">
                    Tool: {tutorial.tool_name}
                  </CardDescription>
                </CardHeader>
              </Card>
            )
          })
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No tutorials available yet.
          </div>
        )}
        
        {(currentUser as any)?.profile?.role === 'admin' && !isLoadingProfile && (
          <Card className="overflow-hidden border-2 border-dashed border-muted-foreground/50 content-center bg-background shadow-md">
            <div className="aspect-video flex items-center justify-center">
              <button
                className="p-4 text-muted-foreground hover:text-primary transition-colors flex flex-col items-center"
              >
                <Upload className="h-12 w-12 mb-2" />
                <p>Upload New Tutorial</p>
              </button>
            </div>
          </Card>
        )}
      </div>
      
      {/* Buy Credits Dialog */}
      <BuyCreditsDialog
        open={isBuyCreditsDialogOpen}
        onOpenChange={setIsBuyCreditsDialogOpen}
      />
    </div>
  )
}