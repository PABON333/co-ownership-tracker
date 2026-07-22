'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  calculateOwnershipPercentages,
  computeContributionEffects,
  computeOwnerPaidExpenseEffects,
  computeMortgagePaymentEffects,
  computeRetainedRentalEffects,
  computeDistributionEffects,
  computeEquityTransferEffects,
} from '@/lib/financial/calculations'
import type { EquityPolicy, CapitalEffect, TransactionAllocation } from '@/lib/types/app'
import type { Json, TransactionType, ExpenseCategory } from '@/lib/types/database'
import { DEFAULT_EQUITY_POLICY } from '@/lib/types/app'

export type TransactionActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  transactionId?: string
}

async function getWorkspaceAndBalances(userId: string) {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('profile_id', userId)
    .single()

  if (!membership) throw new Error('No workspace found.')

  const { data: balancesRaw } = await supabase.rpc('get_capital_balances', {
    p_workspace_id: membership.workspace_id,
  })

  const { data: policyRaw } = await supabase
    .from('equity_policy_versions')
    .select('policy_data')
    .eq('workspace_id', membership.workspace_id)
    .order('effective_at', { ascending: false })
    .limit(1)
    .single()

  const balances = (balancesRaw ?? []) as Array<{
    ownership_group_id: string
    ownership_group_name: string
    balance_cents: number
  }>

  const policy: EquityPolicy = (policyRaw?.policy_data as unknown as EquityPolicy) ?? DEFAULT_EQUITY_POLICY

  return {
    supabase,
    workspaceId: membership.workspace_id,
    balances: balances.map((b) => ({
      groupId: b.ownership_group_id,
      groupName: b.ownership_group_name,
      balanceCents: b.balance_cents,
    })),
    policy,
  }
}

async function callPostRpc(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  {
    workspaceId,
    actorId,
    type,
    effectiveDate,
    amountCents,
    description,
    notes,
    counterpartyReference,
    expenseCategory,
    propertyCashEffectCents,
    policySnapshot,
    allocations,
    capitalEffects,
  }: {
    workspaceId: string
    actorId: string
    type: TransactionType
    effectiveDate: string
    amountCents: number
    description: string
    notes?: string
    counterpartyReference?: string
    expenseCategory?: ExpenseCategory
    propertyCashEffectCents: number
    policySnapshot: EquityPolicy
    allocations: TransactionAllocation[]
    capitalEffects: CapitalEffect[]
  }
) {
  const { data, error } = await supabase.rpc('post_transaction', {
    p_workspace_id: workspaceId,
    p_actor_id: actorId,
    p_type: type,
    p_effective_date: effectiveDate,
    p_amount_cents: amountCents,
    p_description: description,
    p_notes: notes ?? null,
    p_counterparty_reference: counterpartyReference ?? null,
    p_expense_category: expenseCategory ?? null,
    p_property_cash_effect_cents: propertyCashEffectCents,
    p_policy_snapshot: policySnapshot as unknown as Json,
    p_allocations: allocations.map((a) => ({
      ownership_group_id: a.ownership_group_id,
      amount_cents: a.amount_cents,
      allocation_role: a.allocation_role,
    })),
    p_capital_effects: capitalEffects.map((e) => ({
      ownership_group_id: e.ownership_group_id,
      signed_amount_cents: e.signed_amount_cents,
      entry_type: e.entry_type,
      policy_rationale: e.policy_rationale,
      pre_transaction_percentage: e.pre_transaction_percentage,
      post_transaction_percentage: e.post_transaction_percentage,
    })),
  })

  if (error) throw new Error(error.message)
  return (data as { transaction_id: string }).transaction_id
}

