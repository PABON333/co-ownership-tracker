import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TransactionForm } from '@/components/transaction-form'

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
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

  const { data: groups } = await supabase
    .from('ownership_groups')
    .select('id, name, display_order')
    .eq('workspace_id', membership.workspace_id)
    .eq('active', true)
    .order('display_order')

  const { data: balancesRaw } = await supabase.rpc('get_capital_balances', {
    p_workspace_id: membership.workspace_id,
  })

  const { data: policyRaw } = await supabase
    .from('equity_policy_versions')
    .select('policy_data')
    .eq('workspace_id', membership.workspace_id)
    .order('effective_at', { ascending: false })
    .limit(1)
    .single()

  const params = await searchParams

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <TransactionForm
        groups={groups ?? []}
        balances={(balancesRaw ?? []) as Array<{
          ownership_group_id: string
          ownership_group_name: string
          balance_cents: number
        }>}
        policy={(policyRaw?.policy_data as Record<string, unknown>) ?? {}}
        defaultType={params.type}
      />
    </div>
  )
}
