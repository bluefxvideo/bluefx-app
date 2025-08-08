import { AdminLayout } from '@/components/admin/admin-layout'
import { AdminDashboardOverview } from '@/components/admin/admin-dashboard-overview'

// Force dynamic rendering for admin pages
export const dynamic = 'force-dynamic'

/**
 * Admin Dashboard - Main admin page with system overview
 */
export default function AdminDashboard() {
  return (
    <AdminLayout title="Dashboard">
      <AdminDashboardOverview />
    </AdminLayout>
  )
}