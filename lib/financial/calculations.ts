import { largestRemainderAllocation, allocateProportionally } from './allocation'
import type {
  EquityPolicy,
  OwnershipGroup,
  TransactionAllocation,
  CapitalEffect,
  MortgagePaymentBreakdown,
} from '@/lib/types/app'
import type { TransactionType, ExpenseCategory } from '@/lib/types/database'

export { largestRemainderAllocation, allocateProportionally }

export interface GroupBalance {
  groupId: string
  groupName: string
  balanceCents: number
}

export function calculateOwnershipPercentages(
  balances: GroupBalance[]
): Map<string, number> {
  const activeBalances = balances.filter((b) => b.balanceCents > 0)
  const total = balances.reduce((sum, b) => sum + b.balanceCents, 0)
  const result = new Map<string, number>()
  for (const b of balances) {
    result.set(b.groupId, total > 0 ? b.balanceCents / total : 0)
  }
  return result
}

export function formatCentsAsCurrency(cents: number): string {
  const abs = Math.abs(cents)
  const dollars = abs / 100
  const formatted = dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return cents < 0 ? `-${formatted}` : formatted
}

export function formatPercentage(ratio: number, decimals = 2): string {
  return (ratio * 100).toFixed(decimals) + '%'
}

export function parseCurrencyInput(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, '')
  const dollars = parseFloat(cleaned)
  if (isNaN(dollars)) return 0
  return Math.round(dollars * 100)
}

/**
 * Given current group balances and a set of capital changes, compute
 * new percentages. Used for live preview before posting.
 */
export function computeOwnershipAfterEffects(
  currentBalances: GroupBalance[],
  effects: Array<{ groupId: string; signedAmountCents: number }>
): Map<string, number> {
  const newBalances = currentBalances.map((b) => {
    const effect = effects.find((e) => e.groupId === b.groupId)
    return {
      ...b,
      balanceCents: b.balanceCents + (effect?.signedAmountCents ?? 0),
    }
  })
  return calculateOwnershipPercentages(newBalances)
}

export function validateAllocationTotal(
  allocations: Array<{ amountCents: number }>,
  totalCents: number
): boolean {
  const sum = allocations.reduce((s, a) => s + a.amountCents, 0)
  return sum === totalCents
}

export function computeContributionEffects(
  allocations: Array<{ groupId: string; amountCents: number }>,
  currentBalances: GroupBalance[]
): CapitalEffect[] {
  const prePercentages = calculateOwnershipPercentages(currentBalances)

  const changedBalances = currentBalances.map((b) => {
    const alloc = allocations.find((a) => a.groupId === b.groupId)
    return {
      ...b,
      balanceCents: b.balanceCents + (alloc?.amountCents ?? 0),
    }
  })
  const postPercentages = calculateOwnershipPercentages(changedBalances)

  return allocations.map((alloc) => ({
    ownership_group_id: alloc.groupId,
    signed_amount_cents: alloc.amountCents,
    entry_type: 'contribution_credit',
    policy_rationale: 'Contribution credited to contributing group',
    pre_transaction_percentage: prePercentages.get(alloc.groupId) ?? null,
    post_transaction_percentage: postPercentages.get(alloc.groupId) ?? null,
  }))
}

export function computeOwnerPaidExpenseEffects(
  allocations: Array<{ groupId: string; amountCents: number }>,
  receivesEquityCredit: boolean,
  currentBalances: GroupBalance[]
): CapitalEffect[] {
  if (!receivesEquityCredit) return []

  return computeContributionEffects(allocations, currentBalances).map((e) => ({
    ...e,
    entry_type: 'expense_credit',
    policy_rationale: 'Owner-paid expense credited to paying group per equity policy',
  }))
}

export function computeMortgagePaymentEffects(
  payerGroupId: string,
  breakdown: MortgagePaymentBreakdown,
  policy: EquityPolicy,
  currentBalances: GroupBalance[]
): CapitalEffect[] {
  const effects: Array<{ groupId: string; amountCents: number; rationale: string }> = []

  if (breakdown.principal_cents > 0) {
    effects.push({
      groupId: payerGroupId,
      amountCents: breakdown.principal_cents,
      rationale: 'Mortgage principal credited to paying group',
    })
  }

  if (breakdown.interest_cents > 0 && policy.mortgage_interest_credits_payer) {
    effects.push({
      groupId: payerGroupId,
      amountCents: breakdown.interest_cents,
      rationale: 'Mortgage interest credited to paying group per equity policy',
    })
  }

  if (breakdown.escrow_cents > 0 && policy.mortgage_escrow_credits_payer) {
    effects.push({
      groupId: payerGroupId,
      amountCents: breakdown.escrow_cents,
      rationale: 'Mortgage escrow credited to paying group per equity policy',
    })
  }

  if (effects.length === 0) return []

  const allAllocs = effects.map((e) => ({ groupId: e.groupId, amountCents: e.amountCents }))
  const mergedByGroup = new Map<string, number>()
  for (const a of allAllocs) {
    mergedByGroup.set(a.groupId, (mergedByGroup.get(a.groupId) ?? 0) + a.amountCents)
  }

  const prePercentages = calculateOwnershipPercentages(currentBalances)
  const newBalances = currentBalances.map((b) => ({
    ...b,
    balanceCents: b.balanceCents + (mergedByGroup.get(b.groupId) ?? 0),
  }))
  const postPercentages = calculateOwnershipPercentages(newBalances)

  return effects.map((e) => ({
    ownership_group_id: e.groupId,
    signed_amount_cents: e.amountCents,
    entry_type: 'mortgage_credit',
    policy_rationale: e.rationale,
    pre_transaction_percentage: prePercentages.get(e.groupId) ?? null,
    post_transaction_percentage: postPercentages.get(e.groupId) ?? null,
  }))
}

