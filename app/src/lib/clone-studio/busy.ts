/**
 * A language model that answers "busy" (429, or any 5xx) is asked again after a growing
 * wait, instead of failing the whole run: on a busy evening the director's model turns
 * down a call or two and takes the next one (2026-10-01: Google answered 503 "high demand"
 * to a quarter of all calls for a while). Any other answer, good or bad, is returned as it
 * came. `ask` makes a fresh request each time (a timeout signal cannot be reused).
 */
export const isBusy = (res: Response) => res.status === 429 || res.status >= 500;

export async function askWhenFree(ask: () => Promise<Response>, waitSeconds: number[] = [5, 15, 30, 45]): Promise<Response> {
  for (let tries = 0; ; tries++) {
    const res = await ask();
    if (!isBusy(res) || tries >= waitSeconds.length) return res;
    console.warn(`⚠️ The model answered ${res.status}; asking again in ${waitSeconds[tries]} s`);
    await new Promise((resolve) => setTimeout(resolve, waitSeconds[tries] * 1000));
  }
}
