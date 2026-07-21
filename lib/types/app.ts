import type {
  TransactionType,
  TransactionStatus,
  ExpenseCategory,
  AllocationRole,
} from './database'

export type { TransactionType, TransactionStatus, ExpenseCategory, AllocationRole }

export interface OwnershipGroup {
  id: string
  name: string
  active: boolean
  display_order: number
  balance_cents: number
  ownership_percentage: number
  members: Profile[]
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
}

export interface WorkspaceInfo {
  id: string
  property_name: string
  address: string | null
  purchase_date: string | null
  purchase_price_cents: number | null
  lender_name: string | null
  original_loan_amount_cents: number | null
  primary_borrower_label: string | null
  loan_notes: string | null
  created_at: string
}

export interface EquityPolicy {
  mortgage_interest_credits_payer: boolean
  mortgage_escrow_credits_payer: boolean
  property_cash_expense_credits_groups: boolean
  retained_rental_income_allocation: 'proportional' | 'manual'
  version_id?: string
  effective_at?: string
}

export const DEFAULT_EQUITY_POLICY: EquityPolicy = {
  mortgage_interest_credits_payer: true,
  mortgage_escrow_credits_payer: true,
  property_cash_expense_credits_groups: false,
  retained_rental_income_allocation: 'proportional',
}

export interface TransactionAllocation {
  ownership_group_id: string
  amount_cents: number
  allocation_role: AllocationRole
}

export interface CapitalEffect {
  ownership_group_id: string
  signed_amount_cents: number
  entry_type: string
  policy_rationale: string
  pre_transaction_percentage: number | null
  post_transaction_percentage: number | null
}

export interface TransactionWithDetails {
  id: string
  workspace_id: string
  type: TransactionType
  status: TransactionStatus
  effective_date: string
  amount_cents: number
  description: string
  notes: string | null
  counterparty_reference: string | null
  expense_category: ExpenseCategory | null
  property_cash_effect_cents: number
  policy_snapshot: EquityPolicy | null
  created_by: string | null
  created_at: string
  posted_at: string | null
  reversed_transaction_id: string | null
  allocations: (TransactionAllocation & { group_name: string })[]
  capital_effects: (CapitalEffect & { group_name: string })[]
  creator_name: string | null
}

export interface MortgagePaymentBreakdown {
  principal_cents: number
  interest_cents: number
  escrow_cents: number
}

export interface PostTransactionInput {
  workspace_id: string
  type: TransactionType
  effective_date: string
  amount_cents: number
  description: string
  notes?: string
  counterparty_reference?: string
  expense_category?: ExpenseCategory
  property_cash_effect_cents: number
  allocations: TransactionAllocation[]
  capital_effects: CapitalEffect[]
  mortgage_breakdown?: MortgagePaymentBreakdown
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  initial_contribution: 'Initial Contribution',
  additional_contribution: 'Additional Contribution',
  owner_paid_expense: 'Owner-Paid Expense',
  property_cash_expense: 'Property Cash Expense',
  capital_improvement: 'Capital Improvement',
  mortgage_payment: 'Mortgage Payment',
  rental_income: 'Rental Income',
  cash_distribution: 'Cash Distribution',
  reimbursement: 'Reimbursement',
  equity_transfer: 'Equity Transfer',
  manual_adjustment: 'Manual Adjustment',
  reversal: 'Reversal',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  property_taxes: 'Property Taxes',
  home_insurance: 'Home Insurance',
  mortgage_interest: 'Mortgage Interest',
  mortgage_principal: 'Mortgage Principal',
  mortgage_escrow: 'Mortgage Escrow',
  maintenance: 'Maintenance',
  repair: 'Repair',
  utility: 'Utility',
  capital_improvement: 'Capital Improvement',
  other: 'Other',
}

export const LEGAL_DISCLAIMER =
  'Calculated ownership shares are internal accounting estimates only. They do not replace a co-ownership agreement, legal title or deed records, mortgage obligations, tax advice, or advice from a qualified attorney or accountant.'
