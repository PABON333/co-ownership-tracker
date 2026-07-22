import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCentsAsCurrency, formatPercentage } from '@/lib/financial/calculations'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { TRANSACTION_TYPE_LABELS, EXPENSE_CATEGORY_LABELS, LEGAL_DISCLAIMER } from '@/lib/types/app'
import type { TransactionType, TransactionStatus, ExpenseCategory } from '@/lib/types/database'
import { format, parseISO } from 'date-fns'
import { ReversalForm } from '@/components/reversal-form'

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: tx } = await supabase
    .from('financial_transactions')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', membership.workspace_id)
    .single()

  if (!tx) notFound()

  const { data: allocations } = await supabase
    .from('transaction_allocations')
    .select('*, ownership_groups(name)')
    .eq('transaction_id', id)

  const { data: capitalEffects } = await supabase
    .from('capital_ledger_entries')
    .select('*, ownership_groups(name)')
    .eq('transaction_id', id)

  const { data: creatorProfile } = tx.created_by
    ? await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', tx.created_by)
        .single()
    : { data: null }

  const { data: reversalTx } = tx.reversed_transaction_id
    ? await supabase
        .from('financial_transactions')
        .select('id, description, effective_date')
        .eq('id', tx.reversed_transaction_id)
        .single()
    : { data: null }

  const { data: linkedReversal } = await supabase
    .from('financial_transactions')
    .select('id, effective_date, description')
    .eq('reversed_transaction_id', id)
    .single()
    .then((r) => (r.error ? { data: null } : r))

  const policySnapshot = tx.policy_snapshot as Record<string, unknown> | null

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/transactions">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{tx.description}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {TRANSACTION_TYPE_LABELS[tx.type as TransactionType]}
              </Badge>
              <Badge
                variant={
                  tx.status === 'posted' ? 'default' : tx.status === 'reversed' ? 'secondary' : 'destructive'
                }
                className="text-xs capitalize"
              >
                {tx.status}
              </Badge>
            </div>
          </div>
        </div>
        <p className="text-2xl font-bold">{formatCentsAsCurrency(tx.amount_cents)}</p>
      </div>

      {tx.status === 'reversed' && linkedReversal && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This transaction was reversed on {format(parseISO(linkedReversal.effective_date), 'MMMM d, yyyy')}.{' '}
            <Link href={`/transactions/${linkedReversal.id}`} className="underline">
              View reversal
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {tx.type === 'reversal' && reversalTx && (
        <Alert>
          <AlertDescription>
            This reversal offsets transaction:{' '}
            <Link href={`/transactions/${reversalTx.id}`} className="underline font-medium">
              {reversalTx.description}
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Core details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Effective Date</p>
              <p className="font-medium">{format(parseISO(tx.effective_date), 'MMMM d, yyyy')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Amount</p>
              <p className="font-medium">{formatCentsAsCurrency(tx.amount_cents)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Property Cash Effect</p>
              <p
                className={`font-medium ${
                  tx.property_cash_effect_cents > 0
                    ? 'text-green-600'
                    : tx.property_cash_effect_cents < 0
                    ? 'text-red-600'
                    : ''
                }`}
              >
                {tx.property_cash_effect_cents !== 0
                  ? formatCentsAsCurrency(tx.property_cash_effect_cents)
                  : '—'}
              </p>
            </div>
            {tx.expense_category && (
              <div>
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium">
                  {EXPENSE_CATEGORY_LABELS[tx.expense_category as ExpenseCategory]}
                </p>
              </div>
            )}
            {tx.counterparty_reference && (
              <div>
                <p className="text-muted-foreground">Vendor / Reference</p>
                <p className="font-medium">{tx.counterparty_reference}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Created By</p>
              <p className="font-medium">
                {creatorProfile?.full_name ?? creatorProfile?.email ?? 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Posted At</p>
              <p className="font-medium">
                {tx.posted_at ? format(new Date(tx.posted_at), 'MMM d, yyyy h:mm a') : '—'}
              </p>
            </div>
          </div>
          {tx.notes && (
            <>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{tx.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Allocations */}
      {(allocations?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {(allocations ?? []).map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span>{(a.ownership_groups as unknown as { name: string } | null)?.name ?? a.ownership_group_id}</span>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs capitalize">
                      {a.allocation_role}
                    </Badge>
                    <span className="font-medium">{formatCentsAsCurrency(a.amount_cents)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capital account effects */}
      {(capitalEffects?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capital Account Effects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {(capitalEffects ?? []).map((e) => (
                <div key={e.id} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {(e.ownership_groups as unknown as { name: string } | null)?.name}
                    </span>
                    <span
                      className={
                        e.signed_amount_cents > 0
                          ? 'text-green-600 font-medium'
                          : 'text-red-600 font-medium'
                      }
                    >
                      {e.signed_amount_cents > 0 ? '+' : ''}
                      {formatCentsAsCurrency(e.signed_amount_cents)}
                    </span>
                  </div>
                  {(e.pre_transaction_percentage !== null || e.post_transaction_percentage !== null) && (
                    <div className="text-muted-foreground text-xs">
                      {e.pre_transaction_percentage !== null && (
                        <span>Before: {formatPercentage(Number(e.pre_transaction_percentage))}</span>
                      )}
                      {e.pre_transaction_percentage !== null && e.post_transaction_percentage !== null && (
                        <span> → </span>
                      )}
                      {e.post_transaction_percentage !== null && (
                        <span>After: {formatPercentage(Number(e.post_transaction_percentage))}</span>
                      )}
                    </div>
                  )}
                  {e.policy_rationale && (
                    <p className="text-muted-foreground text-xs italic">{e.policy_rationale}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Policy snapshot */}
      {policySnapshot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Equity Policy at Time of Posting</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="space-y-1 text-muted-foreground">
              <p>
                Mortgage interest credits payer:{' '}
                <span className="text-foreground font-medium">
                  {policySnapshot.mortgage_interest_credits_payer ? 'Yes' : 'No'}
                </span>
              </p>
              <p>
                Mortgage escrow credits payer:{' '}
                <span className="text-foreground font-medium">
                  {policySnapshot.mortgage_escrow_credits_payer ? 'Yes' : 'No'}
                </span>
              </p>
              <p>
                Retained rental allocation:{' '}
                <span className="text-foreground font-medium capitalize">
                  {String(policySnapshot.retained_rental_income_allocation)}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reversal action */}
      {tx.status === 'posted' && tx.type !== 'reversal' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Correct This Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Posted transactions are immutable. To correct an error, create a reversal that
              exactly offsets this transaction&apos;s effects.
            </p>
            <ReversalForm transactionId={tx.id} />
          </CardContent>
        </Card>
      )}

      <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs">{LEGAL_DISCLAIMER}</AlertDescription>
      </Alert>
    </div>
  )
}
