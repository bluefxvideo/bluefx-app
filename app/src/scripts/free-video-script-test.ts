/**
 * Free video ad script test (owner 2026-10-06: "how can you be sure that all scripts will be sharper?"): the same
 * websites written twice, BEFORE (the free brief as of 8838c90, no script checks) and AFTER (today's freeNote and
 * checkFreeScript), each script scored by a small model against a fixed checklist. Scripts only: no voice, no
 * pictures, no render. The director costs about $0.11 per call and often needs 2 or 3 calls for one script (each
 * rejected plan prints a ⚠️ line), so a full run of 10 websites costs about $4 to $5 and an --after-only run about $2.50.
 *
 * Run from app/:  FREE_VIDEO_ALLOW_PAID=1 npx tsx src/scripts/free-video-script-test.ts [--after-only=<earlier results .json>]
 *   [--writer=<model>[:<thinking level>]] [--loose] [--sites=<how many>]
 * --writer writes the AFTER scripts with another director model or thinking level (the speed test, 2026-10-07: "is there
 * anything we can do to make the generation shorter?") and prints how long each script took.
 * --after-only writes only the AFTER scripts and compares them with the BEFORE scores of an earlier run (half the cost).
 */
import { config } from 'dotenv';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env.local') });

const SITES = [
  'joespizzanyc.com',
  'bardmoorfamilydental.com',
  'stpetersburgrealestate.com',
  'tripeakroofers.com',
  'mcgillplumbing.com',
  'standtallbarbering.com',
  'whiteglovecleaningclearwater.com',
  'randysautorepairfl.com',
  'tryumphfitness.com',
  'nxtlandscape.com',
];

/** The free brief as it was before 2026-10-06 22:20 (commit 8838c90), for the BEFORE scripts. */
const BEFORE_NOTE = (domain: string) =>
  [
    'Make a vertical video ad of about 35 seconds for this business: around 80 words of narration in total, 5 to 7 scenes.',
    'Write the narration and every text on screen in the language of the website.',
    'Lead with what a customer gets. Use only facts from the website.',
    'Write scene 1 as one short hook of 6 to 12 words.',
    `The last scene shows the website address ${domain} as the highlight.`,
    'Tape only real photos of the business to the board: its people, place, products or work. Never use a picture that is mostly text, such as a YouTube thumbnail, a banner, a flyer, a screenshot or an ad.',
    'Give every scene that shows no photo its own drawing, so the board is never empty. When the website has no logo, the last scene gets a drawing too, of something that fits the call to action.',
  ].join('\n');

const JUDGE_MODEL = 'gemini-3.6-flash';
const AFTER_ONLY = process.argv.find((arg) => arg.startsWith('--after-only='))?.split('=')[1];
const WRITER_ARG = process.argv.find((arg) => arg.startsWith('--writer='))?.split('=')[1];
const LOOSE = process.argv.includes('--loose');
const WRITER = WRITER_ARG || LOOSE
  ? { model: WRITER_ARG?.split(':')[0] || undefined, thinkingLevel: (WRITER_ARG?.split(':')[1] || undefined) as 'minimal' | 'low' | 'medium' | 'high' | undefined, looseRules: LOOSE }
  : undefined;
const SITE_COUNT = Number(process.argv.find((arg) => arg.startsWith('--sites='))?.split('=')[1]) || SITES.length;

interface Score {
  hook: number;
  specific: number;
  no_filler: number;
  offer: number;
  cta: number;
  note: string;
}

async function judge(siteText: string, script: string): Promise<Score> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GOOGLE_GENERATIVE_AI_API_KEY || '' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `You judge the script of a 35-second video ad for a small business. Score each point 0, 1 or 2. Be strict and consistent.

1. hook: scene 1 makes this business's customer stop (2 = specific to this business and its customer; 1 = generic question or claim; 0 = weak or about the company).
2. specific: the lines name concrete things from the website (services, places, numbers, prices, names) (2 = most lines; 1 = some; 0 = mostly generic).
3. no_filler: free of empty phrases that say nothing a customer can check ("expert guidance", "ready to help", "quality service", "look no further") (2 = none; 1 = one; 0 = two or more).
4. offer: if the website makes a concrete offer (free estimate or inspection, discount, first-visit price, free consultation), the script names it as the reason to act (2 = named and used as the reason; 1 = mentioned in passing; 0 = missing). If the website makes no such offer, 2 when the script still gives one clear reason to act now, else 1.
5. cta: the last scene tells the viewer exactly what to do next and why (2 = clear action plus a reason; 1 = only "visit our website"; 0 = none).

Answer JSON only: {"hook": n, "specific": n, "no_filler": n, "offer": n, "cta": n, "note": "one short sentence: the biggest weakness"}

WEBSITE TEXT:
${siteText.slice(0, 6000)}

SCRIPT (scene by scene: what is said | what is on screen):
${script}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`${JUDGE_MODEL} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text || '{}') as Score;
}

const total = (s: Score) => (s.hook || 0) + (s.specific || 0) + (s.no_filler || 0) + (s.offer || 0) + (s.cta || 0);

