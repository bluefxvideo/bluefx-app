'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Users, 
  BarChart3, 
  Home,
  ChevronLeft,
  ChevronRight,
  Crown,
  User,
  LogOut,
  ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { signOut } from '@/actions/auth'


// Admin navigation - simplified flat structure
const adminNavigation = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: Home,
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    name: 'User Management',
    href: '/admin/users',
    icon: Users,
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    name: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    gradient: 'from-blue-500 to-cyan-500'
  }
]

interface AdminSidebarProps {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

/**
 * AdminSidebar - Navigation sidebar for admin dashboard
 * 
 * Follows the same design patterns as the user dashboard sidebar
 * with collapsible functionality and consistent styling
 */
export function AdminSidebar({ 
  isCollapsed = false, 
  onToggleCollapse 
}: AdminSidebarProps) {
  const pathname = usePathname()
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
      <div className={cn(
        'flex h-screen flex-col border-r border-border/30 bg-background transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}>
        {/* Header with admin status and collapse toggle */}
        <div className="flex items-center p-3 border-b">
          <div className="flex items-center flex-1">
            <div className={cn(
              'bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white rounded-lg shadow-sm shrink-0 transition-all duration-300',
              isCollapsed ? 'w-8 h-8 mx-auto' : 'w-8 h-8'
            )}>
              <Crown className="h-4 w-4" />
            </div>
            <div className={cn(
              'ml-2 transition-all duration-300',
              isCollapsed ? 'opacity-0 w-0 ml-0 overflow-hidden invisible' : 'opacity-100 visible'
            )}>
              <p className="text-sm font-bold whitespace-nowrap">Admin Panel</p>
            </div>
          </div>
          
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="shrink-0"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Collapsed admin indicator */}
        {isCollapsed && (
          <div className="p-2 border-b">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                  <Crown className="h-4 w-4" />
                </div>
              </TooltipTrigger>
            </Tooltip>
          </div>
        )}

        {/* Admin navigation */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hover">
          {adminNavigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href))
            
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full h-auto p-2 justify-start transition-all hover:scale-[1.02] group cursor-pointer rounded-lg',
                        isCollapsed ? 'px-2' : 'px-3',
                        isActive && 'bg-primary/10 text-primary'
                      )}
                    >
                      <div className="flex items-center w-full relative">
                        <div className={cn(
                          'flex items-center justify-center rounded-lg shadow-sm transition-all duration-300',
                          'bg-background/10 backdrop-blur-sm border border-border/20',
                          'hover:bg-secondary/80 transition-all',
                          'aspect-square shrink-0',
                          isCollapsed ? 'w-8 h-8 mx-auto' : 'w-10 h-10',
                          isActive && 'bg-primary/20 border-primary/30'
                        )}>
                          <item.icon className={cn(
                            'transition-colors',
                            isCollapsed ? 'w-4 h-4' : 'w-5 h-5',
                            isActive 
                              ? 'text-primary' 
                              : 'text-muted-foreground group-hover:text-foreground'
                          )} />
                        </div>
                        
                        <div className={cn(
                          'flex-1 text-left ml-3 transition-all duration-300',
                          isCollapsed ? 'opacity-0 w-0 ml-0 overflow-hidden invisible' : 'opacity-100 visible'
                        )}>
                          <p className="text-sm font-medium leading-none whitespace-nowrap">
                            {item.name}
                          </p>
                        </div>
                      </div>
                    </Button>
                  </Link>
                </TooltipTrigger>
                
                {isCollapsed && (
                  <TooltipContent side="right">
                    <p className="font-medium">{item.name}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            )
          })}
        </div>

        {/* Footer with My Account dropdown */}
        <div className="border-t p-2 space-y-1 border-border/30">
          {/* My Account Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full h-auto p-2 justify-start cursor-pointer relative',
                    isCollapsed ? 'px-2' : 'px-3'
                  )}
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                >
                  <div className="flex items-center w-full relative">
                    <User className={cn(
                      'text-muted-foreground shrink-0 transition-all duration-300 ml-2',
                      isCollapsed ? 'w-4 h-4' : 'w-5 h-5'
                    )} />
                    
                    <div className={cn(
                      'flex-1 text-left ml-3 transition-all duration-300',
                      isCollapsed ? 'opacity-0 w-0 ml-0 overflow-hidden invisible' : 'opacity-100 visible'
                    )}>
                      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                        My Account
                      </span>
                    </div>

                    {!isCollapsed && (
                      <ChevronUp className={cn(
                        'w-4 h-4 text-muted-foreground transition-transform duration-200',
                        showAccountDropdown ? 'rotate-180' : ''
                      )} />
                    )}
                  </div>
                </Button>
              </TooltipTrigger>
              
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>My Account</p>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Account Dropdown Menu */}
            {showAccountDropdown && !isCollapsed && (
              <div className="absolute bottom-full left-0 w-full mb-1 bg-background/95 backdrop-blur-sm border rounded-lg shadow-xl z-50">
                <div className="p-1 space-y-1">
                  {/* Profile */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setShowAccountDropdown(false)}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Button>
                  
                  <div className="border-t my-1" />
                  
                  {/* Logout */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-2 text-sm cursor-pointer text-destructive hover:text-destructive/90 hover:bg-destructive/10 transition-colors"
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
  )
}