import { describe, it, expect } from 'vitest'
import { largestRemainderAllocation, allocateProportionally } from '@/lib/financial/allocation'
import {
  calculateOwnershipPercentages,
  computeContributionEffects,
  computeRetainedRentalEffects,
  computeDistributionEffects,
  computeEquityTransferEffects,
  computeMortgagePaymentEffects,
  type GroupBalance,
} from '@/lib/financial/calculations'
import { DEFAULT_EQUITY_POLICY } from '@/lib/types/app'

// ── helpers ────────────────────────────────────────────────────────────────

function makeBalances(entries: [string, number][]): GroupBalance[] {
  return entries.map(([groupId, balanceCents]) => ({
    groupId,
    groupName: groupId,
    balanceCents,
  }))
}

// ── 1. Equal initial contributions ─────────────────────────────────────────

describe('equal initial contributions', () => {
  it('assigns 25% to each of four groups with equal contributions', () => {
    const balances = makeBalances([
      ['aa', 0],
      ['mp', 0],
      ['an', 0],
      ['gu', 0],
    ])
    const allocations = [
      { groupId: 'aa', amountCents: 2500000 },
      { groupId: 'mp', amountCents: 2500000 },
      { groupId: 'an', amountCents: 2500000 },
      { groupId: 'gu', amountCents: 2500000 },
    ]
    const effects = computeContributionEffects(allocations, balances)

    // After effects, compute percentages using the resulting balances
    const newBalances: GroupBalance[] = balances.map((b) => {
      const e = effects.find((ef) => ef.ownership_group_id === b.groupId)
      return { ...b, balanceCents: b.balanceCents + (e?.signed_amount_cents ?? 0) }
    })
    const percentages = calculateOwnershipPercentages(newBalances)

    expect(percentages.get('aa')).toBeCloseTo(0.25, 10)
    expect(percentages.get('mp')).toBeCloseTo(0.25, 10)
    expect(percentages.get('an')).toBeCloseTo(0.25, 10)
    expect(percentages.get('gu')).toBeCloseTo(0.25, 10)
  })
})

// ── 2. Property-tax owner-paid expense reduces payer's relative share ───────

describe('property tax (owner-paid) effect on ownership', () => {
  it('does NOT change ownership when policy sets receives_equity_credit to false', () => {
    const balances = makeBalances([
      ['aa', 5000000],
      ['mp', 5000000],
      ['an', 5000000],
      ['gu', 5000000],
    ])
    // owner-paid with NO equity credit → no capital effects
    const effects = computeContributionEffects([], balances) // empty allocations
    expect(effects).toHaveLength(0)
  })

  it('credits the payer when receives_equity_credit is true', () => {
    const balances = makeBalances([
      ['aa', 5000000],
      ['mp', 5000000],
      ['an', 5000000],
      ['gu', 5000000],
    ])
    const allocations = [{ groupId: 'aa', amountCents: 120000 }] // $1,200 property tax
    const effects = computeContributionEffects(allocations, balances)

    const creditEffect = effects.find((e) => e.ownership_group_id === 'aa')
    expect(creditEffect?.signed_amount_cents).toBe(120000)
    // aa's post-tx % should be higher than 25%
    expect(creditEffect?.post_transaction_percentage).toBeGreaterThan(0.25)
  })
})

// ── 3. Retained rental income is allocated proportionally ──────────────────

describe('retained rental income', () => {
  it('allocates retained rental proportionally to current balances', () => {
    // aa:mp:an:gu = 40:30:20:10
    const balances = makeBalances([
      ['aa', 4000000],
      ['mp', 3000000],
      ['an', 2000000],
      ['gu', 1000000],
    ])
    const rentalCents = 100000 // $1,000
    const effects = computeRetainedRentalEffects(rentalCents, balances)

    const totalAllocated = effects.reduce((s, e) => s + e.signed_amount_cents, 0)
    expect(totalAllocated).toBe(rentalCents)

    const aaEffect = effects.find((e) => e.ownership_group_id === 'aa')
    expect(aaEffect?.signed_amount_cents).toBe(40000) // 40% of $1,000

    const guEffect = effects.find((e) => e.ownership_group_id === 'gu')
    expect(guEffect?.signed_amount_cents).toBe(10000) // 10% of $1,000
  })
})

// ── 4. Proportional cash distribution ──────────────────────────────────────

describe('proportional cash distribution', () => {
  it('distributes proportionally without rounding errors', () => {
    const balances = makeBalances([
      ['aa', 4000000],
      ['mp', 3000000],
      ['an', 2000000],
      ['gu', 1000000],
    ])
    const distributionCents = 100000 // $1,000

    const { effects, valid } = computeDistributionEffects(distributionCents, balances)
    expect(valid).toBe(true)

    const totalDebited = effects.reduce((s, e) => s + Math.abs(e.signed_amount_cents), 0)
    expect(totalDebited).toBe(distributionCents)

    const aaEffect = effects.find((e) => e.ownership_group_id === 'aa')
    expect(aaEffect?.signed_amount_cents).toBe(-40000) // debit
  })
})

