import { redirect } from 'next/navigation';

// /dashboard/business-tools has no UI of its own (only child tools) — landing
// here used to 404. Send users to the primary child tool instead.
export default function BusinessToolsIndexRoute() {
  redirect('/dashboard/business-tools/train-my-business');
}
