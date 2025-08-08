import { AdminLayout } from '@/components/admin/admin-layout'
import { AdminUserManagement } from '@/components/admin/admin-user-management'

// Force dynamic rendering for admin pages
export const dynamic = 'force-dynamic'

/**
 * Admin User Management Page
 */
export default function AdminUsersPage() {
  return (
    <AdminLayout title="User Management">
      <AdminUserManagement />
    </AdminLayout>
  )
}