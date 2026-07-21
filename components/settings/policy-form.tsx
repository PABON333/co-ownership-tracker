'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle } from 'lucide-react'
import type { WorkspaceActionState } from '@/app/actions/workspace'

interface Policy {
  mortgage_interest_credits_payer: boolean
  mortgage_escrow_credits_payer: boolean
  property_cash_expense_credits_groups: boolean
  retained_rental_income_allocation: string
}

interface Props {
  workspaceId: string
  currentPolicy: Policy | null
  updateAction: (workspaceId: string, formData: FormData) => Promise<WorkspaceActionState>
}

export function SettingsPolicyForm({ workspaceId, currentPolicy, updateAction }: Props) {
  const boundAction = updateAction.bind(null, workspaceId)
  const [state, formAction, pending] = useActionState(boundAction, {})

  const p = currentPolicy ?? {
    mortgage_interest_credits_payer: true,
    mortgage_escrow_credits_payer: true,
    property_cash_expense_credits_groups: false,
    retained_rental_income_allocation: 'proportional',
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Mortgage interest credits payer</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, the group that paid the mortgage receives equity credit for the interest
              portion.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="hidden"
              name="mortgage_interest_credits_payer"
              value={p.mortgage_interest_credits_payer ? 'true' : 'false'}
            />
            <Switch
              defaultChecked={p.mortgage_interest_credits_payer}
              onCheckedChange={(checked) => {
                const el = document.querySelector<HTMLInputElement>(
                  'input[name="mortgage_interest_credits_payer"]'
                )
                if (el) el.value = checked ? 'true' : 'false'
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Mortgage escrow credits payer</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, the payer gets equity credit for the escrow (taxes + insurance) portion.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="hidden"
              name="mortgage_escrow_credits_payer"
              value={p.mortgage_escrow_credits_payer ? 'true' : 'false'}
            />
            <Switch
              defaultChecked={p.mortgage_escrow_credits_payer}
              onCheckedChange={(checked) => {
                const el = document.querySelector<HTMLInputElement>(
                  'input[name="mortgage_escrow_credits_payer"]'
                )
                if (el) el.value = checked ? 'true' : 'false'
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Property cash expenses credit groups</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, shared property expenses (paid from property cash) credit all groups
              proportionally. When disabled, they reduce property cash only.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="hidden"
              name="property_cash_expense_credits_groups"
              value={p.property_cash_expense_credits_groups ? 'true' : 'false'}
            />
            <Switch
              defaultChecked={p.property_cash_expense_credits_groups}
              onCheckedChange={(checked) => {
                const el = document.querySelector<HTMLInputElement>(
                  'input[name="property_cash_expense_credits_groups"]'
                )
                if (el) el.value = checked ? 'true' : 'false'
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Retained rental income allocation</Label>
          <p className="text-xs text-muted-foreground">
            How retained rental income is credited to capital accounts.
          </p>
          <Select
            name="retained_rental_income_allocation"
            defaultValue={p.retained_rental_income_allocation}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="proportional">Proportional (default)</SelectItem>
              <SelectItem value="manual">Manual split</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600 flex items-center gap-1">
          <CheckCircle className="h-4 w-4" /> Policy updated. New transactions will use the new
          policy.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Policy
      </Button>
    </form>
  )
}
