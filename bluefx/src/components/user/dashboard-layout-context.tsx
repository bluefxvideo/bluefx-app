'use client'

import { createContext, useContext } from 'react'

interface DashboardLayoutContextType {
  toggleSidebar: () => void
  isSidebarCollapsed: boolean
}

const DashboardLayoutContext = createContext<DashboardLayoutContextType | undefined>(undefined)

export function useDashboardLayout() {
  const context = useContext(DashboardLayoutContext)
  if (!context) {
    throw new Error('useDashboardLayout must be used within a DashboardLayoutProvider')
  }
  return context
}

export { DashboardLayoutContext }