export async function postContribution(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated.' }

    const { workspaceId, balances, policy } = await getWorkspaceAndBalances(user.id)

    const type = formData.get('type') as 'initial_contribution' | 'additional_contribution'
    const amountCents = parseInt(formData.get('amount_cents') as string)
    const effectiveDate = formData.get('effective_date') as string
    const description = formData.get('description') as string
    const notes = (formData.get('notes') as string) || undefined
    const counterpartyReference = (formData.get('counterparty_reference') as string) || undefined
    const fundsDeposited = formData.get('funds_deposited_to_property') !== 'false'

    const allocationsJson = formData.get('allocations') as string
    const rawAllocations: Array<{ ownership_group_id: string; amount_cents: number }> =
      JSON.parse(allocationsJson)

    const allocationTotal = rawAllocations.reduce((s, a) => s + a.amount_cents, 0)
    if (allocationTotal !== amountCents) {
      return { error: `Allocation total (${allocationTotal}) must equal transaction amount (${amountCents}).` }
    }

    const allocations: TransactionAllocation[] = rawAllocations.map((a) => ({
      ownership_group_id: a.ownership_group_id,
      amount_cents: a.amount_cents,
      allocation_role: 'contributor',
    }))

    const capitalEffects = computeContributionEffects(
      rawAllocations.map((a) => ({ groupId: a.ownership_group_id, amountCents: a.amount_cents })),
      balances
    )

    const txId = await callPostRpc(supabase, {
      workspaceId,
      actorId: user.id,
      type,
      effectiveDate,
      amountCents,
      description,
      notes,
      counterpartyReference,
      propertyCashEffectCents: fundsDeposited ? amountCents : 0,
      policySnapshot: policy,
      allocations,
      capitalEffects,
    })

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/ownership')
    return { success: true, transactionId: txId }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function postOwnerPaidExpense(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated.' }

    const { workspaceId, balances, policy } = await getWorkspaceAndBalances(user.id)

    const amountCents = parseInt(formData.get('amount_cents') as string)
    const effectiveDate = formData.get('effective_date') as string
    const description = formData.get('description') as string
    const notes = (formData.get('notes') as string) || undefined
    const counterpartyReference = (formData.get('counterparty_reference') as string) || undefined
    const expenseCategory = formData.get('expense_category') as ExpenseCategory
    const receivesEquityCredit = formData.get('receives_equity_credit') === 'true'

    const allocationsJson = formData.get('allocations') as string
    const rawAllocations: Array<{ ownership_group_id: string; amount_cents: number }> =
      JSON.parse(allocationsJson)

    const allocationTotal = rawAllocations.reduce((s, a) => s + a.amount_cents, 0)
    if (allocationTotal !== amountCents) {
      return { error: `Allocation total must equal transaction amount.` }
    }

    const allocations: TransactionAllocation[] = rawAllocations.map((a) => ({
      ownership_group_id: a.ownership_group_id,
      amount_cents: a.amount_cents,
      allocation_role: 'payer',
    }))

    const capitalEffects = computeOwnerPaidExpenseEffects(
      rawAllocations.map((a) => ({ groupId: a.ownership_group_id, amountCents: a.amount_cents })),
      receivesEquityCredit,
      balances
    )

    const txId = await callPostRpc(supabase, {
      workspaceId,
      actorId: user.id,
      type: 'owner_paid_expense',
      effectiveDate,
      amountCents,
      description,
      notes,
      counterpartyReference,
      expenseCategory,
      propertyCashEffectCents: 0,
      policySnapshot: policy,
      allocations,
      capitalEffects,
    })

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    return { success: true, transactionId: txId }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function postPropertyCashExpense(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated.' }

    const { workspaceId, policy } = await getWorkspaceAndBalances(user.id)

    const amountCents = parseInt(formData.get('amount_cents') as string)
    const effectiveDate = formData.get('effective_date') as string
    const description = formData.get('description') as string
    const notes = (formData.get('notes') as string) || undefined
    const counterpartyReference = (formData.get('counterparty_reference') as string) || undefined
    const expenseCategory = formData.get('expense_category') as ExpenseCategory

    const txId = await callPostRpc(supabase, {
      workspaceId,
      actorId: user.id,
      type: 'property_cash_expense',
      effectiveDate,
      amountCents,
      description,
      notes,
      counterpartyReference,
      expenseCategory,
      propertyCashEffectCents: -amountCents,
      policySnapshot: policy,
      allocations: [],
      capitalEffects: [],
    })

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    return { success: true, transactionId: txId }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function postMortgagePayment(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated.' }

    const { workspaceId, balances, policy } = await getWorkspaceAndBalances(user.id)

    const amountCents = parseInt(formData.get('amount_cents') as string)
    const principalCents = parseInt(formData.get('principal_cents') as string) || 0
    const interestCents = parseInt(formData.get('interest_cents') as string) || 0
    const escrowCents = parseInt(formData.get('escrow_cents') as string) || 0

    if (principalCents + interestCents + escrowCents !== amountCents) {
      return {
        error: `Principal + Interest + Escrow must equal total payment amount. Got ${principalCents + interestCents + escrowCents}, expected ${amountCents}.`,
      }
    }

    const effectiveDate = formData.get('effective_date') as string
    const description = formData.get('description') as string
    const notes = (formData.get('notes') as string) || undefined
    const payerGroupId = formData.get('payer_group_id') as string

    const allocations: TransactionAllocation[] = [
      { ownership_group_id: payerGroupId, amount_cents: amountCents, allocation_role: 'payer' },
    ]

    const capitalEffects = computeMortgagePaymentEffects(
      payerGroupId,
      { principal_cents: principalCents, interest_cents: interestCents, escrow_cents: escrowCents },
      policy,
      balances
    )

    const txId = await callPostRpc(supabase, {
      workspaceId,
      actorId: user.id,
      type: 'mortgage_payment',
      effectiveDate,
      amountCents,
      description,
      notes,
      propertyCashEffectCents: -amountCents,
      policySnapshot: policy,
      allocations,
      capitalEffects,
    })

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    return { success: true, transactionId: txId }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function postRentalIncome(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated.' }

    const { workspaceId, balances, policy } = await getWorkspaceAndBalances(user.id)

    const amountCents = parseInt(formData.get('amount_cents') as string)
    const effectiveDate = formData.get('effective_date') as string
    const description = formData.get('description') as string
    const notes = (formData.get('notes') as string) || undefined
    const counterpartyReference = (formData.get('counterparty_reference') as string) || undefined
    const retainIncome = formData.get('retain_income') !== 'false'

    let capitalEffects: CapitalEffect[] = []
    let propertyCashEffect = amountCents

    if (retainIncome) {
      const customAllocJson = formData.get('custom_allocations') as string
      const customAllocs = customAllocJson
        ? (JSON.parse(customAllocJson) as Array<{ groupId: string; amountCents: number }>)
        : undefined

      capitalEffects = computeRetainedRentalEffects(amountCents, balances, customAllocs)
    } else {
      // Distribution – debit recipients
      const customAllocJson = formData.get('custom_allocations') as string
      const customAllocs = customAllocJson
        ? (JSON.parse(customAllocJson) as Array<{ groupId: string; amountCents: number }>)
        : undefined

      const result = computeDistributionEffects(amountCents, balances, customAllocs)
      if (!result.valid) return { error: result.error }

      capitalEffects = result.effects
      propertyCashEffect = 0
    }

    const txId = await callPostRpc(supabase, {
      workspaceId,
      actorId: user.id,
      type: 'rental_income',
      effectiveDate,
      amountCents,
      description,
      notes,
      counterpartyReference,
      propertyCashEffectCents: propertyCashEffect,
      policySnapshot: policy,
      allocations: [],
      capitalEffects,
    })

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/rental')
    return { success: true, transactionId: txId }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function postCashDistribution(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated.' }

    const { workspaceId, balances, policy } = await getWorkspaceAndBalances(user.id)

    const amountCents = parseInt(formData.get('amount_cents') as string)
    const effectiveDate = formData.get('effective_date') as string
    const description = formData.get('description') as string
    const notes = (formData.get('notes') as string) || undefined

    const customAllocJson = formData.get('custom_allocations') as string
    const customAllocs = customAllocJson
      ? (JSON.parse(customAllocJson) as Array<{ groupId: string; amountCents: number }>)
      : undefined

    const result = computeDistributionEffects(amountCents, balances, customAllocs)
    if (!result.valid) return { error: result.error }

    const allocations: TransactionAllocation[] = result.effects.map((e) => ({
      ownership_group_id: e.ownership_group_id,
      amount_cents: Math.abs(e.signed_amount_cents),
      allocation_role: 'recipient',
    }))

    const txId = await callPostRpc(supabase, {
      workspaceId,
      actorId: user.id,
      type: 'cash_distribution',
      effectiveDate,
      amountCents,
      description,
      notes,
      propertyCashEffectCents: -amountCents,
      policySnapshot: policy,
      allocations,
      capitalEffects: result.effects,
    })

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    return { success: true, transactionId: txId }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function postEquityTransfer(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated.' }

    const { workspaceId, balances, policy } = await getWorkspaceAndBalances(user.id)

    const amountCents = parseInt(formData.get('amount_cents') as string)
    const effectiveDate = formData.get('effective_date') as string
    const description = formData.get('description') as string
    const notes = (formData.get('notes') as string) || undefined
    const sourceGroupId = formData.get('source_group_id') as string
    const destinationGroupId = formData.get('destination_group_id') as string

    if (sourceGroupId === destinationGroupId) {
      return { error: 'Source and destination groups must be different.' }
    }

    const result = computeEquityTransferEffects(sourceGroupId, destinationGroupId, amountCents, balances)
    if (!result.valid) return { error: result.error }

    const allocations: TransactionAllocation[] = [
      { ownership_group_id: sourceGroupId, amount_cents: amountCents, allocation_role: 'source' },
      { ownership_group_id: destinationGroupId, amount_cents: amountCents, allocation_role: 'destination' },
    ]

    const txId = await callPostRpc(supabase, {
      workspaceId,
      actorId: user.id,
      type: 'equity_transfer',
      effectiveDate,
      amountCents,
      description,
      notes,
      propertyCashEffectCents: 0,
      policySnapshot: policy,
      allocations,
      capitalEffects: result.effects,
    })

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/ownership')
    return { success: true, transactionId: txId }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function postManualAdjustment(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated.' }

    const { workspaceId, balances, policy } = await getWorkspaceAndBalances(user.id)

    const signedAmountCents = parseInt(formData.get('signed_amount_cents') as string)
    const amountCents = Math.abs(signedAmountCents)
    const effectiveDate = formData.get('effective_date') as string
    const description = formData.get('description') as string
    const notes = (formData.get('notes') as string) || undefined
    const groupId = formData.get('ownership_group_id') as string
    const explanation = formData.get('adjustment_explanation') as string
    const confirmedNegative = formData.get('confirmed_negative_balance') === 'true'

    const balance = balances.find((b) => b.groupId === groupId)
    if (balance && balance.balanceCents + signedAmountCents < 0 && !confirmedNegative) {
      return { error: 'This adjustment would create a negative balance. Check the confirmation box to proceed.' }
    }

    const prePercentages = calculateOwnershipPercentages(balances)
    const newBalances = balances.map((b) =>
      b.groupId === groupId ? { ...b, balanceCents: b.balanceCents + signedAmountCents } : b
    )
    const postPercentages = calculateOwnershipPercentages(newBalances)

    const capitalEffects: CapitalEffect[] = [
      {
        ownership_group_id: groupId,
        signed_amount_cents: signedAmountCents,
        entry_type: 'manual_adjustment',
        policy_rationale: `Manual adjustment: ${explanation}`,
        pre_transaction_percentage: prePercentages.get(groupId) ?? null,
        post_transaction_percentage: postPercentages.get(groupId) ?? null,
      },
    ]

    const txId = await callPostRpc(supabase, {
      workspaceId,
      actorId: user.id,
      type: 'manual_adjustment',
      effectiveDate,
      amountCents,
      description: `[MANUAL ADJUSTMENT] ${description}`,
      notes: `${explanation}\n\n${notes ?? ''}`.trim(),
      propertyCashEffectCents: 0,
      policySnapshot: policy,
      allocations: [{ ownership_group_id: groupId, amount_cents: amountCents, allocation_role: 'payer' }],
      capitalEffects,
    })

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/ownership')
    return { success: true, transactionId: txId }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function postReversal(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated.' }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('profile_id', user.id)
      .single()
    if (!membership) return { error: 'No workspace found.' }

    const originalTransactionId = formData.get('original_transaction_id') as string
    const effectiveDate = formData.get('effective_date') as string
    const reversalReason = formData.get('reversal_reason') as string

    const { data, error } = await supabase.rpc('post_reversal', {
      p_workspace_id: membership.workspace_id,
      p_actor_id: user.id,
      p_original_transaction_id: originalTransactionId,
      p_effective_date: effectiveDate,
      p_reason: reversalReason,
    })

    if (error) return { error: error.message }

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/ownership')
    return { success: true, transactionId: (data as { reversal_id: string }).reversal_id }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
