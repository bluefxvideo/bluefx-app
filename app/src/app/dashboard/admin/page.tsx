'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/app/supabase/client';
import { AdminUserTable } from '@/components/admin/admin-user-table';
import { UserDashboardEnhanced } from '@/components/user/user-dashboard-enhanced';

/**
 * Admin Page
 * Displays admin tools for user management
 * Layout and authentication handled by dashboard/layout.tsx
 */
export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    async function loadAdminData() {
      const supabase = createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      
      setIsAdmin(true);
      
      // Fetch all users from API endpoint
      try {
        const response = await fetch('/api/admin/users');
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        } else {
          console.error('Failed to fetch users:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
      
      setIsLoading(false);
    }
    
    loadAdminData();
  }, [router]);
  
  if (!isAdmin && !isLoading) {
    return null;
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users and system settings</p>
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
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
        <button 
          className="pb-3 text-sm font-medium text-foreground border-b-2 border-primary"
          onClick={() => router.push('/dashboard/admin')}
        >
          Admin
        </button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading admin data...</p>
        </div>
      ) : (
        <AdminUserTable users={users} />
      )}
    </div>
  );
}