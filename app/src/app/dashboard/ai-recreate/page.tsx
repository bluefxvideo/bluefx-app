import { redirect } from 'next/navigation';

// Legacy path — the tool was renamed to Ad Creator. Preserve the query string
// (notably `analysisId`) so hand-offs from the Video Analyzer still hydrate the
// wizard; a bare redirect would drop the params and land the user on an empty page.
export default async function AIRecreateRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else if (value !== undefined) {
      qs.append(key, value);
    }
  }
  const query = qs.toString();
  redirect(`/dashboard/ad-creator${query ? `?${query}` : ''}`);
}
