import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('profile_id', user.id)
    .single()

  if (!membership) redirect('/onboarding')

  const { data: workspace } = await supabase
    .from('property_workspace')
    .select('id, property_name, address')
    .eq('id', membership.workspace_id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav
        workspaceName={workspace?.property_name ?? 'Family Property'}
        userEmail={profile?.email ?? user.email ?? ''}
        userName={profile?.full_name ?? null}
      />
      <main className="flex-1 bg-muted/20">{children}</main>
    </div>
  )
}
