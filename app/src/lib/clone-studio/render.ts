import { createAdminClient } from '@/app/supabase/server';
import { uploadVideoToStorage } from '@/actions/supabase-storage';
import { levelLoudness, renderSmartVideo } from '@/lib/smart-video/render';
import type { UsageEntry } from '@/lib/smart-video/usage';
import { DEFAULT_FINISH_SETTINGS, type CloneProject, type FinishStage } from '@/types/clone-studio';
import { buildCloneFinish } from './finish';
import type { CloneTimeline } from './timeline';

/**
 * The finishing run itself, from the board as it is now to a stored video: clips prepared,
 * narrator recorded, music made, rendered, levelled, uploaded. Used by "Finish the ad" and by
 * the "Do it for me" run. It moves no credits and does not touch the project row: the
 * caller reports the stages and writes the result.
 */

const FILES_BUCKET = 'script-videos';

export interface FinishedAd {
  url: string;
  seconds: number;
  /** The timeline the renderer got, for the private run log. */
  props: CloneTimeline;
}

export async function finishCloneAd(input: {
  userId: string;
  projectId: string;
  /** Names the folder of the run's working files. */
  runId: string;
  onStage: (stage: FinishStage, progress?: number) => void;
}): Promise<FinishedAd> {
  const { userId, projectId, runId, onStage } = input;
  const admin = createAdminClient();
  const { data, error } = await admin.from('ad_clone_projects').select('*').eq('id', projectId).single();
  if (error || !data) throw new Error('Project not found');
  const project = data as unknown as CloneProject;
  const finish = project.analysis_summary?.finish || { settings: DEFAULT_FINISH_SETTINGS };

  const dir = `clone-finish/${userId}/${runId}`;
  const store = async (file: Buffer, name: string, contentType: string) => {
    const { error: uploadError } = await admin.storage.from(FILES_BUCKET).upload(`${dir}/${name}`, file, { contentType, upsert: true });
    if (uploadError) throw new Error(`Could not save ${name}: ${uploadError.message}`);
    return admin.storage.from(FILES_BUCKET).getPublicUrl(`${dir}/${name}`).data.publicUrl;
  };

  const props = await buildCloneFinish({ project, settings: finish.settings, language: finish.language, store, onStage: (next) => onStage(next) });

  onStage('rendering', 0);
  let reported = 0;
  const rendered = await renderSmartVideo(props as unknown as Record<string, unknown>, (percent) => {
    if (percent - reported >= 10) {
      reported = percent;
      onStage('rendering', percent);
    }
  });

  onStage('levelling', 100);
  const video = await levelLoudness(rendered);
  const upload = await uploadVideoToStorage(new Blob([new Uint8Array(video)], { type: 'video/mp4' }), {
    bucket: 'videos',
    folder: `clone-studio/${projectId}`,
    filename: `finished-${Date.now()}.mp4`,
    contentType: 'video/mp4',
  });
  if (!upload.success || !upload.url) throw new Error(`Could not store the finished ad: ${upload.error}`);
  return { url: upload.url, seconds: props.duration, props };
}

/** What a run cost in API calls, kept where only the server can read it. The log never fails a run. */
export async function logCloneRun(row: {
  id: string;
  project_id: string;
  user_id: string;
  status: string;
  duration_seconds: number | null;
  usage: UsageEntry[];
  props: unknown;
  error?: string;
}): Promise<void> {
  try {
    // clone_finish_runs is newer than the generated database types.
    const { error } = await (createAdminClient() as any).from('clone_finish_runs').upsert(row);
    if (error) console.warn('Clone Studio: the run was not logged:', error.message, JSON.stringify(row.usage));
  } catch (error) {
    console.warn('Clone Studio: the run was not logged:', String(error).slice(0, 160));
  }
}
