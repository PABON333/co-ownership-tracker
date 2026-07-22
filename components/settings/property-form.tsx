'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, CheckCircle } from 'lucide-react'
import type { WorkspaceActionState } from '@/app/actions/workspace'

interface Props {
  workspaceId: string
  defaultValues: {
    property_name: string
    address: string
    purchase_date: string
    purchase_price_cents?: number
    lender_name: string
    primary_borrower_label: string
    original_loan_amount_cents?: number
    loan_notes: string
  }
  updateAction: (workspaceId: string, _prev: WorkspaceActionState, formData: FormData) => Promise<WorkspaceActionState>
}

export function SettingsPropertyForm({ workspaceId, defaultValues, updateAction }: Props) {
  const boundAction = updateAction.bind(null, workspaceId)
  const [state, formAction, pending] = useActionState(boundAction, {} as WorkspaceActionState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="property_name">Property Name *</Label>
          <Input
            id="property_name"
            name="property_name"
            defaultValue={defaultValues.property_name}
            required
          />
          {state.fieldErrors?.property_name && (
            <p className="text-sm text-destructive">{state.fieldErrors.property_name[0]}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" name="address" defaultValue={defaultValues.address} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="purchase_date">Purchase Date</Label>
          <Input
            id="purchase_date"
            name="purchase_date"
            type="date"
            defaultValue={defaultValues.purchase_date}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="purchase_price_cents">Purchase Price (cents)</Label>
          <Input
            id="purchase_price_cents"
            name="purchase_price_cents"
            type="number"
            min={0}
            defaultValue={defaultValues.purchase_price_cents}
            placeholder="e.g. 45000000 for $450,000"
          />
        </div>

        <h3 className="sm:col-span-2 text-sm font-semibold pt-2 border-t">Mortgage / Loan</h3>

        <div className="space-y-1.5">
          <Label htmlFor="lender_name">Lender Name</Label>
          <Input id="lender_name" name="lender_name" defaultValue={defaultValues.lender_name} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="primary_borrower_label">Primary Borrower</Label>
          <Input
            id="primary_borrower_label"
            name="primary_borrower_label"
            defaultValue={defaultValues.primary_borrower_label}
            placeholder="e.g. Andrea & Alvaro"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="original_loan_amount_cents">Original Loan Amount (cents)</Label>
          <Input
            id="original_loan_amount_cents"
            name="original_loan_amount_cents"
            type="number"
            min={0}
            defaultValue={defaultValues.original_loan_amount_cents}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="loan_notes">Loan Notes</Label>
          <Textarea
            id="loan_notes"
            name="loan_notes"
            rows={2}
            defaultValue={defaultValues.loan_notes}
            placeholder="Optional — loan terms, rate, etc."
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600 flex items-center gap-1">
          <CheckCircle className="h-4 w-4" /> Saved.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </form>
  )
}
