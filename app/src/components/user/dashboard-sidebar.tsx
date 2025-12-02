'use client'

import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
// import NextImage from 'next/image'
import {
  Image,
  Video,
  Mic,
  BookOpen,
  Palette,
  Music,
  BarChart,
  UserRound,
  Film,
  Layers,
  CreditCard,
  TrendingUp,
  DollarSign,
  Search,
  User,
  LogOut,
  ChevronUp,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  Repeat,
  FileText,
  Shield
} from 'lucide-react'
import { createClient } from '@/app/supabase/client'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { signOut } from '@/actions/auth'
import { useTheme } from 'next-themes'
import { useDashboardLayout } from './dashboard-layout-context'

// Tool interface
interface Tool {
  name: string;
  route: string;
  icon: any;
  gradient: string;
  description: string;
  disabled?: boolean;
  comingSoon?: string;
}

// Tool categories with their navigation data
const toolCategories = [
  {
    id: "image",
    name: "Image Tools",
    tools: [
      {
        name: "Thumbnail Machine",
        route: "/dashboard/thumbnail-machine",
        icon: Image,
        gradient: "bg-primary",
        description: "Create engaging thumbnails",
      },
      {
        name: "Logo Generator",
        route: "/dashboard/logo-generator",
        icon: Palette,
        gradient: "bg-primary",
        description: "Design professional logos",
      },
    ],
  },
  {
    id: "video",
    name: "Video Tools",
    tools: [
      {
        name: "AI Cinematographer",
        route: "/dashboard/ai-cinematographer",
        icon: Video,
        gradient: "bg-primary",
        description: "Professional video creation",
      },
      {
        name: "Script to Video",
        route: "/dashboard/script-to-video",
        icon: Film,
        gradient: "bg-primary",
        description: "Convert scripts to videos",
      },
      {
        name: "Talking Avatar",
        route: "/dashboard/talking-avatar",
        icon: UserRound,
        gradient: "bg-primary",
        description: "Create talking avatars",
      },
      {
        name: "Video Swap",
        route: "/dashboard/video-swap",
        icon: Repeat,
        gradient: "bg-primary",
        description: "Swap characters in videos",
      },
    ],
  },
  {
    id: "audio",
    name: "Audio Tools",
    tools: [
      {
        name: "Voice Over",
        route: "/dashboard/voice-over",
        icon: Mic,
        gradient: "bg-primary",
        description: "Professional AI voice generation",
      },
      {
        name: "Music Maker",
        route: "/dashboard/music-maker",
        icon: Music,
        gradient: "bg-primary",
        description: "Generate AI music with MusicGen",
      },
    ],
  },
  {
    id: "content",
    name: "Content Tools",
    tools: [
      {
        name: "Ebook Writer",
        route: "/dashboard/ebook-writer",
        icon: BookOpen,
        gradient: "from-emerald-500 to-teal-500",
        description: "Write complete ebooks with AI",
      },
      {
        name: "Content Multiplier",
        route: "/dashboard/content-multiplier",
        icon: Layers,
        gradient: "bg-primary",
        description: "Multi-platform social content",
      },
    ],
  },
  {
    id: "research",
    name: "Research",
    tools: [
      {
        name: "Trending Keywords",
        route: "/dashboard/trending-keywords",
        icon: Search,
        gradient: "bg-primary",
        description: "Find trending keywords",
      },
      {
        name: "Viral Trends",
        route: "/dashboard/viral-trends",
        icon: TrendingUp,
        gradient: "bg-primary",
        description: "Discover viral content",
      },
      {
        name: "Top Offers",
        route: "/dashboard/top-offers",
        icon: DollarSign,
        gradient: "from-yellow-500 to-amber-500",
        description: "Find the best affiliate offers",
      },
    ],
  },
  {
    id: "affiliate",
    name: "Affiliate Toolkit",
    tools: [
      {
        name: "Script Generator",
        route: "/dashboard/script-generator",
        icon: FileText,
        gradient: "bg-primary",
        description: "Generate affiliate marketing scripts",
      },
    ],
  },
];

interface DashboardSidebarProps {
  isCollapsed?: boolean
}

