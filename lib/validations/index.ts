import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
})

export const signUpSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters.' })
    .regex(/[a-zA-Z]/, { message: 'Password must contain at least one letter.' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number.' }),
  full_name: z.string().min(2, { message: 'Full name must be at least 2 characters.' }).trim(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
})

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match.',
    path: ['confirm_password'],
  })

const moneySchema = z
  .number({ message: 'Amount is required.' })
  .int({ message: 'Amount must be in whole cents.' })
  .positive({ message: 'Amount must be positive.' })

const allocationSchema = z.object({
  ownership_group_id: z.string().min(1),
  amount_cents: moneySchema,
  allocation_role: z.enum(['contributor', 'payer', 'recipient', 'source', 'destination']),
})

const baseTxSchema = z.object({
  effective_date: z.string().min(1, { message: 'Effective date is required.' }),
  amount_cents: moneySchema,
  description: z.string().min(1, { message: 'Description is required.' }).max(500),
  notes: z.string().max(2000).optional(),
  counterparty_reference: z.string().max(200).optional(),
  allocations: z.array(allocationSchema).min(1),
})

export const contributionSchema = baseTxSchema.extend({
  type: z.enum(['initial_contribution', 'additional_contribution']),
  funds_deposited_to_property: z.boolean().default(true),
})

export const ownerPaidExpenseSchema = baseTxSchema.extend({
  type: z.literal('owner_paid_expense'),
  expense_category: z.enum([
    'property_taxes',
    'home_insurance',
    'mortgage_interest',
    'mortgage_principal',
    'mortgage_escrow',
    'maintenance',
    'repair',
    'utility',
    'capital_improvement',
    'other',
  ]),
  receives_equity_credit: z.boolean(),
})

export const propertyCashExpenseSchema = baseTxSchema.extend({
  type: z.literal('property_cash_expense'),
  expense_category: z.enum([
    'property_taxes',
    'home_insurance',
    'maintenance',
    'repair',
    'utility',
    'other',
  ]),
})

export const capitalImprovementSchema = baseTxSchema.extend({
  type: z.literal('capital_improvement'),
  owner_paid: z.boolean(),
})

export const mortgagePaymentSchema = baseTxSchema.extend({
  type: z.literal('mortgage_payment'),
  principal_cents: z.number().int().min(0),
  interest_cents: z.number().int().min(0),
  escrow_cents: z.number().int().min(0),
})

export const rentalIncomeSchema = baseTxSchema.extend({
  type: z.literal('rental_income'),
  rental_period_start: z.string().min(1),
  rental_period_end: z.string().min(1),
  retain_income: z.boolean().default(true),
  custom_allocation: z.boolean().default(false),
})

export const cashDistributionSchema = baseTxSchema.extend({
  type: z.literal('cash_distribution'),
  proportional: z.boolean().default(true),
})

export const reimbursementSchema = baseTxSchema.extend({
  type: z.literal('reimbursement'),
  original_transaction_id: z.string().optional(),
})

export const equityTransferSchema = z.object({
  effective_date: z.string().min(1),
  amount_cents: moneySchema,
  description: z.string().min(1).max(500),
  notes: z.string().max(2000).optional(),
  source_group_id: z.string().min(1),
  destination_group_id: z.string().min(1),
  transfer_reason: z.string().min(10, { message: 'Please provide a clear explanation.' }),
})

export const manualAdjustmentSchema = z.object({
  effective_date: z.string().min(1),
  amount_cents: z.number().int(),
  description: z.string().min(1).max(500),
  notes: z.string().max(2000).optional(),
  ownership_group_id: z.string().min(1),
  adjustment_explanation: z.string().min(20, { message: 'Please provide a detailed explanation.' }),
  confirmed_negative_balance: z.boolean().default(false),
})

export const reversalSchema = z.object({
  original_transaction_id: z.string().min(1),
  effective_date: z.string().min(1),
  reversal_reason: z.string().min(10, { message: 'Please provide a clear reason.' }),
})

export const workspaceSetupSchema = z.object({
  property_name: z.string().min(2, { message: 'Property name is required.' }),
  address: z.string().optional(),
  purchase_date: z.string().optional(),
  purchase_price_cents: z.number().int().positive().optional().nullable(),
  disclaimer_acknowledged: z.literal(true, {
    message: 'You must acknowledge the disclaimer.',
  }),
})

export const inviteSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  ownership_group_id: z.string().min(1, { message: 'Please select an ownership group.' }),
})

export const equityPolicySchema = z.object({
  mortgage_interest_credits_payer: z.boolean(),
  mortgage_escrow_credits_payer: z.boolean(),
  property_cash_expense_credits_groups: z.boolean(),
  retained_rental_income_allocation: z.enum(['proportional', 'manual']),
})
