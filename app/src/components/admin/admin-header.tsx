'use client'

import { signOut } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { 
  Bell, 
  LogOut, 
  User,
  Menu
} from 'lucide-react'
import type { AdminUser } from '@/lib/admin-auth'

interface AdminHeaderProps {
  title?: string
  user: AdminUser
}

/**
 * AdminHeader - Top navigation bar for admin dashboard
 * 
 * @param props - Header props
 * @param props.title - Current page title
 * @param props.user - Current admin user data
 */
export function AdminHeader({ title, user }: AdminHeaderProps) {
  return (
    <header className="bg-card shadow-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left section */}
          <div className="flex items-center">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden mr-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            {/* Page title */}
            {title && (
              <div>
                <h1 className="text-2xl font-semibold text-card-foreground">
                  {title}
                </h1>
              </div>
            )}
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="sm"
              className="relative"
            >
              <Bell className="h-5 w-5" />
              {/* Notification badge */}
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                2
              </span>
            </Button>

            {/* User info */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 ">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium text-card-foreground">
                    {user.profile.username}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Administrator
                  </div>
                </div>
              </div>

              {/* Sign out button */}
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-card-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:ml-2 sm:inline">Sign Out</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}