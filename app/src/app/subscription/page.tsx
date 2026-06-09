import { redirect } from 'next/navigation';

// The canonical subscription page lives in the dashboard. This route was a full
// duplicate copy that could drift out of sync — keep it only as a redirect so
// old links/bookmarks still work.
export default function SubscriptionRedirect() {
  redirect('/dashboard/subscription');
}
