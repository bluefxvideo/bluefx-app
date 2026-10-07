/**
 * Where a person lands after signing in or setting a password: The Phantom, so the first thing people use is the tool
 * that makes a video ad from one link (owner 2026-10-07: "we now have the phantom tool, how to deal with that so people
 * go to it first thing?"). The dashboard stays one click away under "Start Here" in the sidebar.
 */
export const AFTER_LOGIN_PATH = '/dashboard/smart-video';

/** A ?next= target, only when it is a path on this site (never another site, never //host); else AFTER_LOGIN_PATH. */
export function afterLoginPath(next: string | null | undefined): string {
  if (next && /^\/(?![/\\])[^\s]*$/.test(next)) return next;
  return AFTER_LOGIN_PATH;
}
