/**
 * The second free video ad funnel (owner 2026-10-25: "keep it separate, keep it simple"): the same landing page at
 * its own address (SERVICE_LANDING_PATH), the same free video ad, but the offer at the end is Unlimited Video Ads
 * ($99/month done-for-you service, service-page.ts) instead of the AI Media Machine, with its own MailerLite emails
 * and its own Facebook campaign. A lead belongs to it when its ref starts with SERVICE_REF_PREFIX: the service
 * landing page adds the prefix to every tag it sends, and the first landing page strips it, so no link can move a
 * lead from one funnel to the other.
 *
 * The third funnel (owner 2026-11-14): ClickBank affiliates. The same landing page again at CB_LANDING_PATH, and the
 * $49 video ad sold through ClickBank. Its tag is 'cbaff-<affiliate nickname>' and comes from ?affiliate= alone on that
 * page; every other page drops a hand-made 'cbaff-' the same way it drops 'svc-'.
 *
 * Client-safe: no server imports.
 */

/** The service funnel's landing page (the Facebook campaign's link). */
export const SERVICE_LANDING_PATH = '/free-ad';

export const SERVICE_REF_PREFIX = 'svc-';

/** True for a lead (or an event) of the service funnel. */
export const isServiceRef = (ref: string | null | undefined): boolean => typeof ref === 'string' && ref.startsWith(SERVICE_REF_PREFIX);

/** The ClickBank affiliate funnel's landing page (the affiliates' link, with ?affiliate=<nickname>). */
export const CB_LANDING_PATH = '/your-video-ad';

export const CB_REF_PREFIX = 'cbaff-';

/** The tag's tail for a ClickBank page signup whose link named no valid affiliate. Nicknames have no hyphen, so no clash. */
export const CB_NO_AFFILIATE = 'no-affiliate';

/** True for a lead (or an event) of the ClickBank affiliate funnel. */
export const isClickBankRef = (ref: string | null | undefined): boolean => typeof ref === 'string' && ref.startsWith(CB_REF_PREFIX);

/** The owner's own test signups (a browser marked internal): 'owner-test', or 'svc-owner-test' / 'cbaff-owner-test' from the other funnels' pages. */
export const ownerTestRef = (ref: string | null | undefined): string =>
  isClickBankRef(ref) ? `${CB_REF_PREFIX}owner-test` : isServiceRef(ref) ? `${SERVICE_REF_PREFIX}owner-test` : 'owner-test';

/** True for any owner test tag (the admin numbers and the Conversions API leave them all out). */
export const isOwnerTestRef = (ref: string | null | undefined): boolean => {
  const tag = ref?.trim();
  return tag === 'owner-test' || tag === `${SERVICE_REF_PREFIX}owner-test` || tag === `${CB_REF_PREFIX}owner-test`;
};

/** True on the service funnel's landing page. */
export const isServiceLandingPath = (pathname: string): boolean =>
  pathname === SERVICE_LANDING_PATH || pathname.startsWith(`${SERVICE_LANDING_PATH}/`);

/** True on the ClickBank affiliate funnel's landing page. */
export const isClickBankLandingPath = (pathname: string): boolean =>
  pathname === CB_LANDING_PATH || pathname.startsWith(`${CB_LANDING_PATH}/`);

/** A ClickBank nickname as the funnel keeps it: lowercased, 1 to 30 letters, digits or underscores; null for anything else. */
export function cbAffiliateNick(raw: string | null | undefined): string | null {
  const nick = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return /^[a-z0-9_]{1,30}$/.test(nick) ? nick : null;
}

/** The tag of a signup on the ClickBank page: 'cbaff-<nickname>', or 'cbaff-no-affiliate' without a valid ?affiliate=. */
export function cbRefFor(affiliate: string | null | undefined): string {
  return `${CB_REF_PREFIX}${cbAffiliateNick(affiliate) ?? CB_NO_AFFILIATE}`;
}

/** The affiliate of a ClickBank funnel tag; null for 'cbaff-no-affiliate', 'cbaff-owner-test' and every other funnel's tag. */
export function affiliateOfRef(ref: string | null | undefined): string | null {
  return typeof ref === 'string' && isClickBankRef(ref) ? cbAffiliateNick(ref.slice(CB_REF_PREFIX.length)) : null;
}

/** The three funnels: the AI Media Machine funnel ('app'), the $49 FastSpring funnel ('service') and the ClickBank one ('cb'). */
export type FunnelName = 'app' | 'service' | 'cb';

export function funnelOf(ref: string | null | undefined): FunnelName {
  return isClickBankRef(ref) ? 'cb' : isServiceRef(ref) ? 'service' : 'app';
}

/** A tag without its ClickBank prefix, however often it repeats ('cbaff-cbaff-x' loses both). */
function withoutCbPrefix(tag: string): string {
  let out = tag;
  while (isClickBankRef(out)) out = out.slice(CB_REF_PREFIX.length);
  return out;
}

/**
 * The tag a landing page sends: on the service page always prefixed ('svc-' + the link's tag, or 'svc-direct'),
 * on the first page never (a hand-made ?ref=svc-... loses the prefix). Stays within the 60 characters the server takes.
 * On the ClickBank page it is always cbRefFor(?affiliate=), whatever ?ref= says. Every other page drops a hand-made
 * 'cbaff-' first, so a tag without it gets exactly the answer it got before the ClickBank funnel.
 */
export function funnelRef(raw: string | undefined, pathname: string, affiliate?: string | null): string | undefined {
  if (isClickBankLandingPath(pathname)) return cbRefFor(affiliate);
  const bare = raw ? withoutCbPrefix(raw) : raw;
  const clean = bare && isServiceRef(bare) ? bare.slice(SERVICE_REF_PREFIX.length) : bare;
  // A hand-made 'svc-cbaff-x' must not land in the ClickBank funnel from the first page either.
  if (!isServiceLandingPath(pathname)) return (clean && withoutCbPrefix(clean)) || undefined;
  return `${SERVICE_REF_PREFIX}${clean || 'direct'}`.slice(0, 60);
}
