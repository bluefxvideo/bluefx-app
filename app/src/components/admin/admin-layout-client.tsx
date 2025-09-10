'use client'

import { ReactNode, useState } from 'react'
import { AdminSidebar } from './admin-sidebar'
import { cn } from '@/lib/utils'

interface AdminLayoutClientProps {
  children: ReactNode
  title?: string
  className?: string
}

/**
 * AdminLayoutClient - Client component that manages sidebar state
 * 
 * This component handles the interactive parts of the admin layout
 * including sidebar collapse/expand functionality
 * 
 * @param props - Layout props
 * @param props.children - Page content
 * @param props.title - Page title for header
 * @param props.className - Additional CSS classes
 */
export function AdminLayoutClient({ 
  children, 
  title,
  className 
}: AdminLayoutClientProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Collapsible Sidebar */}
      <AdminSidebar 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />
      
      {/* Main content area */}
      <div className={cn(
        'flex-1 flex flex-col transition-all duration-300 overflow-hidden',
      )}>
        {/* Header with title */}
        {title && (
          <div className="border-b bg-card px-6 py-4 flex-shrink-0">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            </div>
          </div>
        )}
        
        {/* Page content */}
        <main className={cn(
          "flex-1 overflow-y-auto bg-background p-6",
          className
        )}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}