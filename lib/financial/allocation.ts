/**
 * Largest-remainder (Hamilton) algorithm for allocating integer amounts
 * proportionally without rounding errors. Guarantees the sum of all
 * allocated amounts equals exactly the total.
 */
export function largestRemainderAllocation(
  totalCents: number,
  ratios: number[]
): number[] {
  if (ratios.length === 0) return []
  const sum = ratios.reduce((a, b) => a + b, 0)
  if (sum === 0) {
    return ratios.map(() => 0)
  }

  const exactValues = ratios.map((r) => (r / sum) * totalCents)
  const floors = exactValues.map(Math.floor)
  const remainders = exactValues.map((v, i) => v - floors[i])

  const remaining = totalCents - floors.reduce((a, b) => a + b, 0)

  const indexed = remainders
    .map((r, i) => ({ remainder: r, index: i }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  const result = [...floors]
  for (let i = 0; i < remaining; i++) {
    result[indexed[i].index] += 1
  }

  return result
}

/**
 * Allocate totalCents proportionally to ownership groups using current balances.
 * Returns an array of { groupId, amountCents } in the same order as groupBalances.
 */
export function allocateProportionally(
  totalCents: number,
  groupBalances: Array<{ groupId: string; balanceCents: number }>
): Array<{ groupId: string; amountCents: number }> {
  const ratios = groupBalances.map((g) => g.balanceCents)
  const amounts = largestRemainderAllocation(totalCents, ratios)
  return groupBalances.map((g, i) => ({
    groupId: g.groupId,
    amountCents: amounts[i],
  }))
}
