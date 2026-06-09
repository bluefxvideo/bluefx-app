import { NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';

/**
 * Admin-only env diagnostics. Previously unauthenticated and leaked env-var names
 * + partial key values — now gated behind an authenticated admin and reports only
 * presence (SET / NOT SET), never any value.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const isAdmin = profile?.role === 'admin' || user.email === 'contact@bluefx.net';
  if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const status = (v?: string) => (v ? 'SET' : 'NOT SET');
  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY: status(process.env.OPENAI_API_KEY),
    GOOGLE_GENERATIVE_AI_API_KEY: status(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    FAL_KEY: status(process.env.FAL_KEY),
    CRON_SECRET_TOKEN: status(process.env.CRON_SECRET_TOKEN || process.env.APP_CRON_SECRET_TOKEN),
    FASTSPRING_API_KEY: status(process.env.FASTSPRING_API_KEY),
    CLICKBANK_CLERK_KEY: status(process.env.CLICKBANK_CLERK_KEY || process.env.APP_CLICKBANK_CLERK_KEY),
  });
}
