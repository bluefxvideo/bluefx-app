import { redirect } from 'next/navigation';
import { checkAdminAuth } from '@/lib/admin-auth';
import { SmartVideoPage } from '@/components/smart-video/smart-video-page';

/**
 * Smart Video — admin-only trial. Rendered at the layout level so a running
 * job's state survives sub-route navigation; the page file returns null.
 */
export default async function SmartVideoLayout({ children: _children }: { children: React.ReactNode }) {
  const admin = await checkAdminAuth();
  if (!admin) redirect('/dashboard');
  return <SmartVideoPage />;
}
