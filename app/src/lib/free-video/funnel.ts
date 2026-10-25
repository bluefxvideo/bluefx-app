/**
 * The second free video ad funnel (owner 2026-10-25: "keep it separate, keep it simple"): the same landing page at
 * its own address (SERVICE_LANDING_PATH), the same free video ad, but the offer at the end is Unlimited Video Ads
 * ($99/month done-for-you service, service-page.ts) instead of the AI Media Machine, with its own MailerLite emails
 * and its own Facebook campaign. A lead belongs to it when its ref starts with SERVICE_REF_PREFIX: the service
 * landing page adds the prefix to every tag it sends, and the first landing page strips it, so no link can move a
 * lead from one funnel to the other.
 *
 * Client-safe: no server imports.
 */

/** The service funnel's landing page (the Facebook campaign's link). */
export const SERVICE_LANDING_PATH = '/free-ad';

export const SERVICE_REF_PREFIX = 'svc-';

/** True for a lead (or an event) of the service funnel. */
export const isServiceRef = (ref: string | null | undefined): boolean => typeof ref === 'string' && ref.startsWith(SERVICE_REF_PREFIX);

/** The owner's own test signups (a browser marked internal): 'owner-test', or 'svc-owner-test' from the service page. */
export const ownerTestRef = (ref: string | null | undefined): string => (isServiceRef(ref) ? `${SERVICE_REF_PREFIX}owner-test` : 'owner-test');

/** True for either owner test tag (the admin numbers and the Conversions API leave both out). */
export const isOwnerTestRef = (ref: string | null | undefined): boolean => {
  const tag = ref?.trim();
  return tag === 'owner-test' || tag === `${SERVICE_REF_PREFIX}owner-test`;
};

/** True on the service funnel's landing page. */
export const isServiceLandingPath = (pathname: string): boolean =>
  pathname === SERVICE_LANDING_PATH || pathname.startsWith(`${SERVICE_LANDING_PATH}/`);

/**
 * The tag a landing page sends: on the service page always prefixed ('svc-' + the link's tag, or 'svc-direct'),
 * on the first page never (a hand-made ?ref=svc-... loses the prefix). Stays within the 60 characters the server takes.
 */
export function funnelRef(raw: string | undefined, pathname: string): string | undefined {
  const clean = raw && isServiceRef(raw) ? raw.slice(SERVICE_REF_PREFIX.length) : raw;
  if (!isServiceLandingPath(pathname)) return clean || undefined;
  return `${SERVICE_REF_PREFIX}${clean || 'direct'}`.slice(0, 60);
}
