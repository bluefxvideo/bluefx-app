'use client';

import { useRouter } from 'next/navigation';
import { UserDashboardEnhanced } from '@/components/user/user-dashboard-enhanced'

/**
 * Usage Analytics Page
 * Displays detailed analytics and usage statistics for authenticated users
 * Layout and authentication handled by dashboard/layout.tsx
 */
export default function UsagePage() {
  const router = useRouter();
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Usage Analytics</h1>
        <p className="text-muted-foreground">Track your AI tool usage and analytics</p>
      </div>
      
      {/* Navigation Tabs */}
      <div className="flex gap-8 border-b mb-6">
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard')}
        >
          Dashboard
        </button>
        <button 
          className="pb-3 text-sm font-medium text-foreground border-b-2 border-primary"
          onClick={() => router.push('/dashboard/usage')}
        >
          Usage
        </button>
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard/profile')}
        >
          Profile
        </button>
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard/subscription')}
        >
          Subscription
        </button>
      </div>
      
      <UserDashboardEnhanced />
    </div>
  );
}