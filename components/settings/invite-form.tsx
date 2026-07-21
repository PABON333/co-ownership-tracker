'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle } from 'lucide-react'
import type { WorkspaceActionState } from '@/app/actions/workspace'

interface Group {
  id: string
  name: string
}

interface Props {
  groups: Group[]
  inviteAction: (_prev: WorkspaceActionState, formData: FormData) => Promise<WorkspaceActionState>
}

export function SettingsInviteForm({ groups, inviteAction }: Props) {
  const [state, formAction, pending] = useActionState(inviteAction, {})

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="invite_email">Email Address</Label>
        <Input
          id="invite_email"
          name="email"
          type="email"
          placeholder="family@example.com"
          required
        />
        {state.fieldErrors?.email && (
          <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Ownership Group</Label>
        <Select name="ownership_group_id" required>
          <SelectTrigger>
            <SelectValue placeholder="Select group…" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.ownership_group_id && (
          <p className="text-sm text-destructive">{state.fieldErrors.ownership_group_id[0]}</p>
        )}
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600 flex items-center gap-1">
          <CheckCircle className="h-4 w-4" /> Invitation sent.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send Invitation
      </Button>
    </form>
  )
}
