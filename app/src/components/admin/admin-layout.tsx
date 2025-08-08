import { ReactNode } from 'react'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminLayoutClient } from './admin-layout-client'

interface AdminLayoutProps {
  children: ReactNode
  title?: string
  className?: string
}

/**
 * AdminLayout - Server component wrapper that handles auth
 * 
 * This server component handles authentication and passes props
 * to the client component that manages the sidebar state
 * 
 * @param props - Layout props
 * @param props.children - Page content
 * @param props.title - Page title for header
 * @param props.className - Additional CSS classes
 * 
 * @example
 * ```tsx
 * <AdminLayout title="User Management">
 *   <UserManagementContent />
 * </AdminLayout>
 * ```
 */
export async function AdminLayout(props: AdminLayoutProps) {
  // Require admin authentication
  await requireAdminAuth()

  // Render client component
  return <AdminLayoutClient {...props} />
}