/**
 * Page loads by Meta's ad review, not by people (owner 2026-10-24: "filter the robot hits out of the stats").
 *
 * When an ad is published or edited, Meta opens its landing page from several machines at once: 3 to 17 loads within
 * seconds, each a new browser that does nothing else, tagged with the ad's URL parameters (ref=fb-...). The check
 * fills {{placement}} with Facebook_Right_Column even for ad sets that never ran there: the Singapore ad's 6
 * "right column visits" came one minute after its edit, and Meta reported 0 right column impressions for it.
 *
 * A browser is a review visit when it did nothing but load the page (no form start, no event on any lead) and either
 * - its tag is a Facebook tag ending in Right_Column, or
 * - it is one of at least REVIEW_BURST.minBrowsers such browsers that loaded the page with the same tag within
 *   REVIEW_BURST.windowMs of each other.
 * The raw events stay stored; only the stats leave these browsers out.
 */

export const REVIEW_BURST = { windowMs: 10_000, minBrowsers: 3 } as const;

/** A Facebook ad tag (ref=fb-{{placement}}, fb-sg-..., fb-ae-...) whose placement is the right column. */
const RIGHT_COLUMN_TAG = /^fb[-_].*right_column$/i;

export interface PageVisitRow {
  at: string;
  event: string;
  visitor_id: string | null;
  ref: string | null;
}

/**
 * The browsers (visitor ids) among the page events that were Meta's review, not people.
 * activeBrowsers: browsers that sent any event about a lead (they used the page, so they are people).
 */
export function reviewVisitBrowsers(rows: readonly PageVisitRow[], activeBrowsers: ReadonlySet<string> = new Set()): Set<string> {
  const busy = new Set(activeBrowsers);
  for (const row of rows) if (row.visitor_id && row.event !== 'landing_view') busy.add(row.visitor_id);

  // Each idle browser's first landing view (its time and tag).
  const firstView = new Map<string, { ms: number; tag: string }>();
  for (const row of rows) {
    const browser = row.visitor_id;
    const tag = row.ref?.trim() ?? '';
    if (!browser || row.event !== 'landing_view' || busy.has(browser) || !tag) continue;
    const ms = Date.parse(row.at);
    const seen = firstView.get(browser);
    if (!seen || ms < seen.ms) firstView.set(browser, { ms, tag });
  }

  const robots = new Set<string>();
  const byTag = new Map<string, { browser: string; ms: number }[]>();
  for (const [browser, view] of firstView) {
    if (RIGHT_COLUMN_TAG.test(view.tag)) robots.add(browser);
    const list = byTag.get(view.tag) ?? [];
    list.push({ browser, ms: view.ms });
    byTag.set(view.tag, list);
  }

  // Bursts: a window of REVIEW_BURST.windowMs holding at least minBrowsers idle browsers with the same tag.
  for (const list of byTag.values()) {
    list.sort((a, b) => a.ms - b.ms);
    let start = 0;
    for (let end = 0; end < list.length; end++) {
      while (list[end].ms - list[start].ms > REVIEW_BURST.windowMs) start++;
      if (end - start + 1 >= REVIEW_BURST.minBrowsers) for (let i = start; i <= end; i++) robots.add(list[i].browser);
    }
  }
  return robots;
}
