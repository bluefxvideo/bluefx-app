'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/app/supabase/client';
import { AdminUserTable } from '@/components/admin/admin-user-table';
import { AdminUserCreateDialog } from '@/components/admin/admin-user-create-dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

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
      
      // Fetch users with stats
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (profiles) {
        // Get auth users for emails
        const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
        const emailMap = new Map<string, string>();
        authUsers?.forEach(user => {
          emailMap.set(user.id, user.email || '');
        });
        
        // Enrich profiles with additional data
        const enrichedUsers = await Promise.all(
          profiles.map(async (profile) => {
            const email = emailMap.get(profile.id) || profile.email || '';
            
            // Get subscription
            const { data: subscriptions } = await supabase
              .from('user_subscriptions')
              .select('*')
              .eq('user_id', profile.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1);
            
            // Get credits
            const { data: creditRecords } = await supabase
              .from('user_credits')
              .select('*')
              .eq('user_id', profile.id)
              .order('created_at', { ascending: false })
              .limit(1);
            
            // Get last activity
            const { data: lastActivityData } = await supabase
              .from('credit_transactions')
              .select('created_at')
              .eq('user_id', profile.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            return {
              ...profile,
              email,
              subscription: subscriptions?.[0] || null,
              credits: creditRecords?.[0] || null,
              totalCreditsUsed: creditRecords?.[0]?.used_credits || 0,
              lastActivity: lastActivityData?.created_at || null
            };
          })
        );
        
        setUsers(enrichedUsers);
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
        <>
          {/* Action buttons */}
          <div className="flex justify-end items-center space-x-2 mb-6">
            <AdminUserCreateDialog />
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
          
          {/* User table */}
          <AdminUserTable users={users} />
        </>
      )}
    </div>
  );
}