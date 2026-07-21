import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCentsAsCurrency, formatPercentage, calculateOwnershipPercentages } from '@/lib/financial/calculations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle } from 'lucide-react'
import { LEGAL_DISCLAIMER, EXPENSE_CATEGORY_LABELS } from '@/lib/types/app'
import type { ExpenseCategory } from '@/lib/types/database'
import { format, parseISO, getYear } from 'date-fns'
import { ReportDateFilter } from '@/components/report-date-filter'
import { ExportCsvButton } from '@/components/export-csv-button'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>
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

  const workspaceId = membership.workspace_id
  const params = await searchParams
  const currentYear = new Date().getFullYear()
  const fromDate = params.from ?? `${currentYear}-01-01`
  const toDate = params.to ?? `${currentYear}-12-31`

  // Capital balances
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

  // Contributions in period
  let txQuery = supabase
    .from('financial_transactions')
    .select('id, type, effective_date, description, amount_cents, expense_category, counterparty_reference, status')
    .eq('workspace_id', workspaceId)
    .eq('status', 'posted')
    .gte('effective_date', fromDate)
    .lte('effective_date', toDate)
    .order('effective_date', { ascending: false })

  const { data: periodTransactions } = await txQuery

  const contributions = (periodTransactions ?? []).filter((t) =>
    ['initial_contribution', 'additional_contribution'].includes(t.type)
  )
  const expenses = (periodTransactions ?? []).filter((t) =>
    ['owner_paid_expense', 'property_cash_expense', 'capital_improvement'].includes(t.type)
  )
  const rentalIncome = (periodTransactions ?? []).filter((t) => t.type === 'rental_income')
  const distributions = (periodTransactions ?? []).filter((t) => t.type === 'cash_distribution')
  const mortgagePayments = (periodTransactions ?? []).filter((t) => t.type === 'mortgage_payment')

  // Expense by category
  const expenseByCategory = new Map<ExpenseCategory, number>()
  for (const e of expenses) {
    if (e.expense_category) {
      expenseByCategory.set(
        e.expense_category as ExpenseCategory,
        (expenseByCategory.get(e.expense_category as ExpenseCategory) ?? 0) + e.amount_cents
      )
    }
  }

  const formatDate = (d: string) => format(parseISO(d), 'MMM d, yyyy')

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Financial summaries for the family property.
          </p>
        </div>
        <ExportCsvButton workspaceId={workspaceId} from={fromDate} to={toDate} />
      </div>

      <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs">{LEGAL_DISCLAIMER}</AlertDescription>
      </Alert>

      <ReportDateFilter defaultFrom={fromDate} defaultTo={toDate} />

      <Tabs defaultValue={params.tab ?? 'ownership'}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ownership">Ownership</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="rental">Rental</TabsTrigger>
          <TabsTrigger value="mortgage">Mortgage</TabsTrigger>
        </TabsList>

        {/* Ownership report */}
        <TabsContent value="ownership" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Ownership Report</CardTitle>
              <CardDescription>Based on cumulative capital-account balances as of today.</CardDescription>
            </CardHeader>
            <CardContent>
              {totalCapital === 0 ? (
                <p className="text-muted-foreground text-sm">Ownership not established yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ownership Group</TableHead>
                      <TableHead className="text-right">Capital Balance</TableHead>
                      <TableHead className="text-right">Calculated Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balances.map((b) => (
                      <TableRow key={b.ownership_group_id}>
                        <TableCell className="font-medium">{b.ownership_group_name}</TableCell>
                        <TableCell className="text-right">{formatCentsAsCurrency(b.balance_cents)}</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatPercentage(percentages.get(b.ownership_group_id) ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatCentsAsCurrency(totalCapital)}</TableCell>
                      <TableCell className="text-right">100.00%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contributions */}
        <TabsContent value="contributions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contributions Report</CardTitle>
              <CardDescription>
                {formatDate(fromDate)} – {formatDate(toDate)} ·{' '}
                {formatCentsAsCurrency(contributions.reduce((s, t) => s + t.amount_cents, 0))} total
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {contributions.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4">No contributions in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contributions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(t.effective_date)}</TableCell>
                        <TableCell className="text-sm">{t.description}</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCentsAsCurrency(t.amount_cents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses" className="space-y-4">
          {/* Category totals */}
          {expenseByCategory.size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from(expenseByCategory.entries()).map(([cat, total]) => (
                      <TableRow key={cat}>
                        <TableCell>{EXPENSE_CATEGORY_LABELS[cat]}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCentsAsCurrency(total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {formatCentsAsCurrency(expenses.reduce((s, t) => s + t.amount_cents, 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expense Detail</CardTitle>
              <CardDescription>
                {formatDate(fromDate)} – {formatDate(toDate)}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {expenses.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4">No expenses in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(t.effective_date)}</TableCell>
                        <TableCell className="text-sm">{t.description}</TableCell>
                        <TableCell className="text-sm">
                          {t.expense_category
                            ? EXPENSE_CATEGORY_LABELS[t.expense_category as ExpenseCategory]
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCentsAsCurrency(t.amount_cents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rental */}
        <TabsContent value="rental" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Rental Income</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCentsAsCurrency(rentalIncome.reduce((s, t) => s + t.amount_cents, 0))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Distributions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCentsAsCurrency(distributions.reduce((s, t) => s + t.amount_cents, 0))}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rental Income Detail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {rentalIncome.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4">No rental income in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Tenant / Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentalIncome.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(t.effective_date)}</TableCell>
                        <TableCell className="text-sm">{t.counterparty_reference ?? '—'}</TableCell>
                        <TableCell className="text-sm">{t.description}</TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCentsAsCurrency(t.amount_cents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mortgage */}
        <TabsContent value="mortgage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mortgage Payment Report</CardTitle>
              <CardDescription>
                {formatDate(fromDate)} – {formatDate(toDate)} ·{' '}
                {formatCentsAsCurrency(mortgagePayments.reduce((s, t) => s + t.amount_cents, 0))} total
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {mortgagePayments.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4">No mortgage payments in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Lender</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mortgagePayments.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(t.effective_date)}</TableCell>
                        <TableCell className="text-sm">{t.counterparty_reference ?? '—'}</TableCell>
                        <TableCell className="text-sm">{t.description}</TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCentsAsCurrency(t.amount_cents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
