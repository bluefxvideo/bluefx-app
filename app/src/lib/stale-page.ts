/**
 * A tab that stayed open across a deploy still runs the previous build. Its
 * server-action ids no longer exist on the new server, so every action call
 * fails before it runs (nothing is charged). Next.js words this as
 *   Server Action "<id>" was not found on the server. Read more:
 *   https://nextjs.org/docs/messages/failed-to-find-server-action
 * (older builds: "Failed to find Server Action"). The only remedy is a reload.
 */
export function isStalePageError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /was not found on the server|failed-to-find-server-action|Failed to find Server Action/i.test(message);
}
