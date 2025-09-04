'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { DashboardSidebar } from './dashboard-sidebar'
import { DashboardLayoutContext } from './dashboard-layout-context'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false) // Default expanded on desktop
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
    
    // Auto-close sidebar on mobile
    const checkMobileAndClose = () => {
      const isMobile = window.innerWidth < 1024 // lg breakpoint
      if (isMobile) {
        setIsSidebarCollapsed(true)
      }
    }
    
    // Check on mount
    checkMobileAndClose()
    
    // Check on resize
    window.addEventListener('resize', checkMobileAndClose)
    
    return () => {
      window.removeEventListener('resize', checkMobileAndClose)
    }
  }, [])

  // Auto-close sidebar on mobile when navigating to new pages
  useEffect(() => {
    const isMobile = window.innerWidth < 1024 // lg breakpoint
    if (isMobile && isHydrated) {
      setIsSidebarCollapsed(true)
    }
  }, [pathname, isHydrated])

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  // Prevent hydration mismatch by not rendering sidebar controls until hydrated
  if (!isHydrated) {
    return (
      <DashboardLayoutContext.Provider value={{ toggleSidebar, isSidebarCollapsed }}>
        <div className="flex h-screen bg-background relative">
          {/* Sidebar without interactive elements during SSR */}
          <div className="lg:relative">
            <div className="hidden lg:block">
              <DashboardSidebar isCollapsed={false} />
            </div>
            <div className="lg:hidden">
              <DashboardSidebar isCollapsed={true} />
            </div>
          </div>
          
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </div>
      </DashboardLayoutContext.Provider>
    )
  }

  return (
    <DashboardLayoutContext.Provider value={{ toggleSidebar, isSidebarCollapsed }}>
      <div className="flex h-screen bg-background relative">
      {/* Mobile Backdrop - only shows on mobile when sidebar is open */}
      {!isSidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={toggleSidebar}
        />
      )}
      
      {/* Sidebar - responsive behavior */}
      <div className="lg:relative">
        {/* Desktop: Normal toggle behavior */}
        <div className="hidden lg:block">
          <DashboardSidebar 
            isCollapsed={isSidebarCollapsed}
          />
        </div>
        
        {/* Mobile: Always collapsed (icons only) */}
        <div className="lg:hidden">
          <DashboardSidebar 
            isCollapsed={true} // Always collapsed for icon-only view
          />
        </div>
      </div>

      {/* Mobile Expanded Sidebar - overlay when opened */}
      {!isSidebarCollapsed && (
        <div className="fixed inset-y-0 left-0 w-[62%] max-w-sm z-50 lg:hidden animate-in slide-in-from-left duration-300 ease-out">
          <DashboardSidebar 
            isCollapsed={false} // Expanded overlay
          />
        </div>
      )}
      
      {/* Main content area - full width on mobile, adjusted on desktop */}
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
      </div>
    </DashboardLayoutContext.Provider>
  )
}