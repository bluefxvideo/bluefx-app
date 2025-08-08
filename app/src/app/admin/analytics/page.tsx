import { Suspense } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { AdminAnalyticsDashboard } from '@/components/admin/admin-analytics-dashboard'

export const dynamic = 'force-dynamic'

export default function AdminAnalyticsPage() {
  return (
    <AdminLayout title="Analytics">
      <Suspense fallback={<div>Loading analytics...</div>}>
        <AdminAnalyticsDashboard />
      </Suspense>
    </AdminLayout>
  )
}