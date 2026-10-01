import { createAdminClient } from '@/app/supabase/server';
import type { CloneProject } from '@/types/clone-studio';

/**
 * Every write to a Clone Studio project goes through mutateProject.
 *
 * The whole scene board is one jsonb column, and several things write it at once: two clips
 * that finish in the same second, a picture that lands while the client types in another
 * card, a finishing run that reports progress. With a plain read-then-write the later writer
 * erases the earlier one's change (a finished clip went back to "animating"; the open page's
 * poll healed it, which an unattended run cannot count on).
 *
 * `change` gets the row as it is now and returns the columns to write, or null to write
 * nothing. The write lands only if the row is still the one that was read (same updated_at);
 * otherwise the row is read again and `change` runs again on the fresh copy. So `change`
 * must work from the project it is given and nothing older.
 */

export type ProjectPatch = Partial<
  Pick<CloneProject, 'scenes' | 'analysis_summary' | 'status' | 'error_message' | 'credits_spent' | 'final_video_url' | 'title'>
>;

const ATTEMPTS = 8;

export async function mutateProject(
  projectId: string,
  change: (project: CloneProject) => ProjectPatch | null
): Promise<CloneProject | null> {
  const admin = createAdminClient();
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const { data: row, error } = await admin.from('ad_clone_projects').select('*').eq('id', projectId).maybeSingle();
    if (error) throw new Error(`Could not read the project: ${error.message}`);
    if (!row) return null;
    const project = row as unknown as CloneProject;

    const patch = change(project);
    if (!patch) return project;

    const update = admin
      .from('ad_clone_projects')
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq('id', projectId);
    const { data: written, error: writeError } = await (row.updated_at ? update.eq('updated_at', row.updated_at as string) : update.is('updated_at', null)).select('*');
    if (writeError) throw new Error(`Could not save the project: ${writeError.message}`);
    if (written?.length) return written[0] as unknown as CloneProject;

    // Someone else wrote in between: wait a moment (not all writers the same moment) and redo the change on the fresh row.
    await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 60 * attempt));
  }
  throw new Error('The project is being changed by too many things at once. Please try again.');
}
