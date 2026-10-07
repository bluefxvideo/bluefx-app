import { createClient } from '@/app/supabase/server'
import { redirect } from 'next/navigation'
import { AFTER_LOGIN_PATH } from '@/lib/after-login'

export default async function HomePage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  redirect(AFTER_LOGIN_PATH)
}