export function computeRetainedRentalEffects(
  totalCents: number,
  currentBalances: GroupBalance[],
  customAllocations?: Array<{ groupId: string; amountCents: number }>
): CapitalEffect[] {
  const total = currentBalances.reduce((s, b) => s + b.balanceCents, 0)
  const allocs =
    customAllocations ??
    (total > 0
      ? allocateProportionally(
          totalCents,
          currentBalances.map((b) => ({ groupId: b.groupId, balanceCents: b.balanceCents }))
        ).map((a) => ({ groupId: a.groupId, amountCents: a.amountCents }))
      : currentBalances.map((_, i) => {
          const amounts = largestRemainderAllocation(
            totalCents,
            currentBalances.map(() => 1)
          )
          return { groupId: currentBalances[i].groupId, amountCents: amounts[i] }
        }))

  const prePercentages = calculateOwnershipPercentages(currentBalances)
  const newBalances = currentBalances.map((b) => {
    const alloc = allocs.find((a) => a.groupId === b.groupId)
    return { ...b, balanceCents: b.balanceCents + (alloc?.amountCents ?? 0) }
  })
  const postPercentages = calculateOwnershipPercentages(newBalances)

  return allocs
    .filter((a) => a.amountCents !== 0)
    .map((a) => ({
      ownership_group_id: a.groupId,
      signed_amount_cents: a.amountCents,
      entry_type: 'rental_income_credit',
      policy_rationale: 'Retained rental income allocated by ownership percentage',
      pre_transaction_percentage: prePercentages.get(a.groupId) ?? null,
      post_transaction_percentage: postPercentages.get(a.groupId) ?? null,
    }))
}

export function computeDistributionEffects(
  totalCents: number,
  currentBalances: GroupBalance[],
  customAllocations?: Array<{ groupId: string; amountCents: number }>
): { effects: CapitalEffect[]; valid: boolean; error?: string } {
  const total = currentBalances.reduce((s, b) => s + b.balanceCents, 0)
  const allocs =
    customAllocations ??
    (total > 0
      ? allocateProportionally(
          totalCents,
          currentBalances.map((b) => ({ groupId: b.groupId, balanceCents: b.balanceCents }))
        ).map((a) => ({ groupId: a.groupId, amountCents: a.amountCents }))
      : [])

  for (const alloc of allocs) {
    const balance = currentBalances.find((b) => b.groupId === alloc.groupId)
    if (balance && balance.balanceCents - alloc.amountCents < 0) {
      return {
        effects: [],
        valid: false,
        error: `Distribution would reduce ${balance.groupName}'s capital account below zero.`,
      }
    }
  }

  const prePercentages = calculateOwnershipPercentages(currentBalances)
  const newBalances = currentBalances.map((b) => {
    const alloc = allocs.find((a) => a.groupId === b.groupId)
    return { ...b, balanceCents: b.balanceCents - (alloc?.amountCents ?? 0) }
  })
  const postPercentages = calculateOwnershipPercentages(newBalances)

  return {
    effects: allocs
      .filter((a) => a.amountCents !== 0)
      .map((a) => ({
        ownership_group_id: a.groupId,
        signed_amount_cents: -a.amountCents,
        entry_type: 'distribution_debit',
        policy_rationale: 'Cash distribution debited from ownership group',
        pre_transaction_percentage: prePercentages.get(a.groupId) ?? null,
        post_transaction_percentage: postPercentages.get(a.groupId) ?? null,
      })),
    valid: true,
  }
}

export function computeEquityTransferEffects(
  sourceGroupId: string,
  destinationGroupId: string,
  amountCents: number,
  currentBalances: GroupBalance[]
): { effects: CapitalEffect[]; valid: boolean; error?: string } {
  const sourceBalance = currentBalances.find((b) => b.groupId === sourceGroupId)
  if (!sourceBalance || sourceBalance.balanceCents - amountCents < 0) {
    return {
      effects: [],
      valid: false,
      error: 'Transfer would reduce the source group capital account below zero.',
    }
  }

  const prePercentages = calculateOwnershipPercentages(currentBalances)
  const newBalances = currentBalances.map((b) => {
    if (b.groupId === sourceGroupId) return { ...b, balanceCents: b.balanceCents - amountCents }
    if (b.groupId === destinationGroupId) return { ...b, balanceCents: b.balanceCents + amountCents }
    return b
  })
  const postPercentages = calculateOwnershipPercentages(newBalances)

  return {
    effects: [
      {
        ownership_group_id: sourceGroupId,
        signed_amount_cents: -amountCents,
        entry_type: 'equity_transfer_debit',
        policy_rationale: 'Equity transfer – source group debited',
        pre_transaction_percentage: prePercentages.get(sourceGroupId) ?? null,
        post_transaction_percentage: postPercentages.get(sourceGroupId) ?? null,
      },
      {
        ownership_group_id: destinationGroupId,
        signed_amount_cents: amountCents,
        entry_type: 'equity_transfer_credit',
        policy_rationale: 'Equity transfer – destination group credited',
        pre_transaction_percentage: prePercentages.get(destinationGroupId) ?? null,
        post_transaction_percentage: postPercentages.get(destinationGroupId) ?? null,
      },
    ],
    valid: true,
  }
}
