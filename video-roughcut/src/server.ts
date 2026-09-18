import 'dotenv/config';
import express from 'express';
import type { JobRequest, JobRecord } from './types.js';
import { processJob } from './processJob.js';

const PORT = Number(process.env.PORT || 3003);
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

/**
 * In-memory job registry. Tracks jobs received by this worker instance.
 * The authoritative state lives in the Next.js app's Supabase table —
 * this is just for the /jobs/:id status endpoint and basic introspection.
 * On container restart, in-flight jobs are lost (the Next.js app will mark
 * them failed on timeout).
 */
const jobs = new Map<string, JobRecord>();

const app = express();
app.use(express.json({ limit: '1mb' }));

/**
 * Simple shared-secret auth for server-to-server calls from the Next.js app.
 */
function requireInternalKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!INTERNAL_API_KEY) {
    // Fail closed in production; local development runs without a key.
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'INTERNAL_API_KEY is not configured' });
    }
    return next();
  }
  const keyHeader = req.header('x-internal-api-key');
  const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
  if (key !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'video-roughcut-worker', activeJobs: jobs.size });
});

app.get('/jobs/:id', requireInternalKey, (req, res) => {
  const id = String(req.params.id);
  const job = jobs.get(id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  res.json(job);
});

app.post('/jobs', requireInternalKey, (req, res) => {
  const body = req.body as JobRequest;
  if (!body?.jobId || !body?.audioUrl || !body?.audioHash || !body?.callbackUrl || !body?.videoMetadata) {
    return res.status(400).json({ error: 'missing required fields' });
  }
  if (jobs.has(body.jobId)) {
    return res.status(409).json({ error: 'job already exists' });
  }

  const record: JobRecord = {
    jobId: body.jobId,
    status: 'queued',
    progress: 0,
    startedAt: Date.now(),
  };
  jobs.set(body.jobId, record);

  // Fire-and-forget async processing. Callbacks update the Next.js app.
  processJob(body)
    .then(() => {
      const r = jobs.get(body.jobId);
      if (r) {
        r.status = 'done';
        r.progress = 100;
        r.finishedAt = Date.now();
      }
    })
    .catch((err) => {
      const r = jobs.get(body.jobId);
      if (r) {
        r.status = 'failed';
        r.error = err?.message || 'Unknown error';
        r.finishedAt = Date.now();
      }
    });

  res.status(202).json({ accepted: true, jobId: body.jobId });
});

app.listen(PORT, () => {
  console.log(`video-roughcut worker listening on :${PORT}`);
  console.log(`  DEEPGRAM_API_KEY: ${process.env.DEEPGRAM_API_KEY ? 'set' : 'MISSING'}`);
  console.log(`  FAL_KEY:          ${process.env.FAL_KEY ? 'set' : 'MISSING'}`);
  console.log(`  ROUGHCUT_MODEL:   ${process.env.ROUGHCUT_MODEL || 'anthropic/claude-fable-5.1 (default)'}, effort ${process.env.ROUGHCUT_EFFORT || 'low'}`);
  console.log(`  SUPABASE_URL:     ${process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING'}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING'}`);
  console.log(
    `  INTERNAL_API_KEY: ${INTERNAL_API_KEY ? 'set' : process.env.NODE_ENV === 'production' ? 'MISSING (job requests refused)' : 'not required (dev mode)'}`,
  );
});
