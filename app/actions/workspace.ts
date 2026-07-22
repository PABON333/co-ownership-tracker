'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { workspaceSetupSchema, inviteSchema, equityPolicySchema } from '@/lib/validations'
import { DEFAULT_EQUITY_POLICY } from '@/lib/types/app'
import type { Json } from '@/lib/types/database'
import { revalidatePath } from 'next/cache'

const DEFAULT_OWNERSHIP_GROUPS = [
  { name: 'Andrea & Alvaro', display_order: 0 },
  { name: 'Marc & Paola', display_order: 1 },
  { name: 'Ana', display_order: 2 },
  { name: 'Gustavo', display_order: 3 },
]

export type WorkspaceActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  workspaceId?: string
}

export async function createWorkspace(
  _prev: WorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const existing = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('profile_id', user.id)
    .single()

  if (existing.data) {
    return { error: 'You already have a workspace.' }
  }

  const raw = {
    property_name: formData.get('property_name') as string,
    address: (formData.get('address') as string) || undefined,
    purchase_date: (formData.get('purchase_date') as string) || undefined,
    purchase_price_cents: formData.get('purchase_price_cents')
      ? Number(formData.get('purchase_price_cents'))
      : null,
    disclaimer_acknowledged: formData.get('disclaimer_acknowledged') === 'true',
  }

  const parsed = workspaceSetupSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  // Create workspace
  const { data: workspace, error: wsError } = await supabase
    .from('property_workspace')
    .insert({
      property_name: parsed.data.property_name,
      address: parsed.data.address,
      purchase_date: parsed.data.purchase_date,
      purchase_price_cents: parsed.data.purchase_price_cents,
    })
    .select()
    .single()

  if (wsError || !workspace) {
    return { error: 'Failed to create workspace. Please try again.' }
  }

  // Add creator as member
  await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    profile_id: user.id,
  })

  // Create default ownership groups
  await supabase.from('ownership_groups').insert(
    DEFAULT_OWNERSHIP_GROUPS.map((g) => ({
      workspace_id: workspace.id,
      name: g.name,
      display_order: g.display_order,
    }))
  )

  // Create default equity policy
  await supabase.from('equity_policy_versions').insert({
    workspace_id: workspace.id,
    policy_data: DEFAULT_EQUITY_POLICY as unknown as Json,
    created_by: user.id,
  })

  revalidatePath('/', 'layout')
  return { success: true, workspaceId: workspace.id }
}

export async function inviteMember(
  _prev: WorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('profile_id', user.id)
    .single()
  if (!membership) return { error: 'Workspace not found.' }

  const raw = {
    email: formData.get('email') as string,
    ownership_group_id: formData.get('ownership_group_id') as string,
  }

  const parsed = inviteSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { error } = await supabase.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      workspace_id: membership.workspace_id,
      ownership_group_id: parsed.data.ownership_group_id,
    },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback`,
  })

  if (error) {
    if (error.message.includes('admin')) {
      return {
        error:
          'Invitation feature requires Supabase service role. Use the Supabase dashboard to invite users directly.',
      }
    }
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function updateEquityPolicy(
  workspaceId: string,
  _prev: WorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const raw = {
    mortgage_interest_credits_payer: formData.get('mortgage_interest_credits_payer') === 'true',
    mortgage_escrow_credits_payer: formData.get('mortgage_escrow_credits_payer') === 'true',
    property_cash_expense_credits_groups:
      formData.get('property_cash_expense_credits_groups') === 'true',
    retained_rental_income_allocation: formData.get(
      'retained_rental_income_allocation'
    ) as 'proportional' | 'manual',
  }

  const parsed = equityPolicySchema.safeParse(raw)
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const { error } = await supabase.from('equity_policy_versions').insert({
    workspace_id: workspaceId,
    policy_data: parsed.data as unknown as Json,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { success: true }
}

export async function updateWorkspaceDetails(
  workspaceId: string,
  _prev: WorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const updates: Record<string, unknown> = {
    property_name: formData.get('property_name') as string,
    address: (formData.get('address') as string) || null,
    purchase_date: (formData.get('purchase_date') as string) || null,
    lender_name: (formData.get('lender_name') as string) || null,
    primary_borrower_label: (formData.get('primary_borrower_label') as string) || null,
    loan_notes: (formData.get('loan_notes') as string) || null,
  }

  const purchasePrice = formData.get('purchase_price_cents')
  if (purchasePrice) updates.purchase_price_cents = Number(purchasePrice)

  const loanAmount = formData.get('original_loan_amount_cents')
  if (loanAmount) updates.original_loan_amount_cents = Number(loanAmount)

  const { error } = await supabase
    .from('property_workspace')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq('id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { success: true }
}

export async function renameOwnershipGroup(
  groupId: string,
  newName: string
): Promise<WorkspaceActionState> {
  if (!newName.trim()) return { error: 'Name is required.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase
    .from('ownership_groups')
    .update({ name: newName.trim() })
    .eq('id', groupId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  revalidatePath('/ownership')
  return { success: true }
}
