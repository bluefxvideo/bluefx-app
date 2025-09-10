'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/app/supabase/client';
import { AdminUserManagement } from '@/components/admin/admin-user-management';

/**
 * Admin User Management Page
 * Admin-only page for managing users, integrated into the main dashboard
 */
export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function checkAdminAccess() {
      const supabase = createClient();
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
      
      if (profile?.role === 'admin') {
        setIsAdmin(true);
      } else {
        router.push('/dashboard');
      }
      
      setIsLoading(false);
    }
    
    checkAdminAccess();
  }, [router]);
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAdmin) {
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
      
      <AdminUserManagement />
    </div>
  );
}