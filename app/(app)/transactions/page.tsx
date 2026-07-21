import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCentsAsCurrency } from '@/lib/financial/calculations'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, ArrowLeftRight } from 'lucide-react'
import { TRANSACTION_TYPE_LABELS } from '@/lib/types/app'
import type { TransactionType, TransactionStatus } from '@/lib/types/database'
import { format, parseISO } from 'date-fns'
import { TransactionFilters } from '@/components/transaction-filters'

const STATUS_VARIANT: Record<TransactionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  posted: 'default',
  reversed: 'secondary',
  voided: 'destructive',
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string
    status?: string
    from?: string
    to?: string
    page?: string
  }>
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

  const params = await searchParams
  const pageNum = parseInt(params.page ?? '1')
  const pageSize = 25
  const offset = (pageNum - 1) * pageSize

  let query = supabase
    .from('financial_transactions')
    .select('id, type, status, effective_date, description, amount_cents, property_cash_effect_cents, created_by, created_at, posted_at', { count: 'exact' })
    .eq('workspace_id', membership.workspace_id)
    .order('effective_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (params.type) query = query.eq('type', params.type)
  if (params.status) query = query.eq('status', params.status)
  if (params.from) query = query.gte('effective_date', params.from)
  if (params.to) query = query.lte('effective_date', params.to)

  const { data: transactions, count } = await query

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {count ?? 0} total transaction{count !== 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/transactions/new">
            <Plus className="mr-2 h-4 w-4" />
            New Transaction
          </Link>
        </Button>
      </div>

      <TransactionFilters />

      <Card>
        <CardContent className="p-0">
          {(transactions?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ArrowLeftRight className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium">No transactions found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {params.type || params.status || params.from || params.to
                  ? 'Try adjusting your filters.'
                  : 'Post your first transaction to get started.'}
              </p>
              {!params.type && !params.status && (
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/transactions/new">Post first transaction</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Cash Effect</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transactions ?? []).map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(parseISO(tx.effective_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {TRANSACTION_TYPE_LABELS[tx.type as TransactionType]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/transactions/${tx.id}`}
                          className="font-medium hover:underline text-sm line-clamp-1"
                        >
                          {tx.description}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCentsAsCurrency(tx.amount_cents)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <span
                          className={
                            tx.property_cash_effect_cents > 0
                              ? 'text-green-600'
                              : tx.property_cash_effect_cents < 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                          }
                        >
                          {tx.property_cash_effect_cents !== 0
                            ? formatCentsAsCurrency(tx.property_cash_effect_cents)
                            : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={STATUS_VARIANT[(tx.status as TransactionStatus) ?? 'posted']}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pageNum} of {totalPages}
          </span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/transactions?page=${pageNum - 1}`}>Previous</Link>
              </Button>
            )}
            {pageNum < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/transactions?page=${pageNum + 1}`}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
