import { NextResponse } from 'next/server'
import { createClient } from '@/app/supabase/server'
import { getCreditBankStatus } from '@/lib/credits/credit-bank'

/**
 * The caller's credit bank standing (new lifetime buyers only: 5,000 credits once, at most
 * 1,500 bank credits per rolling 30 days). Every other account gets { bank: null }, and pages
 * then show nothing new. Read by useCredits.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const bank = await getCreditBankStatus(user.id)
  return NextResponse.json({ bank })
}
