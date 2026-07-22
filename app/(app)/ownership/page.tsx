import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  formatCentsAsCurrency,
  formatPercentage,
  calculateOwnershipPercentages,
} from '@/lib/financial/calculations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Info, Users } from 'lucide-react'
import { LEGAL_DISCLAIMER } from '@/lib/types/app'
import { OwnershipChart } from '@/components/ownership-chart'
import { format, parseISO } from 'date-fns'

export default async function OwnershipPage() {
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

  const workspaceId = membership.workspace_id

  const { data: balancesRaw } = await supabase.rpc('get_capital_balances', {
    p_workspace_id: workspaceId,
  })

  const balances = (balancesRaw ?? []) as Array<{
    ownership_group_id: string
    ownership_group_name: string
    balance_cents: number
  }>

  const totalCapital = balances.reduce((s, b) => s + b.balance_cents, 0)
  const percentages = calculateOwnershipPercentages(
    balances.map((b) => ({
      groupId: b.ownership_group_id,
      groupName: b.ownership_group_name,
      balanceCents: b.balance_cents,
    }))
  )

  // Fetch group details with members
  const { data: groups } = await supabase
    .from('ownership_groups')
    .select('id, name, active, display_order, ownership_group_members(profile_id, profiles(full_name, email))')
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .order('display_order')

  // Per-group contribution totals
  const { data: contributions } = await supabase
    .from('capital_ledger_entries')
    .select('ownership_group_id, signed_amount_cents')
    .in(
      'transaction_id',
      (
        await supabase
          .from('financial_transactions')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('status', 'posted')
          .then((r) => r.data?.map((t) => t.id) ?? [])
      )
    )

  const groupContributions = new Map<string, number>()
  for (const c of contributions ?? []) {
    groupContributions.set(
      c.ownership_group_id,
      (groupContributions.get(c.ownership_group_id) ?? 0) + c.signed_amount_cents
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ownership</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Calculated capital-account shares. Internal estimates only.
        </p>
      </div>

      <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs">{LEGAL_DISCLAIMER}</AlertDescription>
      </Alert>

      <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm">
          <strong>Ownership formula:</strong> Each group&apos;s capital-account balance divided by
          the total capital basis. Capital accounts are driven entirely by the transaction ledger —
          contributions credit a group, distributions debit it.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chart */}
        {totalCapital > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ownership Distribution</CardTitle>
              <CardDescription>Based on capital-account balances</CardDescription>
            </CardHeader>
            <CardContent>
              <OwnershipChart
                data={balances.map((b) => ({
                  name: b.ownership_group_name,
                  value: b.balance_cents,
                  percentage: percentages.get(b.ownership_group_id) ?? 0,
                }))}
              />
            </CardContent>
          </Card>
        )}

        {/* Summary table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capital Account Summary</CardTitle>
            <CardDescription>
              Total basis: {formatCentsAsCurrency(totalCapital)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalCapital === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Ownership not established yet.</p>
                <p>Post initial contributions to establish ownership percentages.</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/transactions/new?type=initial_contribution">
                    Post Initial Contribution
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {balances.map((b) => {
                  const pct = percentages.get(b.ownership_group_id) ?? 0
                  return (
                    <div key={b.ownership_group_id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{b.ownership_group_name}</span>
                        <span className="font-bold">{formatPercentage(pct)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Capital: {formatCentsAsCurrency(b.balance_cents)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Group detail cards */}
      <h2 className="text-lg font-semibold">Ownership Groups</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {(groups ?? []).map((group) => {
          const balance = balances.find((b) => b.ownership_group_id === group.id)
          const pct = balance ? (percentages.get(group.id) ?? 0) : 0
          const members = (group.ownership_group_members ?? []) as unknown as Array<{
            profile_id: string
            profiles: { full_name: string | null; email: string } | null
          }>

          return (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{group.name}</CardTitle>
                  <span className="text-xl font-bold text-primary">{formatPercentage(pct)}</span>
                </div>
                <CardDescription>
                  Capital: {formatCentsAsCurrency(balance?.balance_cents ?? 0)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Members</p>
                    <div className="flex flex-wrap gap-1">
                      {members.map((m) => (
                        <Badge key={m.profile_id} variant="outline" className="text-xs">
                          {m.profiles?.full_name ?? m.profiles?.email ?? m.profile_id}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/transactions?group=${group.id}`}>View Transactions</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
