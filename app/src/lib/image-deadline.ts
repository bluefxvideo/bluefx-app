/**
 * Requests to the live app go through a proxy that cuts them after about 55 s,
 * while the server keeps working (and may still charge). Callers that run a
 * whole image generation inside one request pass a deadline down to the image
 * engines, so the answer reaches the page before the cut.
 */

/** Milliseconds left before `deadlineAt` (epoch ms), capped by `cap`; `cap` when there is no deadline. */
export function msUntil(deadlineAt: number | undefined, cap: number): number {
  if (!deadlineAt) return cap;
  return Math.max(0, Math.min(cap, deadlineAt - Date.now()));
}

/** Total budget for one image request made from the page (proxy cut is about 55 s). */
export const PAGE_IMAGE_BUDGET_MS = 46_000;

/** How long a page request can live before the proxy cut, with a small margin. */
export const PAGE_REQUEST_LIMIT_MS = 54_000;

/**
 * Milliseconds before the proxy cuts a request that started at `requestStartedAt`
 * (negative once it has). Work after that point never reaches the page, so it must
 * not be charged.
 */
export function msLeftForPage(requestStartedAt: number): number {
  return PAGE_REQUEST_LIMIT_MS - (Date.now() - requestStartedAt);
}
