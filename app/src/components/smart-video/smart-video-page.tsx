'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useCredits } from '@/hooks/useCredits';
import { useSmartVideo } from './hooks/use-smart-video';
import { MakeVideoAdView } from './make-video-ad';
import { plainError } from './shared';

const TOOL = 'Make a Video Ad';

/**
 * Make a Video Ad (the engine is still called the Phantom in code): the page's data and side effects. What the
 * customer sees is MakeVideoAdView, which the dev preview (/dev-preview/make-video-ad) also shows from sample data.
 */
export function SmartVideoPage() {
  const smart = useSmartVideo();
  const { credits } = useCredits();
  const { job, history, openJob, setBrief } = smart;

  // A link can open one of the user's video ads (?job=: the free video ad copied in by /go/claim) or fill in the box
  // (?link=). Read once, then the address is cleaned so a reload starts fresh. A job id opens only once it is in the
  // user's own list, so someone else's id (or a wrong one) never leaves the page waiting.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const wantedJob = useRef<string | null>(null);
  const paramsRead = useRef(false);
  useEffect(() => {
    if (paramsRead.current) return;
    paramsRead.current = true;
    const jobParam = params.get('job');
    const linkParam = params.get('link');
    if (jobParam && /^[0-9a-f-]{36}$/.test(jobParam)) wantedJob.current = jobParam;
    if (linkParam) setBrief((current) => current || linkParam.trim().slice(0, 2000));
    if (jobParam || linkParam) router.replace(pathname, { scroll: false });
  }, [params, router, pathname, setBrief]);
  useEffect(() => {
    const wanted = wantedJob.current;
    if (!wanted || !history.some((item) => item.id === wanted)) return;
    wantedJob.current = null;
    openJob(wanted);
  }, [history, openJob]);

  // The whole page changes when a video ad starts or opens: show it from the top.
  const top = useRef<HTMLDivElement>(null);
  const shownJob = job?.id;
  const uploadingNow = Boolean(smart.uploading);
  useEffect(() => {
    if (shownJob || uploadingNow) top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [shownJob, uploadingNow]);

  // The browser tab tells the news when the user is somewhere else.
  useEffect(() => {
    document.title = !job
      ? TOOL
      : job.status === 'done'
        ? `Your video ad is ready · ${TOOL}`
        : job.status === 'failed'
          ? `Could not be made · ${TOOL}`
          : `Being made… · ${TOOL}`;
    return () => {
      document.title = TOOL;
    };
  }, [job]);

  // A message only when a video ad finishes while it is being watched, not when an old one is reopened.
  const watched = useRef<string | null>(null);
  useEffect(() => {
    if (!job) return;
    const running = job.status !== 'done' && job.status !== 'failed';
    if (running) watched.current = job.id;
    else if (watched.current === job.id) {
      watched.current = null;
      if (job.status === 'done') toast.success(job.parentId ? 'Your changed video ad is ready.' : 'Your video ad is ready.');
      else if (job.freeLeadId) toast.error(plainError(job.error));
      else toast.error(job.parentId ? 'Your change did not go through.' : 'Your video ad could not be made.');
    }
  }, [job]);

  return (
    <div ref={top} className="scroll-mt-4">
      <MakeVideoAdView smart={smart} balance={credits?.available_credits} />
    </div>
  );
}
