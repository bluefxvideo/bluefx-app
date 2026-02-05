import { checkAdminAuth } from '@/lib/admin-auth';
import { PromptLibraryPage } from '@/components/prompt-library/prompt-library-page';

export default async function PromptLibraryRoute() {
  const adminUser = await checkAdminAuth();

  return <PromptLibraryPage isAdmin={!!adminUser} />;
}
