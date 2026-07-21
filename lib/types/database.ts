export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          created_at?: string
        }
      }
      property_workspace: {
        Row: {
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
        Insert: {
          id?: string
          property_name: string
          address?: string | null
          purchase_date?: string | null
          purchase_price_cents?: number | null
          lender_name?: string | null
          original_loan_amount_cents?: number | null
          primary_borrower_label?: string | null
          loan_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          property_name?: string
          address?: string | null
          purchase_date?: string | null
          purchase_price_cents?: number | null
          lender_name?: string | null
          original_loan_amount_cents?: number | null
          primary_borrower_label?: string | null
          loan_notes?: string | null
          created_at?: string
        }
      }
      workspace_members: {
        Row: {
          workspace_id: string
          profile_id: string
          joined_at: string
          invited_by: string | null
        }
        Insert: {
          workspace_id: string
          profile_id: string
          joined_at?: string
          invited_by?: string | null
        }
        Update: {
          workspace_id?: string
          profile_id?: string
          joined_at?: string
          invited_by?: string | null
        }
      }
      ownership_groups: {
        Row: {
          id: string
          workspace_id: string
          name: string
          active: boolean
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          active?: boolean
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          active?: boolean
          display_order?: number
          created_at?: string
        }
      }
      ownership_group_members: {
        Row: {
          ownership_group_id: string
          profile_id: string
          created_at: string
        }
        Insert: {
          ownership_group_id: string
          profile_id: string
          created_at?: string
        }
        Update: {
          ownership_group_id?: string
          profile_id?: string
          created_at?: string
        }
      }
      equity_policy_versions: {
        Row: {
          id: string
          workspace_id: string
          policy_data: Json
          created_by: string | null
          created_at: string
          effective_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          policy_data: Json
          created_by?: string | null
          created_at?: string
          effective_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          policy_data?: Json
          created_by?: string | null
          created_at?: string
          effective_at?: string
        }
      }
      financial_transactions: {
        Row: {
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
          policy_snapshot: Json | null
          created_by: string | null
          created_at: string
          posted_at: string | null
          reversed_transaction_id: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          type: TransactionType
          status?: TransactionStatus
          effective_date: string
          amount_cents: number
          description: string
          notes?: string | null
          counterparty_reference?: string | null
          expense_category?: ExpenseCategory | null
          property_cash_effect_cents?: number
          policy_snapshot?: Json | null
          created_by?: string | null
          created_at?: string
          posted_at?: string | null
          reversed_transaction_id?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          type?: TransactionType
          status?: TransactionStatus
          effective_date?: string
          amount_cents?: number
          description?: string
          notes?: string | null
          counterparty_reference?: string | null
          expense_category?: ExpenseCategory | null
          property_cash_effect_cents?: number
          policy_snapshot?: Json | null
          created_by?: string | null
          created_at?: string
          posted_at?: string | null
          reversed_transaction_id?: string | null
        }
      }
      transaction_allocations: {
        Row: {
          id: string
          transaction_id: string
          ownership_group_id: string
          amount_cents: number
          allocation_role: AllocationRole
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          ownership_group_id: string
          amount_cents: number
          allocation_role: AllocationRole
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          ownership_group_id?: string
          amount_cents?: number
          allocation_role?: AllocationRole
          created_at?: string
        }
      }
      capital_ledger_entries: {
        Row: {
          id: string
          transaction_id: string
          ownership_group_id: string
          signed_amount_cents: number
          entry_type: string
          policy_rationale: string | null
          pre_transaction_percentage: number | null
          post_transaction_percentage: number | null
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          ownership_group_id: string
          signed_amount_cents: number
          entry_type: string
          policy_rationale?: string | null
          pre_transaction_percentage?: number | null
          post_transaction_percentage?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          ownership_group_id?: string
          signed_amount_cents?: number
          entry_type?: string
          policy_rationale?: string | null
          pre_transaction_percentage?: number | null
          post_transaction_percentage?: number | null
          created_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          workspace_id: string
          actor_profile_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          actor_profile_id?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          actor_profile_id?: string | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      post_transaction: {
        Args: {
          p_workspace_id: string
          p_actor_id: string
          p_type: string
          p_effective_date: string
          p_amount_cents: number
          p_description: string
          p_notes: string | null
          p_counterparty_reference: string | null
          p_expense_category: string | null
          p_property_cash_effect_cents: number
          p_policy_snapshot: Json
          p_allocations: Json
          p_capital_effects: Json
        }
        Returns: Json
      }
      post_reversal: {
        Args: {
          p_workspace_id: string
          p_actor_id: string
          p_original_transaction_id: string
          p_effective_date: string
          p_reason: string
        }
        Returns: Json
      }
      get_capital_balances: {
        Args: { p_workspace_id: string }
        Returns: Array<{
          ownership_group_id: string
          ownership_group_name: string
          balance_cents: number
        }>
      }
      get_property_cash_balance: {
        Args: { p_workspace_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type TransactionType =
  | 'initial_contribution'
  | 'additional_contribution'
  | 'owner_paid_expense'
  | 'property_cash_expense'
  | 'capital_improvement'
  | 'mortgage_payment'
  | 'rental_income'
  | 'cash_distribution'
  | 'reimbursement'
  | 'equity_transfer'
  | 'manual_adjustment'
  | 'reversal'

export type TransactionStatus = 'posted' | 'reversed' | 'voided'

export type ExpenseCategory =
  | 'property_taxes'
  | 'home_insurance'
  | 'mortgage_interest'
  | 'mortgage_principal'
  | 'mortgage_escrow'
  | 'maintenance'
  | 'repair'
  | 'utility'
  | 'capital_improvement'
  | 'other'

export type AllocationRole =
  | 'contributor'
  | 'payer'
  | 'recipient'
  | 'source'
  | 'destination'