async function main(): Promise<void> {
  if (process.env.FREE_VIDEO_ALLOW_PAID !== '1') throw new Error('This spends about $4 to $5 (20 scripts, often 2 or 3 director calls each). Tell the owner, then run it with FREE_VIDEO_ALLOW_PAID=1.');
  const { freeNote } = await import('@/lib/free-video/config');
  const { checkFreeScript, websiteOffers } = await import('@/lib/free-video/script-checks');
  const { displayDomain, normalizeWebsite, readBusinessSite } = await import('@/lib/free-video/website');
  const { directVideo } = await import('../lib/smart-video/director');
  const { prepareAssets } = await import('@/lib/smart-video/prepare-assets');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'script-test-'));
  const store = async (data: Buffer, name: string) => {
    fs.writeFileSync(path.join(dir, name), data);
    return path.join(dir, name);
  };
  const scriptOf = (plan: { scenes: { narration: string; blocks: unknown[] }[] }) =>
    plan.scenes
      .map((scene, i) => {
        const shown = scene.blocks.flatMap((block) => {
          const b = block as { text?: string; items?: { text?: string }[] };
          return [b.text ?? '', ...(b.items ?? []).map((item) => item.text ?? '')].filter(Boolean);
        });
        return `${i + 1}. ${scene.narration} | ${shown.join(' / ')}`;
      })
      .join('\n');

  const earlier: Record<string, { scoreBefore: Score; scriptBefore: string }> = AFTER_ONLY
    ? Object.fromEntries((JSON.parse(fs.readFileSync(AFTER_ONLY, 'utf8')) as { site: string; scoreBefore: Score; scriptBefore: string }[]).map((row) => [row.site, row]))
    : {};
  const rows: Record<string, unknown>[] = [];
  const sites = SITES.slice(0, SITE_COUNT);
  for (let i = 0; i < sites.length; i += 5) {
    await Promise.all(
      sites.slice(i, i + 5).map(async (site) => {
        try {
          const normalized = normalizeWebsite(site);
          if (!normalized.ok) throw new Error(normalized.code);
          const read = await readBusinessSite(normalized.url);
          const assets = await prepareAssets(read.files, store);
          const domain = displayDomain(normalized.domain);
          const write = (note: string, check?: (plan: never) => string | null, writer?: typeof WRITER) =>
            directVideo(`${read.brief}\n\nNOTE FROM THE CLIENT:\n${note}`, assets, 'auto', 'vertical', 'whiteboard', null, check as never, writer);
          const old = earlier[site];
          const started = Date.now();
          const timedAfter = write(freeNote(domain), ((plan: Parameters<typeof checkFreeScript>[0]) => checkFreeScript(plan, read.brief)) as never, WRITER).then((plan) => ({
            plan,
            seconds: Math.round((Date.now() - started) / 100) / 10,
          }));
          const [before, { plan: after, seconds }] = await Promise.all([old ? null : write(BEFORE_NOTE(domain)), timedAfter]);
          const scriptBefore = old ? old.scriptBefore : scriptOf(before!);
          const [scoreBefore, scoreAfter] = await Promise.all([old ? old.scoreBefore : judge(read.brief, scriptBefore), judge(read.brief, scriptOf(after))]);
          rows.push({
            site,
            offer: websiteOffers(read.brief)[0] ?? '',
            before: total(scoreBefore),
            after: total(scoreAfter),
            scoreBefore,
            scoreAfter,
            scriptBefore,
            scriptAfter: scriptOf(after),
            afterSeconds: seconds,
            writer: WRITER_ARG ?? 'director (default)',
          });
          console.log(`${site}: before ${total(scoreBefore)}/10 → after ${total(scoreAfter)}/10 (${seconds} s)`);
        } catch (error) {
          console.log(`❌ ${site}: ${String(error).slice(0, 160)}`);
        }
      })
    );
  }
  const done = rows.filter((r) => typeof r.before === 'number');
  const mean = (key: 'before' | 'after') => (done.reduce((sum, r) => sum + (r[key] as number), 0) / Math.max(1, done.length)).toFixed(1);
  const keys = ['hook', 'specific', 'no_filler', 'offer', 'cta'] as const;
  const sum = (key: (typeof keys)[number], side: 'scoreBefore' | 'scoreAfter') => done.reduce((n, r) => n + ((r[side] as Score)[key] || 0), 0);
  const seconds = done.map((r) => r.afterSeconds as number).sort((a, b) => a - b);
  console.log(`\nWRITER: ${WRITER_ARG ?? 'director (default)'}${LOOSE ? ' with the looser rules' : ''}`);
  console.log(`AVERAGE: before ${mean('before')}/10 → after ${mean('after')}/10 on ${done.length} websites`);
  console.log(`TIME per script: average ${(seconds.reduce((a, b) => a + b, 0) / Math.max(1, seconds.length)).toFixed(1)} s, median ${seconds[Math.floor(seconds.length / 2)] ?? 0} s, slowest ${seconds[seconds.length - 1] ?? 0} s`);
  console.log(`PER POINT (max ${2 * done.length}): ${keys.map((key) => `${key} ${sum(key, 'scoreBefore')}→${sum(key, 'scoreAfter')}`).join(', ')}`);
  const out = path.resolve(__dirname, `../../../remotion/test-plans/script-test-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log(`📄 ${out}`);
}

main().catch((error) => {
  console.error('❌ free-video-script-test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
