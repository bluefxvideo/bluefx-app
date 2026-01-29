import { Suspense } from 'react';
import { DashboardLayout } from '@/components/user/dashboard-layout';
import { createClient } from '@/app/supabase/server';
import { redirect } from 'next/navigation';
import { ProjectProvider } from '@/lib/project-context';

export const dynamic = 'force-dynamic';

/**
 * Dashboard Layout - Applied to all /dashboard/* routes
 * Provides consistent left sidebar navigation and authentication
 */
export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify user authentication for all dashboard routes
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    redirect('/login?message=Please log in to access your dashboard');
  }

  // Verify session is actually valid by testing a simple query
  try {
    const { error: testError } = await supabase.from('profiles').select('id').eq('id', user.id).limit(1);
    if (testError && testError.code === 'PGRST301') {
      // JWT expired or invalid
      redirect('/login?message=Your session has expired. Please log in again.');
    }
  } catch (sessionError) {
    console.error('Session validation error:', sessionError);
    redirect('/login?message=Session validation failed. Please log in again.');
  }

  return (
    <DashboardLayout>
      <ProjectProvider>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-muted-foreground">Loading...</span>
            </div>
          }
        >
          {children}
        </Suspense>
      </ProjectProvider>
    </DashboardLayout>
  );
}