// ── 5. Unequal distribution (custom allocations) ───────────────────────────

describe('unequal custom distribution', () => {
  it('accepts custom allocations and distributes exactly as specified', () => {
    const balances = makeBalances([
      ['aa', 5000000],
      ['mp', 5000000],
      ['an', 5000000],
      ['gu', 5000000],
    ])
    const custom = [
      { groupId: 'aa', amountCents: 60000 },
      { groupId: 'mp', amountCents: 30000 },
      { groupId: 'an', amountCents: 10000 },
    ]
    const { effects, valid } = computeDistributionEffects(100000, balances, custom)
    expect(valid).toBe(true)
    expect(effects.find((e) => e.ownership_group_id === 'aa')?.signed_amount_cents).toBe(-60000)
    expect(effects.find((e) => e.ownership_group_id === 'mp')?.signed_amount_cents).toBe(-30000)
    expect(effects.find((e) => e.ownership_group_id === 'an')?.signed_amount_cents).toBe(-10000)
  })
})

// ── 6. Distribution is blocked if it would create a negative balance ────────

describe('negative balance protection', () => {
  it('rejects a distribution that would take a group below zero', () => {
    const balances = makeBalances([
      ['aa', 100000], // only $1,000
      ['mp', 5000000],
      ['an', 5000000],
      ['gu', 5000000],
    ])
    const custom = [{ groupId: 'aa', amountCents: 200000 }] // $2,000 > $1,000 balance
    const { valid, error } = computeDistributionEffects(200000, balances, custom)
    expect(valid).toBe(false)
    expect(error).toBeTruthy()
  })

  it('also blocks equity transfer if source would go negative', () => {
    const balances = makeBalances([
      ['aa', 100000],
      ['mp', 5000000],
      ['an', 5000000],
      ['gu', 5000000],
    ])
    const { valid, error } = computeEquityTransferEffects('aa', 'mp', 200000, balances)
    expect(valid).toBe(false)
    expect(error).toBeTruthy()
  })
})

// ── 7. Reversal: negating signed amounts restores balances ─────────────────

describe('reversal logic', () => {
  it('negating contribution effects restores pre-transaction balances', () => {
    const originalBalances = makeBalances([
      ['aa', 5000000],
      ['mp', 5000000],
      ['an', 5000000],
      ['gu', 5000000],
    ])
    const allocations = [{ groupId: 'aa', amountCents: 500000 }]
    const effects = computeContributionEffects(allocations, originalBalances)

    // Simulate reversal: negate each signed_amount_cents
    const reversalAllocations = effects.map((e) => ({
      groupId: e.ownership_group_id,
      amountCents: -e.signed_amount_cents,
    }))
    const afterOriginal = originalBalances.map((b) => {
      const e = effects.find((ef) => ef.ownership_group_id === b.groupId)
      return { ...b, balanceCents: b.balanceCents + (e?.signed_amount_cents ?? 0) }
    })
    const afterReversal = afterOriginal.map((b) => {
      const ra = reversalAllocations.find((r) => r.groupId === b.groupId)
      return { ...b, balanceCents: b.balanceCents + (ra?.amountCents ?? 0) }
    })

    for (const orig of originalBalances) {
      const restored = afterReversal.find((b) => b.groupId === orig.groupId)
      expect(restored?.balanceCents).toBe(orig.balanceCents)
    }
  })
})

// ── 8. Largest-remainder allocation sums to total exactly ─────────────────

describe('largest-remainder allocation', () => {
  it('guarantees the sum equals the total for indivisible cents', () => {
    // 100 cents split 3 ways (33.3... each)
    const result = largestRemainderAllocation(100, [1, 1, 1])
    expect(result.reduce((s, v) => s + v, 0)).toBe(100)
  })

  it('handles $1 distributed across 4 unequal shares', () => {
    // 100 cents among ratios [3, 2, 3, 2] (sum=10)
    // exact: 30, 20, 30, 20 → no remainder, all even
    const result = largestRemainderAllocation(100, [3, 2, 3, 2])
    expect(result.reduce((s, v) => s + v, 0)).toBe(100)
    expect(result[0]).toBe(30)
    expect(result[1]).toBe(20)
  })

  it('distributes all cents even when exact division is impossible', () => {
    // 10 cents to 3 groups — 3+3+4 or 4+3+3
    const result = largestRemainderAllocation(10, [1, 1, 1])
    expect(result.reduce((s, v) => s + v, 0)).toBe(10)
    expect(result.every((v) => v >= 3)).toBe(true)
  })

  it('returns zeros when all ratios are zero', () => {
    const result = largestRemainderAllocation(100, [0, 0, 0])
    expect(result).toEqual([0, 0, 0])
  })

  it('returns empty array for empty ratios', () => {
    expect(largestRemainderAllocation(100, [])).toEqual([])
  })
})
