import { UserDashboardEnhanced } from '@/components/user/user-dashboard-enhanced'

/**
 * Usage Analytics Page
 * Displays detailed analytics and usage statistics for authenticated users
 * Layout and authentication handled by dashboard/layout.tsx
 */
export default function UsagePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Usage Analytics</h1>
        <p className="text-muted-foreground">Track your AI tool usage and analytics</p>
      </div>
      
      <UserDashboardEnhanced />
    </div>
  );
}