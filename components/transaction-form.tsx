'use client'

import { useState, useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Loader2, Info, AlertTriangle, ArrowLeft } from 'lucide-react'
import {
  formatCentsAsCurrency,
  formatPercentage,
  parseCurrencyInput,
  calculateOwnershipPercentages,
  computeContributionEffects,
  computeOwnerPaidExpenseEffects,
  computeMortgagePaymentEffects,
  computeRetainedRentalEffects,
  computeDistributionEffects,
  computeEquityTransferEffects,
} from '@/lib/financial/calculations'
import {
  postContribution,
  postOwnerPaidExpense,
  postPropertyCashExpense,
  postMortgagePayment,
  postRentalIncome,
  postCashDistribution,
  postEquityTransfer,
  postManualAdjustment,
  postReversal,
  type TransactionActionState,
} from '@/app/actions/transactions'
import {
  TRANSACTION_TYPE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  DEFAULT_EQUITY_POLICY,
  type EquityPolicy,
} from '@/lib/types/app'
import type { TransactionType, ExpenseCategory } from '@/lib/types/database'
import Link from 'next/link'

interface Group {
  id: string
  name: string
  display_order: number
}

interface BalanceRow {
  ownership_group_id: string
  ownership_group_name: string
  balance_cents: number
}

interface TransactionFormProps {
  groups: Group[]
  balances: BalanceRow[]
  policy: Record<string, unknown>
  defaultType?: string
}

const TRANSACTION_TYPES: TransactionType[] = [
  'initial_contribution',
  'additional_contribution',
  'owner_paid_expense',
  'property_cash_expense',
  'capital_improvement',
  'mortgage_payment',
  'rental_income',
  'cash_distribution',
  'reimbursement',
  'equity_transfer',
  'manual_adjustment',
]

const EXPENSE_CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]

const initialState: TransactionActionState = {}

function AllocationEditor({
  groups,
  totalCents,
  allocations,
  onChange,
}: {
  groups: Group[]
  totalCents: number
  allocations: Array<{ groupId: string; amountCents: number }>
  onChange: (allocs: Array<{ groupId: string; amountCents: number }>) => void
}) {
  const allocationTotal = allocations.reduce((s, a) => s + a.amountCents, 0)
  const remaining = totalCents - allocationTotal

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const alloc = allocations.find((a) => a.groupId === group.id)
        const dollars = alloc ? (alloc.amountCents / 100).toFixed(2) : '0.00'

        return (
          <div key={group.id} className="flex items-center gap-3">
            <span className="text-sm w-36 shrink-0">{group.name}</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                className="pl-7"
                type="text"
                value={dollars}
                onChange={(e) => {
                  const cents = parseCurrencyInput(e.target.value)
                  const newAllocs = allocations.filter((a) => a.groupId !== group.id)
                  if (cents > 0) newAllocs.push({ groupId: group.id, amountCents: cents })
                  onChange(newAllocs)
                }}
              />
            </div>
          </div>
        )
      })}
      <div className={`text-sm flex justify-between pt-1 ${remaining !== 0 ? 'text-red-600' : 'text-green-600'}`}>
        <span>Remaining to allocate:</span>
        <span>{formatCentsAsCurrency(remaining)}</span>
      </div>
    </div>
  )
}

