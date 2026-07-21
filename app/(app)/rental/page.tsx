import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCentsAsCurrency } from '@/lib/financial/calculations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Building2 } from 'lucide-react'
import { format, parseISO, getYear } from 'date-fns'

export default async function RentalPage() {
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
  const currentYear = new Date().getFullYear()

  const { data: rentalTransactions } = await supabase
    .from('financial_transactions')
    .select('id, effective_date, description, amount_cents, counterparty_reference, status, notes, property_cash_effect_cents')
    .eq('workspace_id', workspaceId)
    .eq('type', 'rental_income')
    .order('effective_date', { ascending: false })

  const { data: distributions } = await supabase
    .from('financial_transactions')
    .select('id, effective_date, description, amount_cents, status')
    .eq('workspace_id', workspaceId)
    .eq('type', 'cash_distribution')
    .order('effective_date', { ascending: false })
    .limit(20)

  const ytdRental = (rentalTransactions ?? [])
    .filter((t) => t.status === 'posted' && getYear(parseISO(t.effective_date)) === currentYear)
    .reduce((s, t) => s + t.amount_cents, 0)

  const totalRental = (rentalTransactions ?? [])
    .filter((t) => t.status === 'posted')
    .reduce((s, t) => s + t.amount_cents, 0)

  const retained = (rentalTransactions ?? [])
    .filter((t) => t.status === 'posted' && t.property_cash_effect_cents > 0)
    .reduce((s, t) => s + t.amount_cents, 0)

  const distributed = (rentalTransactions ?? [])
    .filter((t) => t.status === 'posted' && t.property_cash_effect_cents === 0)
    .reduce((s, t) => s + t.amount_cents, 0)

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rental Income</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track rent received and distributions.</p>
        </div>
        <Button asChild>
          <Link href="/transactions/new?type=rental_income">
            <Plus className="mr-2 h-4 w-4" />
            Record Rental Income
          </Link>
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>YTD Rental Income ({currentYear})</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCentsAsCurrency(ytdRental)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Retained</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCentsAsCurrency(retained)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Distributed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{formatCentsAsCurrency(distributed)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rental income ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rental Income Ledger</CardTitle>
          <CardDescription>All recorded rental income transactions</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(rentalTransactions?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium">No rental income recorded</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/transactions/new?type=rental_income">Record first rent</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Tenant / Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Treatment</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rentalTransactions ?? []).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(parseISO(tx.effective_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tx.counterparty_reference ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Link href={`/transactions/${tx.id}`} className="hover:underline text-sm font-medium">
                          {tx.description}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatCentsAsCurrency(tx.amount_cents)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.property_cash_effect_cents > 0 ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {tx.property_cash_effect_cents > 0 ? 'Retained' : 'Distributed'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.status === 'posted' ? 'default' : 'secondary'}
                          className="text-xs capitalize"
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