export function DashboardSidebar({ 
  isCollapsed = false
}: DashboardSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const { toggleSidebar } = useDashboardLayout()
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const accountDropdownRef = useRef<HTMLDivElement>(null)

  // Check if user is admin
  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        setIsAdmin(profile?.role === 'admin')
      }
    }
    checkAdmin()
  }, [])

  const isToolActive = (route: string) => {
    return pathname === route || pathname?.startsWith(route + '/')
  }

  const handleToolClick = (route: string, disabled?: boolean) => {
    if (!disabled) {
      router.push(route)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }



  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex h-screen flex-col bg-background border-r border-border transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-72"
        )}
      >
        {/* Logo Section with Collapse Toggle */}
        <div className="p-4 pr-4 border-b border-border flex items-center justify-between">
          {!isCollapsed && (
            <button
              onClick={() => router.push('/dashboard')}
              className="ml-2 text-xl font-bold text-white hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-2"
            >
              BlueFX
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5 ">
                BETA
              </Badge>
            </button>
          )}
          {isCollapsed && <div className="w-full" />}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors group"
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? (
              <PanelLeft className="h-5 w-5 text-zinc-400 group-hover:text-white transition-colors" />
            ) : (
              <PanelLeftClose className="h-5 w-5 text-zinc-400 group-hover:text-white transition-colors" />
            )}
          </button>
        </div>

        {/* Tool categories */}
        <div className="flex-1 overflow-y-auto overflow-x-visible p-2 space-y-4 scrollbar-hover">
          {toolCategories.map((category) => (
            <div key={category.id}>
              {!isCollapsed && (
                <h3 className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {category.name}
                </h3>
              )}

              <div className="space-y-1">
                {category.tools.map((tool) => (
                  <Tooltip key={tool.route} delayDuration={500}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "group w-full h-12 justify-start rounded-lg transition-all duration-300",
                          isCollapsed ? "p-2" : "p-3",
                          tool.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                        )}
                        onClick={() => handleToolClick(tool.route, tool.disabled)}
                      >
                        <div className="flex items-center w-full relative">
                          <div
                            className={cn(
                              "flex items-center justify-center rounded-lg transition-all duration-300 ease-in-out",
                              "aspect-square shrink-0",
                              isCollapsed ? "w-8 h-8" : "w-10 h-10",
                              isToolActive(tool.route)
                                ? "bg-primary"
                                : "bg-card"
                            )}
                          >
                            <tool.icon
                              className={cn(
                                "transition-all duration-300",
                                "w-5 h-5", // Consistent icon size
                                isToolActive(tool.route)
                                  ? "text-white"
                                  : "text-zinc-400"
                              )}
                            />
                          </div>

                          <div
                            className={cn(
                              "flex-1 text-left ml-3 overflow-hidden transition-all duration-300 ease-in-out",
                              isCollapsed
                                ? "opacity-0 max-w-0"
                                : "opacity-100 max-w-full"
                            )}
                          >
                            <p
                              className={cn(
                                "text-base font-medium leading-none whitespace-nowrap transition-all duration-300",
                                isToolActive(tool.route)
                                  ? "text-white"
                                  : "text-zinc-400"
                              )}
                            >
                              {tool.name}
                            </p>
                          </div>
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className={isCollapsed || tool.disabled ? "" : "hidden"}
                    >
                      <p className="font-medium">{tool.name}</p>
                      {tool.disabled && (
                        <p className="text-sm text-white mt-1">{tool.comingSoon}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer with account management */}
        <div className="p-2 space-y-1 border-t border-border">
          {/* My Account Dropdown */}
          <div className="relative" ref={accountDropdownRef}>
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full h-12 p-2 justify-start cursor-pointer relative group rounded-lg",
                    isCollapsed ? "px-2" : "px-3"
                  )}
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                >
                  <div className="flex items-center w-full relative">
                    <div
                      className={cn(
                        "flex items-center justify-center rounded-lg transition-all duration-300 ease-in-out",
                        "bg-card",
                        "aspect-square shrink-0",
                        isCollapsed ? "w-8 h-8 mx-auto" : "w-10 h-10"
                      )}
                    >
                      <User
                        className={cn(
                          "text-zinc-400 transition-colors",
                          "w-5 h-5"
                        )}
                      />
                    </div>

                    <div
                      className={cn(
                        "flex-1 text-left ml-3 overflow-hidden transition-all duration-300 ease-in-out",
                        isCollapsed
                          ? "opacity-0 max-w-0"
                          : "opacity-100 max-w-full"
                      )}
                    >
                      <span className="text-base font-medium whitespace-nowrap text-zinc-400 transition-colors duration-300">
                        My Account
                      </span>
                    </div>

                    {!isCollapsed && (
                      <ChevronUp
                        className={cn(
                          "w-4 h-4 text-zinc-400 transition-transform duration-300 ease-in-out",
                          showAccountDropdown ? "rotate-180" : ""
                        )}
                      />
                    )}
                  </div>
                </Button>
              </TooltipTrigger>

              {isCollapsed && (
                <TooltipContent
                  side="right"
                  className={isCollapsed ? "" : "hidden"}
                >
                  <p>My Account</p>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Account Dropdown Menu */}
            {showAccountDropdown && (
              <div
                className={cn(
                  "absolute bottom-full mb-1 bg-card border border-border rounded-lg z-50",
                  isCollapsed ? "left-16 w-64" : "left-0 w-full"
                )}
              >
                <div className="p-1 space-y-1">
                  {/* Profile */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-2 text-base cursor-pointer text-primary transition-colors hover:bg-primary/10"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      router.push("/dashboard/profile");
                    }}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Button>

                  {/* Subscription */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-2 text-base cursor-pointer text-primary transition-colors hover:bg-primary/10"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      router.push("/dashboard/subscription");
                    }}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Subscription
                  </Button>

                  {/* Usage Analytics */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-2 text-base cursor-pointer text-primary transition-colors hover:bg-primary/10"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      router.push("/dashboard/usage");
                    }}
                  >
                    <BarChart className="w-4 h-4 mr-2" />
                    Usage Analytics
                  </Button>

                  {/* Admin Panel - Only visible for admins */}
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-auto p-2 text-base cursor-pointer text-amber-400 transition-colors hover:bg-amber-500/10"
                      onClick={() => {
                        setShowAccountDropdown(false);
                        router.push("/dashboard/admin");
                      }}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Panel
                    </Button>
                  )}

                  <div className="border-t my-1" />

                  {/* Light Theme */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-2 text-base cursor-pointer text-primary transition-colors hover:bg-primary/10"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      setTheme("light");
                    }}
                  >
                    <Sun className="w-4 h-4 mr-2" />
                    Light Theme
                  </Button>

                  {/* Dark Theme */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-2 text-base cursor-pointer text-primary transition-colors hover:bg-primary/10"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      setTheme("dark");
                    }}
                  >
                    <Moon className="w-4 h-4 mr-2" />
                    Dark Theme
                  </Button>

                  <div className="border-t my-1" />

                  {/* Logout */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-2 text-base cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}