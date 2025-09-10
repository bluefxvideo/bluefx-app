import { redirect } from 'next/navigation';
import { createClient } from '@/app/supabase/server';
import { AdminUserManagement } from '@/components/admin/admin-user-management';
import { AdminPageWrapper } from '@/components/admin/admin-page-wrapper';

/**
 * Admin User Management Page (Server Component)
 * Admin-only page for managing users, integrated into the main dashboard
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  const isAdmin = profile?.role === 'admin';
  
  if (!isAdmin) {
    redirect('/dashboard');
  }
  
  return (
    <AdminPageWrapper isAdmin={isAdmin}>
      <AdminUserManagement />
    </AdminPageWrapper>
  );
}