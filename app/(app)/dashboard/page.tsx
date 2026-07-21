import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCentsAsCurrency, formatPercentage, calculateOwnershipPercentages } from '@/lib/financial/calculations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  PlusCircle,
  Home,
  TrendingUp,
  DollarSign,
  Building2,
  ArrowLeftRight,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import { TRANSACTION_TYPE_LABELS, LEGAL_DISCLAIMER } from '@/lib/types/app'
import { OwnershipChart } from '@/components/ownership-chart'
import { format, parseISO } from 'date-fns'

export default async function DashboardPage() {
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

  // Fetch capital balances via RPC
  const { data: balancesRaw } = await supabase.rpc('get_capital_balances', {
    p_workspace_id: workspaceId,
  })

  // Fetch property cash balance
  const { data: cashBalanceRaw } = await supabase.rpc('get_property_cash_balance', {
    p_workspace_id: workspaceId,
  })

  const balances = (balancesRaw ?? []) as Array<{
    ownership_group_id: string
    ownership_group_name: string
    balance_cents: number
  }>

  const cashBalance = (cashBalanceRaw as number) ?? 0

  const totalCapital = balances.reduce((sum, b) => sum + b.balance_cents, 0)
  const percentages = calculateOwnershipPercentages(
    balances.map((b) => ({
      groupId: b.ownership_group_id,
      groupName: b.ownership_group_name,
      balanceCents: b.balance_cents,
    }))
  )

  // Recent transactions
  const { data: recentTx } = await supabase
    .from('financial_transactions')
    .select('id, type, effective_date, description, amount_cents, status, created_by')
    .eq('workspace_id', workspaceId)
    .order('effective_date', { ascending: false })
    .limit(8)

  // YTD rental income
  const currentYear = new Date().getFullYear()
  const { data: ytdRental } = await supabase
    .from('financial_transactions')
    .select('amount_cents')
    .eq('workspace_id', workspaceId)
    .eq('type', 'rental_income')
    .eq('status', 'posted')
    .gte('effective_date', `${currentYear}-01-01`)

  // YTD expenses
  const { data: ytdExpenses } = await supabase
    .from('financial_transactions')
    .select('amount_cents')
    .eq('workspace_id', workspaceId)
    .in('type', ['owner_paid_expense', 'property_cash_expense', 'capital_improvement'])
    .eq('status', 'posted')
    .gte('effective_date', `${currentYear}-01-01`)

  const ytdRentalTotal = (ytdRental ?? []).reduce((s, r) => s + r.amount_cents, 0)
  const ytdExpensesTotal = (ytdExpenses ?? []).reduce((s, r) => s + r.amount_cents, 0)

  const hasTransactions = (recentTx?.length ?? 0) > 0

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-6xl">
      {/* Disclaimer banner */}
      <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-xs">{LEGAL_DISCLAIMER}</AlertDescription>
      </Alert>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Total Capital Basis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCentsAsCurrency(totalCapital)}</p>
            <p className="text-xs text-muted-foreground mt-1">Sum of all capital accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              Property Cash Pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCentsAsCurrency(cashBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">Net inflows minus outflows</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              Rental Income YTD
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCentsAsCurrency(ytdRentalTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Calendar year {currentYear}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              Expenses YTD
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCentsAsCurrency(ytdExpensesTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Calendar year {currentYear}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ownership summary */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Calculated Ownership Shares</CardTitle>
              <CardDescription>
                Based on capital-account balances. Internal estimate only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalCapital === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="font-medium">Ownership not established yet.</p>
                  <p className="text-sm mt-1">
                    Post initial contributions to establish ownership percentages.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {balances.map((b) => {
                    const pct = percentages.get(b.ownership_group_id) ?? 0
                    return (
                      <div key={b.ownership_group_id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{b.ownership_group_name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">{formatCentsAsCurrency(b.balance_cents)}</span>
                            <span className="font-semibold w-14 text-right">{formatPercentage(pct)}</span>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/80"
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

          {/* Ownership chart */}
          {totalCapital > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ownership Distribution</CardTitle>
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
        </div>

        {/* Quick actions + recent activity */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full justify-start gap-2" variant="outline">
                <Link href="/transactions/new?type=initial_contribution">
                  <Plus className="h-4 w-4" /> Record Contribution
                </Link>
              </Button>
              <Button asChild className="w-full justify-start gap-2" variant="outline">
                <Link href="/transactions/new?type=owner_paid_expense">
                  <Plus className="h-4 w-4" /> Add Expense
                </Link>
              </Button>
              <Button asChild className="w-full justify-start gap-2" variant="outline">
                <Link href="/transactions/new?type=mortgage_payment">
                  <Plus className="h-4 w-4" /> Mortgage Payment
                </Link>
              </Button>
              <Button asChild className="w-full justify-start gap-2" variant="outline">
                <Link href="/transactions/new?type=rental_income">
                  <Plus className="h-4 w-4" /> Record Rent
                </Link>
              </Button>
              <Button asChild className="w-full justify-start gap-2" variant="outline">
                <Link href="/transactions/new?type=cash_distribution">
                  <Plus className="h-4 w-4" /> Cash Distribution
                </Link>
              </Button>
              <Separator />
              <Button asChild className="w-full justify-start gap-2" variant="ghost">
                <Link href="/reports">
                  <TrendingUp className="h-4 w-4" /> View Reports
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/transactions">View all</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!hasTransactions ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No transactions yet.</p>
                  <Button asChild variant="link" size="sm" className="mt-1">
                    <Link href="/transactions/new">Post your first transaction</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(recentTx ?? []).map((tx) => (
                    <Link
                      key={tx.id}
                      href={`/transactions/${tx.id}`}
                      className="flex items-start justify-between gap-2 rounded-md p-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs py-0">
                            {TRANSACTION_TYPE_LABELS[tx.type]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(tx.effective_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-medium shrink-0">
                        {formatCentsAsCurrency(tx.amount_cents)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