export function TransactionForm({ groups, balances, policy, defaultType }: TransactionFormProps) {
  const router = useRouter()
  const [type, setType] = useState<TransactionType>(
    (defaultType as TransactionType) ?? 'initial_contribution'
  )
  const [amountCents, setAmountCents] = useState(0)
  const [allocations, setAllocations] = useState<Array<{ groupId: string; amountCents: number }>>([])
  const [receivesEquityCredit, setReceivesEquityCredit] = useState(true)
  const [retainIncome, setRetainIncome] = useState(true)
  const [fundsDeposited, setFundsDeposited] = useState(true)
  const [principalCents, setPrincipalCents] = useState(0)
  const [interestCents, setInterestCents] = useState(0)
  const [escrowCents, setEscrowCents] = useState(0)
  const [payerGroupId, setPayerGroupId] = useState(groups[0]?.id ?? '')
  const [sourceGroupId, setSourceGroupId] = useState(groups[0]?.id ?? '')
  const [destinationGroupId, setDestinationGroupId] = useState(groups[1]?.id ?? '')
  const [confirmedNegative, setConfirmedNegative] = useState(false)

  const equityPolicy: EquityPolicy = { ...DEFAULT_EQUITY_POLICY, ...(policy as Partial<EquityPolicy>) }
  const balanceMaps = balances.map((b) => ({
    groupId: b.ownership_group_id,
    groupName: b.ownership_group_name,
    balanceCents: b.balance_cents,
  }))
  const totalCapital = balanceMaps.reduce((s, b) => s + b.balanceCents, 0)

  // Select the correct server action
  const serverAction =
    type === 'initial_contribution' || type === 'additional_contribution'
      ? postContribution
      : type === 'owner_paid_expense' || type === 'capital_improvement'
      ? postOwnerPaidExpense
      : type === 'property_cash_expense'
      ? postPropertyCashExpense
      : type === 'mortgage_payment'
      ? postMortgagePayment
      : type === 'rental_income'
      ? postRentalIncome
      : type === 'cash_distribution'
      ? postCashDistribution
      : type === 'equity_transfer'
      ? postEquityTransfer
      : type === 'manual_adjustment'
      ? postManualAdjustment
      : postReversal

  const [state, action, isPending] = useActionState(serverAction, initialState)

  useEffect(() => {
    if (state.success && state.transactionId) {
      toast.success('Transaction posted successfully.')
      router.push(`/transactions/${state.transactionId}`)
    }
  }, [state.success, state.transactionId, router])

  // Compute preview effects
  const previewEffects = (() => {
    if (!amountCents) return []
    try {
      if (type === 'initial_contribution' || type === 'additional_contribution') {
        return computeContributionEffects(
          allocations.map((a) => ({ groupId: a.groupId, amountCents: a.amountCents })),
          balanceMaps
        )
      }
      if (type === 'owner_paid_expense') {
        return computeOwnerPaidExpenseEffects(
          allocations.map((a) => ({ groupId: a.groupId, amountCents: a.amountCents })),
          receivesEquityCredit,
          balanceMaps
        )
      }
      if (type === 'mortgage_payment' && payerGroupId) {
        return computeMortgagePaymentEffects(
          payerGroupId,
          { principal_cents: principalCents, interest_cents: interestCents, escrow_cents: escrowCents },
          equityPolicy,
          balanceMaps
        )
      }
      if (type === 'rental_income' && retainIncome) {
        return computeRetainedRentalEffects(amountCents, balanceMaps)
      }
      if (type === 'cash_distribution') {
        return computeDistributionEffects(amountCents, balanceMaps).effects
      }
      if (type === 'equity_transfer' && sourceGroupId && destinationGroupId) {
        return computeEquityTransferEffects(sourceGroupId, destinationGroupId, amountCents, balanceMaps).effects
      }
    } catch {
      return []
    }
    return []
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/transactions">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Transaction</h1>
          <p className="text-sm text-muted-foreground">Post a new financial event to the ledger.</p>
        </div>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={action} className="space-y-6">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="amount_cents" value={amountCents} />
        <input type="hidden" name="allocations" value={JSON.stringify(allocations.map(a => ({ ownership_group_id: a.groupId, amount_cents: a.amountCents })))} />
        {type === 'rental_income' && (
          <input type="hidden" name="retain_income" value={retainIncome ? 'true' : 'false'} />
        )}
        {type === 'owner_paid_expense' && (
          <input type="hidden" name="receives_equity_credit" value={receivesEquityCredit ? 'true' : 'false'} />
        )}
        {(type === 'initial_contribution' || type === 'additional_contribution') && (
          <input type="hidden" name="funds_deposited_to_property" value={fundsDeposited ? 'true' : 'false'} />
        )}
        {type === 'mortgage_payment' && (
          <>
            <input type="hidden" name="principal_cents" value={principalCents} />
            <input type="hidden" name="interest_cents" value={interestCents} />
            <input type="hidden" name="escrow_cents" value={escrowCents} />
            <input type="hidden" name="payer_group_id" value={payerGroupId} />
          </>
        )}
        {type === 'equity_transfer' && (
          <>
            <input type="hidden" name="source_group_id" value={sourceGroupId} />
            <input type="hidden" name="destination_group_id" value={destinationGroupId} />
          </>
        )}
        {type === 'manual_adjustment' && (
          <input type="hidden" name="confirmed_negative_balance" value={confirmedNegative ? 'true' : 'false'} />
        )}

        {/* Transaction Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaction Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSACTION_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Basic Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaction Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effective_date">Effective Date *</Label>
                <Input
                  id="effective_date"
                  name="effective_date"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="amount"
                    className="pl-7"
                    type="text"
                    placeholder="0.00"
                    onChange={(e) => setAmountCents(parseCurrencyInput(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input id="description" name="description" placeholder="Brief description" required />
            </div>

            {/* Expense category for applicable types */}
            {(type === 'owner_paid_expense' ||
              type === 'property_cash_expense' ||
              type === 'capital_improvement') && (
              <div className="space-y-2">
                <Label>Expense Category *</Label>
                <Select name="expense_category" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Counterparty */}
            <div className="space-y-2">
              <Label htmlFor="counterparty_reference">
                {type === 'mortgage_payment'
                  ? 'Lender'
                  : type === 'rental_income'
                  ? 'Tenant / Reference'
                  : type === 'equity_transfer'
                  ? 'Transfer Reference'
                  : 'Vendor / Reference'}{' '}
                (optional)
              </Label>
              <Input id="counterparty_reference" name="counterparty_reference" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Mortgage breakdown */}
        {type === 'mortgage_payment' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Breakdown</CardTitle>
              <CardDescription>Principal + Interest + Escrow must equal the total amount.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Mortgage liability is not allocated by this application.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Principal', value: principalCents, setter: setPrincipalCents },
                  { label: 'Interest', value: interestCents, setter: setInterestCents },
                  { label: 'Escrow', value: escrowCents, setter: setEscrowCents },
                ].map(({ label, value, setter }) => (
                  <div key={label} className="space-y-2">
                    <Label>{label}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        className="pl-7"
                        type="text"
                        defaultValue={(value / 100).toFixed(2)}
                        onChange={(e) => setter(parseCurrencyInput(e.target.value))}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-sm flex justify-between">
                <span className="text-muted-foreground">Breakdown total:</span>
                <span
                  className={
                    principalCents + interestCents + escrowCents === amountCents
                      ? 'text-green-600 font-medium'
                      : 'text-red-600 font-medium'
                  }
                >
                  {formatCentsAsCurrency(principalCents + interestCents + escrowCents)}
                </span>
              </div>

              <div className="space-y-2">
                <Label>Paying Group *</Label>
                <Select value={payerGroupId} onValueChange={(v) => setPayerGroupId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Equity transfer groups */}
        {type === 'equity_transfer' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transfer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Group (debit)</Label>
                  <Select value={sourceGroupId} onValueChange={(v) => setSourceGroupId(v ?? '')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Destination Group (credit)</Label>
                  <Select value={destinationGroupId} onValueChange={(v) => setDestinationGroupId(v ?? '')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer_reason">Transfer Reason *</Label>
                <Textarea
                  id="transfer_reason"
                  name="transfer_reason"
                  placeholder="Explain the agreed equity transfer..."
                  rows={2}
                  required
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual adjustment */}
        {type === 'manual_adjustment' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adjustment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Manual adjustments require a detailed explanation and are permanently recorded in the audit log.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Ownership Group *</Label>
                <Select name="ownership_group_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signed_amount_cents">
                  Signed Amount (negative to debit) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="signed_amount_cents"
                    name="signed_amount_cents"
                    className="pl-7"
                    type="number"
                    placeholder="e.g. 1000 or -500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustment_explanation">Explanation (required) *</Label>
                <Textarea
                  id="adjustment_explanation"
                  name="adjustment_explanation"
                  rows={3}
                  placeholder="Provide a detailed explanation for this adjustment..."
                  minLength={20}
                  required
                />
              </div>
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="confirmed_negative"
                  checked={confirmedNegative}
                  onChange={(e) => setConfirmedNegative(e.target.checked)}
                  className="mt-1"
                />
                <Label htmlFor="confirmed_negative" className="text-sm cursor-pointer">
                  I understand this adjustment may create a negative capital balance and confirm this is intentional.
                </Label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Allocation editor (for contribution/expense) */}
        {(type === 'initial_contribution' ||
          type === 'additional_contribution' ||
          type === 'owner_paid_expense' ||
          type === 'capital_improvement') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Allocation</CardTitle>
              <CardDescription>
                Assign the{' '}
                {type === 'initial_contribution' || type === 'additional_contribution'
                  ? 'contribution'
                  : 'payment'}{' '}
                to one or more ownership groups.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {type === 'owner_paid_expense' && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Receives equity credit</Label>
                    <p className="text-xs text-muted-foreground">Credit the paying group's capital account.</p>
                  </div>
                  <Switch
                    checked={receivesEquityCredit}
                    onCheckedChange={setReceivesEquityCredit}
                  />
                </div>
              )}
              {(type === 'initial_contribution' || type === 'additional_contribution') && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Funds deposited to property account</Label>
                    <p className="text-xs text-muted-foreground">Affects property cash-pool balance.</p>
                  </div>
                  <Switch
                    checked={fundsDeposited}
                    onCheckedChange={setFundsDeposited}
                  />
                </div>
              )}
              <AllocationEditor
                groups={groups}
                totalCents={amountCents}
                allocations={allocations}
                onChange={setAllocations}
              />
            </CardContent>
          </Card>
        )}

        {/* Rental income options */}
        {type === 'rental_income' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rental Income Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rental_period_start">Period Start</Label>
                  <Input id="rental_period_start" name="rental_period_start" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rental_period_end">Period End</Label>
                  <Input id="rental_period_end" name="rental_period_end" type="date" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Retain / reinvest income</Label>
                  <p className="text-xs text-muted-foreground">
                    Retained income credits ownership groups proportionally. Distributed income debits recipients.
                  </p>
                </div>
                <Switch checked={retainIncome} onCheckedChange={setRetainIncome} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live preview */}
        {previewEffects.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                Capital Account Preview
              </CardTitle>
              <CardDescription>Projected effects if posted now. Subject to final validation.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {previewEffects.map((effect) => {
                  const group = groups.find((g) => g.id === effect.ownership_group_id)
                  return (
                    <div key={effect.ownership_group_id} className="flex justify-between text-sm">
                      <span>{group?.name ?? effect.ownership_group_id}</span>
                      <div className="flex items-center gap-4">
                        <span className={effect.signed_amount_cents > 0 ? 'text-green-600' : 'text-red-600'}>
                          {effect.signed_amount_cents > 0 ? '+' : ''}
                          {formatCentsAsCurrency(effect.signed_amount_cents)}
                        </span>
                        {effect.post_transaction_percentage !== null && (
                          <span className="text-muted-foreground w-16 text-right">
                            → {formatPercentage(effect.post_transaction_percentage)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/transactions">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Post Transaction
          </Button>
        </div>
      </form>
    </div>
  )
}
